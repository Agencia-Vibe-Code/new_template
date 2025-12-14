import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgAccess } from "@/lib/org-guard";
import { rateLimit } from "@/lib/rate-limit";
import { organizationMembership } from "@/lib/schema";

const updateMemberSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "AGENT"]),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const { orgId, userId } = await params;
  const access = await requireOrgAccess(req, "ADMIN"); // admin+ pode atualizar papéis
  if (access instanceof NextResponse) {
    return access;
  }

  const body = await req.json();
  const parsed = updateMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { role } = parsed.data;

  // Only owners can promote others to owner
  if (role === "OWNER" && access.membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Somente OWNER pode conceder OWNER" },
      { status: 403 }
    );
  }

  // Limitar atualização de papéis por usuário/tenant
  const rateKey = `member:update:${access.session.user.id}:${orgId}`;
  const { success, resetAt, remaining } = await rateLimit(
    rateKey,
    50,
    60 * 60 * 1000
  );

  if (!success) {
    return NextResponse.json(
      { error: "Limite de atualização de membro excedido", resetAt },
      { status: 429 }
    );
  }

  const result = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select()
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.organizationId, access.orgId),
          eq(organizationMembership.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return { error: "Membro não encontrado", status: 404 } as const;
    }

    // Guard against demoting the last owner
    if (membership.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembership)
        .where(
          and(
            eq(organizationMembership.organizationId, access.orgId),
            eq(organizationMembership.role, "OWNER"),
            eq(organizationMembership.status, "active")
          )
        );

      const totalOwners = Number(ownerCount[0]?.count ?? 0);

      if (totalOwners <= 1) {
        return {
          error: "Não é possível remover o último OWNER da organização",
          status: 400,
        } as const;
      }
    }

    const [updated] = await tx
      .update(organizationMembership)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(organizationMembership.id, membership.id))
      .returning({
        id: organizationMembership.id,
        userId: organizationMembership.userId,
        role: organizationMembership.role,
        status: organizationMembership.status,
      });

    return { updated, remaining } as const;
  });

  if ("error" in result) {
    const status = result.status ?? 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ membership: result.updated, remaining });
}
