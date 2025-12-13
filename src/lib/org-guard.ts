import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationMembership } from "@/lib/schema";
import { resolveTenant } from "./tenant-resolver";

export type OrgAccessResult = {
  orgId: string;
  membership: typeof organizationMembership.$inferSelect;
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
};

/**
 * Requires organization access for the current request.
 * Validates that the user is authenticated and has access to the organization.
 *
 * @param req - The Next.js request object
 * @param requiredRole - Optional role requirement (owner, admin, member)
 * @returns Either an error response or the organization access result
 */
export async function requireOrgAccess(
  req: NextRequest,
  requiredRole?: "owner" | "admin" | "member"
): Promise<NextResponse | OrgAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await resolveTenant(req);

  if (!orgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  // Verificar membership com filtros explícitos
  const membership = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.userId, session.user.id),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);

  if (!membership[0]) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );
  }

  // Verificar role se necessário
  if (requiredRole) {
    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    const userRoleLevel =
      roleHierarchy[membership[0].role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredLevel) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }
  }

  // NOTA: Não usar setOrgContext aqui - usar filtros explícitos
  // setOrgContext deve ser usado apenas dentro de transações com SET LOCAL

  return {
    orgId,
    membership: membership[0],
    session,
  };
}

