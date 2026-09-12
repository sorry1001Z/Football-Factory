// Football Factory — GET /api/admin/editorial (R2 Wave 2C)
//
// Filtered + paginated + sorted list for the human-approval UI.
//
// Query params (all optional):
//   search       : substring match against metadata.title / source_id
//   stage        : exact editorial stage (e.g. "draft_created")
//   approvalState: pending | approved | rejected
//   sort         : updated_at_desc (default) | updated_at_asc |
//                  created_at_desc | created_at_asc
//   page         : 1-based page index, default 1
//   pageSize     : default 25, capped at 100
//
// Auth: session + admin/editor role only. CSRF not required (GET).
//
// All filter values are bound as parameters. Sort key is a
// deterministic whitelist. No raw SQL fragments from user input.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { buildSearchFragment } from "@/lib/admin/adapter";
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  SORT_KEYS,
  type EditorialSortKey,
  type EditorialListResponse,
} from "@/lib/admin/contracts";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  search: z.string().max(200).optional().default(""),
  stage: z.string().max(64).optional().default(""),
  approvalState: z
    .string()
    .max(64)
    .refine((v) => v === "" || v === "pending" || v === "approved" || v === "rejected", {
      message: "approvalState must be pending|approved|rejected",
    })
    .optional()
    .default(""),
  sort: z
    .enum(SORT_KEYS as unknown as [EditorialSortKey, ...EditorialSortKey[]])
    .optional()
    .default("updated_at_desc"),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .optional()
    .default(PAGE_SIZE_DEFAULT),
});

export async function GET(request: Request) {
  const g = requireAdminOrEditor(request);
  const resp = guardResponse(g);
  if (resp !== null) return resp;

  const url = new URL(request.url);
  const q = QuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    approvalState: url.searchParams.get("approvalState") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!q.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }

  const { search, stage, approvalState, sort, page, pageSize } = q.data;
  const searchFragment = buildSearchFragment(search);
  const offset = (page - 1) * pageSize;

  const repo = new EditorialRepository(getDb());
  const { items, total } = await repo.listFiltered({
    stage: stage || null,
    approvalState: (approvalState || null) as
      | "pending"
      | "approved"
      | "rejected"
      | null,
    searchFragment,
    sortKey: sort,
    limit: pageSize,
    offset,
  });

  const body: EditorialListResponse = {
    ok: true,
    items,
    total,
    page,
    pageSize,
    sort,
    filters: {
      stage: stage || null,
      approvalState: (approvalState || null) as
        | "pending"
        | "approved"
        | "rejected"
        | null,
      rights: null, // not filterable via SQL until column exists
      fact: null,
      search: search || null,
    },
  };
  return NextResponse.json(body, { status: 200 });
}
