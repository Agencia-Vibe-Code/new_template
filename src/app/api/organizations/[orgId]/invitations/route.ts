import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgAccess } from "@/lib/org-guard";
import { rateLimit } from "@/lib/rate-limit";
import { organizationInvitation } from "@/lib/schema";

const invitationSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "AGENT"]).default("AGENT"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const access = await requireOrgAccess(req, "ADMIN"); // admin+ can invite
  if (access instanceof NextResponse) {
    return access;
  }

  // Apenas OWNER pode convidar OWNER
  const body = await req.json();
  const parsed = invitationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  if (role === "OWNER" && access.membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Somente OWNER pode convidar outro OWNER" },
      { status: 403 }
    );
  }

  // Limita convites por usuário/tenant
  const rateKey = `invite:create:${access.session.user.id}:${orgId}`;
  const { success, resetAt, remaining } = await rateLimit(
    rateKey,
    20,
    60 * 60 * 1000
  );

  if (!success) {
    return NextResponse.json(
      { error: "Limite de convites excedido", resetAt },
      { status: 429 }
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitationId = randomUUID();

  const created = await db.transaction(async (tx) => {
    const [invitation] = await tx
      .insert(organizationInvitation)
      .values({
        id: invitationId,
        organizationId: access.orgId,
        email,
        role,
        token,
        invitedBy: access.session.user.id,
        expiresAt,
      })
      .returning({
        id: organizationInvitation.id,
        email: organizationInvitation.email,
        role: organizationInvitation.role,
        expiresAt: organizationInvitation.expiresAt,
      });

    return invitation;
  });

  return NextResponse.json(
    { ...created, remaining },
    { status: 201 }
  );
}
