import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationMembership, user } from "@/lib/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const membership = await db
    .select({ id: organizationMembership.id })
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
      { error: "Usuário não faz parte desta organização" },
      { status: 403 }
    );
  }

  await db
    .update(user)
    .set({ lastActiveOrgId: orgId })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({
    success: true,
    organizationId: orgId,
  });
}
