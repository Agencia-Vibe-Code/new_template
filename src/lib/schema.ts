import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  jsonb,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";

// IMPORTANT! ID fields should ALWAYS use UUID types, EXCEPT the BetterAuth tables.

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // Foreign key constraint will be added in migration SQL to avoid circular reference
    lastActiveOrgId: text("last_active_org_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    index("account_provider_account_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// ============================================
// Multi-Tenant RBAC Tables
// ============================================

// 1. Organizations (Tenants)
export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(), // UUID
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(), // Para subdomínios
    domain: text("domain"), // Domínio verificado para SSO
    domainVerifiedAt: timestamp("domain_verified_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    // Campo opcional para extensibilidade futura
    metadata: jsonb("metadata"), // Para dados customizados por organização
  },
  (table) => [
    index("org_slug_idx").on(table.slug),
    index("org_domain_idx").on(table.domain),
  ]
);

// 2. Organization Memberships
export const organizationMembership = pgTable(
  "organization_membership",
  {
    id: text("id").primaryKey(), // UUID
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | admin | member | custom
    status: text("status").notNull().default("active"), // active | pending | suspended
    invitedBy: text("invited_by").references(() => user.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("org_membership_org_user_idx").on(
      table.organizationId,
      table.userId
    ),
    index("org_membership_user_idx").on(table.userId),
    // Índices compostos para consultas frequentes
    index("org_membership_org_user_status_idx").on(
      table.organizationId,
      table.userId,
      table.status
    ),
    index("org_membership_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    // Unique constraint: user can only have one membership per org
    unique("org_membership_unique").on(table.organizationId, table.userId),
  ]
);

// 3. Organization Invitations
export const organizationInvitation = pgTable(
  "organization_invitation",
  {
    id: text("id").primaryKey(), // UUID
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("org_invitation_token_idx").on(table.token),
    index("org_invitation_org_idx").on(table.organizationId),
    index("org_invitation_email_idx").on(table.email),
  ]
);

// 4. Roles (para RBAC customizado)
export const role = pgTable(
  "role",
  {
    id: text("id").primaryKey(), // UUID
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Ex: "project_manager", "viewer"
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(), // owner, admin, member são system
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("role_org_idx").on(table.organizationId),
    // Unique: role name per organization
    unique("role_org_name_unique").on(table.organizationId, table.name),
    // Unique pair (id, organization_id) to support composite FK from user_role
    unique("role_id_org_unique").on(table.id, table.organizationId),
  ]
);

// 5. Permissions
export const permission = pgTable(
  "permission",
  {
    id: text("id").primaryKey(), // UUID
    name: text("name").notNull(), // Ex: "project:create", "user:delete"
    description: text("description"),
    resource: text("resource").notNull(), // Ex: "project", "user", "organization"
    action: text("action").notNull(), // Ex: "create", "read", "update", "delete"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("permission_resource_action_idx").on(table.resource, table.action),
    // Unique: permission name must be unique globally
    unique("permission_name_unique").on(table.name),
  ]
);

// 6. Role Permissions (Many-to-Many)
export const rolePermission = pgTable(
  "role_permission",
  {
    id: text("id").primaryKey(), // UUID
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("role_permission_role_idx").on(table.roleId),
    index("role_permission_permission_idx").on(table.permissionId),
    // Unique: role can't have duplicate permissions
    unique("role_permission_unique").on(table.roleId, table.permissionId),
  ]
);

// 7. User Roles (para roles customizados por usuário)
export const userRole = pgTable(
  "user_role",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_role_user_org_idx").on(table.userId, table.organizationId),
    index("user_role_role_idx").on(table.roleId),
    // Unique: user can't have duplicate role assignments in same org
    unique("user_role_unique").on(
      table.userId,
      table.roleId,
      table.organizationId
    ),
    // Ensure user_role references role within the same organization
    foreignKey({
      columns: [table.roleId, table.organizationId],
      foreignColumns: [role.id, role.organizationId],
      name: "user_role_role_org_fk",
      onDelete: "cascade",
    }),
  ]
);
