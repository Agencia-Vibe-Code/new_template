import { randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireOrgAccess } from "@/lib/org-guard";
import { rateLimit } from "@/lib/rate-limit";
import { organizationInvitation } from "@/lib/schema";

const invitationSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const access = await requireOrgAccess(req, "admin"); // admin+ can invite
  if (access instanceof NextResponse) {
    return access;
  }

  // Only owners can invite with owner role
  const body = await req.json();
  const parsed = invitationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  if (role === "owner" && access.membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can invite owners" },
      { status: 403 }
    );
  }

  // Rate limit invitations per user per org
  const rateKey = `invite:create:${access.session.user.id}:${access.orgId}`;
  const { success, resetAt, remaining } = await rateLimit(
    rateKey,
    20,
    60 * 60 * 1000
  );

  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", resetAt },
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
