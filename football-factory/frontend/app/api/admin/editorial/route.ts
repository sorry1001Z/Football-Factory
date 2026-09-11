// Football Factory — GET /api/admin/editorial (FIRST SLICE / 003)
//
// Lists editorial items for the human-approval workflow.
// Default state filter: pending. Editor/admin only. CSRF not required
// (GET is read-only).

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  state: z.enum(["pending", "approved", "rejected"]).optional().default("pending"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(request: Request) {
  const g = requireAdminOrEditor(request);
  const resp = guardResponse(g);
  if (resp !== null) return resp;

  const url = new URL(request.url);
  const q = QuerySchema.safeParse({
    state: url.searchParams.get("state") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!q.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }

  const repo = new EditorialRepository(getDb());
  const items = await repo.listByApprovalState(q.data.state, q.data.limit);
  return NextResponse.json(
    {
      ok: true,
      state: q.data.state,
      count: items.length,
      items,
    },
    { status: 200 },
  );
}
