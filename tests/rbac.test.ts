import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __resetDbForTesting,
  __setDbForTesting,
  hasMinimumRole,
  hasPermission,
  requirePermission,
} from "../src/lib/rbac";
import {
  organizationMembership,
  permission,
  rolePermission,
  userRole,
} from "../src/lib/schema";

type Dataset = {
  membership?: any[];
  userRoles?: any[];
  rolePermissions?: any[];
};

class MockQuery<T> {
  constructor(private readonly data: T[]) {}

  innerJoin() {
    return this;
  }

  where() {
    return this;
  }

  limit(count: number) {
    return Promise.resolve(this.data.slice(0, count));
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?:
      | ((value: T[]) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.data).then(onfulfilled, onrejected);
  }
}

class MockDb {
  constructor(private readonly dataset: Dataset) {}

  select() {
    return {
      from: (table: any) => {
        const key =
          table === organizationMembership
            ? "membership"
            : table === userRole
              ? "userRoles"
              : table === rolePermission || table === permission
                ? "rolePermissions"
                : "membership";

        const data = this.dataset[key as keyof Dataset] ?? [];
        return new MockQuery(data);
      },
    };
  }
}

afterEach(() => {
  __resetDbForTesting();
});

test("OWNER bypasses permission checks", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "OWNER", status: "active" }] }) as any
  );

  const result = await hasPermission(
    "user-1",
    "org-1",
    "tenant:manage"
  );

  assert.equal(result, true);
});

test("ADMIN inherits management permissions", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "ADMIN", status: "active" }] }) as any
  );

  const canPublish = await hasPermission("user-1", "org-1", "form:publish");
  const canManageUsers = await hasPermission("user-1", "org-1", "user:manage");

  assert.equal(canPublish, true);
  assert.equal(canManageUsers, true);
});

test("MANAGER can ship forms but not manage tenants", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "MANAGER", status: "active" }] }) as any
  );

  const canPublish = await hasPermission("user-1", "org-1", "form:publish");
  const blocked = await hasPermission("user-1", "org-1", "tenant:manage");

  assert.equal(canPublish, true);
  assert.equal(blocked, false);
});

test("AGENT can only create/view submissions by default", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "AGENT", status: "active" }] }) as any
  );

  const canSubmit = await hasPermission("user-1", "org-1", "submission:create");
  const blocked = await hasPermission("user-1", "org-1", "form:edit");

  assert.equal(canSubmit, true);
  assert.equal(blocked, false);
});

test("custom roles add permissions without removing defaults", async () => {
  __setDbForTesting(
    new MockDb({
      membership: [{ role: "AGENT", status: "active" }],
      userRoles: [{ roleId: "role-1" }],
      rolePermissions: [{ permission: { name: "submission:export" }, role: { organizationId: "org-1" } }],
    }) as any
  );

  const canExport = await hasPermission("user-1", "org-1", "submission:export");
  const stillCanSubmit = await hasPermission(
    "user-1",
    "org-1",
    "submission:create"
  );

  assert.equal(canExport, true);
  assert.equal(stillCanSubmit, true);
});

test("non-members are denied", async () => {
  __setDbForTesting(new MockDb({ membership: [] }) as any);

  const result = await hasPermission("user-1", "org-1", "submission:view");

  assert.equal(result, false);
});

test("requirePermission throws when permission is missing", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "AGENT", status: "active" }] }) as any
  );

  await assert.rejects(() =>
    requirePermission("user-1", "org-1", "tenant:manage")
  );
});

test("role hierarchy enforces minimum role checks", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "ADMIN", status: "active" }] }) as any
  );

  const meetsAgent = await hasMinimumRole("user-1", "org-1", "AGENT");
  const meetsOwner = await hasMinimumRole("user-1", "org-1", "OWNER");

  assert.equal(meetsAgent, true);
  assert.equal(meetsOwner, false);
});
