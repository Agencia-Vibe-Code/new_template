import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationMembership, user } from "@/lib/schema";

const payloadSchema = z.object({
  orgId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const membership = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, parsed.data.orgId),
        eq(organizationMembership.userId, session.user.id)
      )
    )
    .limit(1);

  if (!membership[0]) {
    return NextResponse.json(
      { error: "Usuário não faz parte deste tenant" },
      { status: 403 }
    );
  }

  await db
    .update(user)
    .set({ lastActiveOrgId: parsed.data.orgId })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ ok: true, orgId: parsed.data.orgId });
}
