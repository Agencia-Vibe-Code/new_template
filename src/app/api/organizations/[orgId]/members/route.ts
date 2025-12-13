import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { requireOrgAccess } from "@/lib/org-guard";
import { hasPermission } from "@/lib/rbac";
import { organizationMembership, user } from "@/lib/schema";

const membersQuerySchema = z.object({
  status: z.enum(["active", "pending", "suspended"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const access = await requireOrgAccess(req);
  if (access instanceof NextResponse) {
    return access;
  }

  // Validate query params
  const parsedQuery = membersQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  const status = parsedQuery.data.status ?? "active";
  const limit = parsedQuery.data.limit ?? 50;

  // Enforce permission check (default members have member:read)
  const canReadMembers = await hasPermission(
    access.session.user.id,
    access.orgId,
    "member:read"
  );

  if (!canReadMembers) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  let whereClause = eq(organizationMembership.organizationId, access.orgId);

  if (status) {
    whereClause = and(whereClause, eq(organizationMembership.status, status));
  }

  const members = await db
    .select({
      id: organizationMembership.id,
      userId: organizationMembership.userId,
      role: organizationMembership.role,
      status: organizationMembership.status,
      invitedBy: organizationMembership.invitedBy,
      joinedAt: organizationMembership.joinedAt,
      name: user.name,
      email: user.email,
    })
    .from(organizationMembership)
    .innerJoin(user, eq(organizationMembership.userId, user.id))
    .where(whereClause)
    .orderBy(asc(organizationMembership.joinedAt))
    .limit(limit);

  return NextResponse.json({ organizationId: access.orgId, members });
}
