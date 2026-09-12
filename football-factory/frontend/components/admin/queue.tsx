"use client";

// Football Factory — Admin queue client component (R2 Wave 2C).
//
// Loads /api/admin/editorial with search/stage/approvalState/sort/
// page/pageSize filters. Renders the editorial items list with
// pagination + per-row links to the detail page.
//
// All client-only state is isolated to this component; the
// surrounding server component provides the initial page shell.

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import type {
  EditorialListResponse,
  EditorialSortKey,
} from "@/lib/admin/contracts";
import { EMPTY_FILTERS, PAGE_SIZE_DEFAULT, SORT_KEYS } from "@/lib/admin/contracts";

export interface EditorialFiltersState {
  search: string;
  stage: string;
  approvalState: string;
  sort: EditorialSortKey;
  page: number;
  pageSize: number;
}

const INITIAL_FILTERS: EditorialFiltersState = {
  search: "",
  stage: "",
  approvalState: "",
  sort: "updated_at_desc",
  page: 1,
  pageSize: PAGE_SIZE_DEFAULT,
};

export function AdminQueue({
  initial,
}: {
  initial: EditorialListResponse | null;
}) {
  const [filters, setFilters] = useState<EditorialFiltersState>(INITIAL_FILTERS);
  const [data, setData] = useState<EditorialListResponse | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reload = useCallback(async (next: EditorialFiltersState) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.stage) params.set("stage", next.stage);
    if (next.approvalState) params.set("approvalState", next.approvalState);
    params.set("sort", next.sort);
    params.set("page", String(next.page));
    params.set("pageSize", String(next.pageSize));
    try {
      const r = await fetch(`/api/admin/editorial?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.status === 401) {
        setError("unauthenticated");
        setData(null);
        return;
      }
      if (!r.ok) {
        setError(`http_${r.status}`);
        return;
      }
      const body = (await r.json()) as EditorialListResponse;
      setData(body);
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void reload(filters);
    });
    // Intentionally only on filter change; reload is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="admin-shell admin-queue">
      <form
        className="admin-queue-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, page: 1 }));
        }}
      >
        <label>
          <span>Search</span>
          <input
            type="search"
            value={filters.search}
            maxLength={200}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="title or source_id"
          />
        </label>
        <label>
          <span>Stage</span>
          <input
            type="text"
            value={filters.stage}
            maxLength={64}
            onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
            placeholder="e.g. draft_created"
          />
        </label>
        <label>
          <span>Approval</span>
          <select
            value={filters.approvalState}
            onChange={(e) =>
              setFilters((f) => ({ ...f, approvalState: e.target.value }))
            }
          >
            <option value="">(any)</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sort: SORT_KEYS.includes(e.target.value as EditorialSortKey)
                  ? (e.target.value as EditorialSortKey)
                  : "updated_at_desc",
              }))
            }
          >
            <option value="updated_at_desc">Updated ↓</option>
            <option value="updated_at_asc">Updated ↑</option>
            <option value="created_at_desc">Created ↓</option>
            <option value="created_at_asc">Created ↑</option>
          </select>
        </label>
        <button
          type="submit"
          className="admin-button"
          disabled={loading}
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      </form>

      {error === "unauthenticated" ? (
        <p role="alert" className="admin-error">
          Not signed in. Sign in as admin/editor to view the queue.
        </p>
      ) : error ? (
        <p role="alert" className="admin-error">
          Failed to load queue: {error}.
        </p>
      ) : null}

      <table className="admin-table" aria-label="Editorial queue">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Stage</th>
            <th scope="col">Approval</th>
            <th scope="col">Rights</th>
            <th scope="col">WP Post</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="admin-empty">
                {loading ? "Loading…" : "No items."}
              </td>
            </tr>
          ) : (
            items.map((it) => {
              const meta =
                typeof it.metadata === "object" && it.metadata !== null
                  ? (it.metadata as Record<string, unknown>)
                  : {};
              const title =
                typeof meta.title === "string" ? meta.title : it.source_id;
              const rights = (meta.rights ?? {}) as Record<string, unknown>;
              const rightsState = rights.state
                ? String(rights.state)
                : "missing";
              return (
                <tr key={it.id}>
                  <td>
                    <Link href={`/admin/editorial/${it.id}`}>{title}</Link>
                  </td>
                  <td>
                    <span className={`admin-badge stage-${it.stage}`}>
                      {it.stage}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge approval-${it.approval_state}`}>
                      {it.approval_state}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge rights-${rightsState}${it.rights_confirmed ? " confirmed" : ""}`}
                    >
                      {rightsState}
                      {it.rights_confirmed ? " ✓" : ""}
                    </span>
                  </td>
                  <td>{it.wp_post_id ?? "—"}</td>
                  <td>
                    <time dateTime={it.updated_at}>{it.updated_at}</time>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <nav className="admin-pagination" aria-label="Pagination">
        <button
          type="button"
          className="admin-button"
          disabled={filters.page <= 1}
          onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
        >
          ← Prev
        </button>
        <span>
          Page {filters.page} of {totalPages} ({total} items)
        </span>
        <button
          type="button"
          className="admin-button"
          disabled={filters.page >= totalPages}
          onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
        >
          Next →
        </button>
      </nav>
    </div>
  );
}

void EMPTY_FILTERS;
