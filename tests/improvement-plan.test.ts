import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { NextRequest } from "next/server";
import { extractDiffInput } from "@/app/api/pdf/diff/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTemplatesForTenant } from "@/lib/form-service";
import { orderSubmissionsLatestFirst } from "@/lib/submission-utils";
import { resolveTenant } from "@/lib/tenant-resolver";
import { ROTEIRO_TEMPLATE_FILE } from "@/lib/templates/roteiro-template";

test("orderSubmissionsLatestFirst keeps newest submissions first", () => {
  const ordered = orderSubmissionsLatestFirst([
    { id: "s1", createdAt: "2023-01-01T00:00:00Z" },
    { id: "s2", createdAt: "2023-02-01T00:00:00Z" },
    { id: "s3", createdAt: "2022-12-01T00:00:00Z" },
  ]);

  assert.deepEqual(
    ordered.map((item) => item.id),
    ["s2", "s1", "s3"]
  );
});

test("listTemplatesForTenant filters out drafts by default", async () => {
  const templates = [
    { id: "t1", status: "published" },
    { id: "t2", status: "draft" },
  ] as any[];

  const selectMock = mock.method(db as any, "select", () => ({
    from: () => ({
      where: () => Promise.resolve(templates),
    }),
  }));

  const publishedOnly = await listTemplatesForTenant("org-1");
  assert.equal(publishedOnly.length, 1);
  assert.equal(publishedOnly[0].id, "t1");

  const withDrafts = await listTemplatesForTenant("org-1", {
    includeDrafts: true,
  });
  assert.equal(withDrafts.length, 2);

  selectMock.mock.restore();
});

test("resolveTenant stops on unknown subdomain instead of using lastActiveOrgId", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

  const selectMock = mock.method(db as any, "select", () => ({
    from: () => ({
      where: () => ({
        limit: async () => [],
      }),
    }),
  }));

  const sessionMock = mock.method(auth.api as any, "getSession", async () => ({
    user: { id: "u1" },
  }));

  const req = new NextRequest("https://ghost.example.com/workspace");
  const result = await resolveTenant(req);
  assert.equal(result, null);
  assert.equal((sessionMock as any).mock.calls.length, 0);

  selectMock.mock.restore();
  sessionMock.mock.restore();
});

test("resolveTenant accepts allowed host with porta (localhost:3000)", async () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

  const selectMock = mock.method(db as any, "select", () => ({
    from: () => ({
      where: () => ({
        limit: async () => [{ lastActiveOrgId: "org-123" }],
      }),
    }),
  }));

  const sessionMock = mock.method(auth.api as any, "getSession", async () => ({
    user: { id: "u1" },
  }));

  const req = new NextRequest("http://localhost:3000/workspace");
  const result = await resolveTenant(req);
  assert.equal(result, "org-123");

  selectMock.mock.restore();
  sessionMock.mock.restore();
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

test("extractDiffInput accepts multipart uploads", async () => {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }), "candidate.pdf");

  const req = new NextRequest("https://example.com/api/pdf/diff", {
    method: "POST",
    body: form,
  });

  const result = await extractDiffInput(req);
  if ("response" in result) {
    assert.fail("Expected multipart payload to be parsed");
  }

  assert.equal(result.templateRef, ROTEIRO_TEMPLATE_FILE);
  assert.ok(result.bytes instanceof Uint8Array);
  assert.equal(result.bytes.length, 3);
});
