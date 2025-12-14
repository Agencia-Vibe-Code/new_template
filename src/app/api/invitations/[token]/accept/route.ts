import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationInvitation, organizationMembership, user } from "@/lib/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [invitation] = await db
    .select()
    .from(organizationInvitation)
    .where(eq(organizationInvitation.token, token))
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }

  const now = new Date();

  if (invitation.expiresAt && invitation.expiresAt <= now) {
    return NextResponse.json(
      { error: "Convite expirado" },
      { status: 410 }
    );
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { error: "Convite já aceito" },
      { status: 400 }
    );
  }

  const sessionEmail = session.user.email?.toLowerCase();
  const invitationEmail = invitation.email?.toLowerCase();

  if (!sessionEmail || sessionEmail !== invitationEmail) {
    return NextResponse.json(
      { error: "O e-mail do convite não corresponde ao usuário autenticado" },
      { status: 403 }
    );
  }

  const result = await db.transaction(async (tx) => {
    const [existingMembership] = await tx
      .select()
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.organizationId, invitation.organizationId),
          eq(organizationMembership.userId, session.user.id)
        )
      )
      .limit(1);

    let membershipRole = existingMembership?.role;

    if (!existingMembership) {
      const [createdMembership] = await tx
        .insert(organizationMembership)
        .values({
          id: randomUUID(),
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role,
          status: "active",
          invitedBy: invitation.invitedBy ?? session.user.id,
        })
        .returning({
          id: organizationMembership.id,
          role: organizationMembership.role,
          status: organizationMembership.status,
        });

      if (!createdMembership) {
        throw new Error("Falha ao criar membership para o convite");
      }

      membershipRole = createdMembership.role;
    }

    await tx
      .update(organizationInvitation)
      .set({ acceptedAt: now })
      .where(eq(organizationInvitation.id, invitation.id));

    // Update last active org to the accepted organization
    await tx
      .update(user)
      .set({ lastActiveOrgId: invitation.organizationId })
      .where(eq(user.id, session.user.id));

    return {
      organizationId: invitation.organizationId,
      role: membershipRole ?? invitation.role,
    };
  });

  return NextResponse.json(result);
}
