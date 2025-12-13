import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { organization, organizationMembership } from "@/lib/schema";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .min(3)
    .max(50)
    .refine((val) => !val.includes("--"), {
      message: "Slug cannot contain consecutive hyphens",
    })
    .optional(),
});

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: organizationMembership.role,
      joinedAt: organizationMembership.joinedAt,
    })
    .from(organization)
    .innerJoin(
      organizationMembership,
      eq(organization.id, organizationMembership.organizationId)
    )
    .where(eq(organizationMembership.userId, session.user.id));

  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateKey = `org:create:${session.user.id}`;
  const { success, remaining, resetAt } = await rateLimit(rateKey, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", resetAt },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = createOrgSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, slug: providedSlug } = parsed.data;
  const slug = providedSlug || slugifyName(name);

  // Verify slug uniqueness
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }

  const orgId = randomUUID();
  const membershipId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({
      id: orgId,
      name,
      slug,
      createdBy: session.user.id,
    });

    await tx.insert(organizationMembership).values({
      id: membershipId,
      organizationId: orgId,
      userId: session.user.id,
      role: "owner",
      status: "active",
    });
  });

  return NextResponse.json(
    { id: orgId, name, slug, remaining },
    { status: 201 }
  );
}
