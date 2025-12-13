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

test("owner bypasses permission checks", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "owner", status: "active" }] }) as any
  );

  const result = await hasPermission(
    "user-1",
    "org-1",
    "organization:delete"
  );

  assert.equal(result, true);
});

test("admin has broad access but is blocked on restricted actions", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "admin", status: "active" }] }) as any
  );

  const allowed = await hasPermission("user-1", "org-1", "project:read");
  const blocked = await hasPermission(
    "user-1",
    "org-1",
    "organization:delete"
  );

  assert.equal(allowed, true);
  assert.equal(blocked, false);
});

test("member receives default permissions by default", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "member", status: "active" }] }) as any
  );

  const allowed = await hasPermission("user-1", "org-1", "project:create");
  const denied = await hasPermission("user-1", "org-1", "organization:delete");

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test("member gains permissions via custom roles", async () => {
  __setDbForTesting(
    new MockDb({
      membership: [{ role: "member", status: "active" }],
      userRoles: [{ roleId: "role-1" }],
      rolePermissions: [{ permission: { name: "project:delete" } }],
    }) as any
  );

  const allowed = await hasPermission("user-1", "org-1", "project:delete");

  assert.equal(allowed, true);
});

test("member keeps default permissions even when custom roles exist", async () => {
  __setDbForTesting(
    new MockDb({
      membership: [{ role: "member", status: "active" }],
      userRoles: [{ roleId: "role-1" }],
      rolePermissions: [], // custom role without permissions
    }) as any
  );

  const allowed = await hasPermission("user-1", "org-1", "project:create");

  assert.equal(allowed, true);
});

test("non-members are denied", async () => {
  __setDbForTesting(new MockDb({ membership: [] }) as any);

  const result = await hasPermission("user-1", "org-1", "project:read");

  assert.equal(result, false);
});

test("requirePermission throws when permission is missing", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "member", status: "active" }] }) as any
  );

  await assert.rejects(() =>
    requirePermission("user-1", "org-1", "organization:delete")
  );
});

test("role hierarchy enforces minimum role checks", async () => {
  __setDbForTesting(
    new MockDb({ membership: [{ role: "admin", status: "active" }] }) as any
  );

  const meetsMember = await hasMinimumRole("user-1", "org-1", "member");
  const meetsOwner = await hasMinimumRole("user-1", "org-1", "owner");

  assert.equal(meetsMember, true);
  assert.equal(meetsOwner, false);
});
