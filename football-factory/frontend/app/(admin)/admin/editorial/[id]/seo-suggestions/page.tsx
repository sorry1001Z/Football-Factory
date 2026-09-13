// Football Factory — /admin/editorial/[id]/seo-suggestions page
// (Set #3 Wave D).
//
// Read-only, advisory SEO suggestions panel. Wraps the existing
// editorial admin shell + the SEO suggestions view-model. NEVER
// mutates state, NEVER writes to the publish gate, NEVER rewrites
// titles, NEVER auto-inserts links.

import "server-only";
import { notFound } from "next/navigation";
import { AdminShellHeader } from "@/components/admin/shell-header";
import {
  buildSeoOverview,
  GSC_OPPORTUNITY_TYPES,
  identityStatusFor,
  mutationCapabilities,
  panelState,
} from "@/lib/admin/seo-suggestions/view-model";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO suggestions · Editorial · Admin · Football Factory",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Empty advisory payload — production wiring (via existing
// lib/seo-v3/index.ts barrel) is deferred. The page renders a
// deterministic empty state with the capability / opportunity
// whitelists exposed for ops clarity.
const EMPTY_ADVISORY = {
  quality: {},
  intent: {},
  internalLinks: [],
  gsc: [],
  entities: { teams: [], competitions: [], players: [], matches: [] },
};

export default async function AdminEditorialSeoSuggestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }
  const overview = buildSeoOverview(EMPTY_ADVISORY);
  const state = panelState(EMPTY_ADVISORY);
  const caps = mutationCapabilities();

  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin/editorial" />
      <main className="admin-shell-main">
        <h1>SEO suggestions</h1>

        <section aria-label="panel-state" data-state={state.kind}>
          {state.kind === "loading" && <p>Loading…</p>}
          {state.kind === "empty" && (
            <p>No SEO advisory data available for this item yet.</p>
          )}
          {state.kind === "error" && (
            <p role="alert" className="admin-error">
              {state.message ?? "Unknown error."}
            </p>
          )}
        </section>

        <section aria-label="capabilities">
          <p>
            Mutation capabilities: canAutoEdit=
            {String(caps.canAutoEdit)} · canAutoInsertLink=
            {String(caps.canAutoInsertLink)} · canRewriteTitle=
            {String(caps.canRewriteTitle)} · canPublish=
            {String(caps.canPublish)} · canModifyPublishGate=
            {String(caps.canModifyPublishGate)}
          </p>
          <p className="admin-help">
            All mutation capabilities are disabled in this read-only
            view-model. The existing SEO V3 + FootballSeoAdapter
            remain authoritative. Publish gate is unchanged.
          </p>
        </section>

        <section aria-label="quality">
          <h2>Quality</h2>
          <ul>
            <li>Score: {overview.quality.score}</li>
            <li>Publish blocking: {String(overview.quality.publishBlocking)}</li>
            <li>Blocking issues: {overview.quality.blockingIssues.length}</li>
            <li>Warnings: {overview.quality.warnings.length}</li>
            <li>Opportunities: {overview.quality.opportunities.length}</li>
          </ul>
        </section>

        <section aria-label="intent">
          <h2>Intent</h2>
          <ul>
            <li>Intent: {overview.intent.intent}</li>
            <li>Confidence: {overview.intent.confidence}</li>
            <li>Low confidence: {String(overview.intent.lowConfidence)}</li>
            <li>Landing page type: {String(overview.intent.landingPageType)}</li>
          </ul>
        </section>

        <section aria-label="internal-links">
          <h2>Internal link suggestions</h2>
          {overview.internalLinks.length === 0 ? (
            <p>No suggestions.</p>
          ) : (
            <ul>
              {overview.internalLinks.map((x, idx) => (
                <li key={`${x.target}-${idx}`}>
                  {x.anchor} → {x.target} ({x.reason}, conf={x.confidence},
                  selected={String(x.selected)})
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="gsc-opportunities">
          <h2>GSC opportunities</h2>
          <p>
            Supported types ({GSC_OPPORTUNITY_TYPES.length}):{" "}
            {GSC_OPPORTUNITY_TYPES.join(", ")}
          </p>
          {overview.gsc.length === 0 ? (
            <p>No opportunities.</p>
          ) : (
            <ul>
              {overview.gsc.map((x, idx) => (
                <li key={`${x.type ?? "unknown"}-${idx}`}>
                  {String(x.type ?? "UNKNOWN")} — priority=
                  {String(x.priority ?? "?")} · confidence=
                  {String(x.confidence ?? "?")} · rankingGuarantee=
                  {String(x.rankingGuarantee)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="entities">
          <h2>Entity context</h2>
          <ul>
            <li>Teams: {overview.entities.teams.length}</li>
            <li>Competitions: {overview.entities.competitions.length}</li>
            <li>
              Players: {overview.entities.players.length} (resolved=
              {overview.entities.players.filter(
                (p) => identityStatusFor(p) === "resolved",
              ).length}
              , deferred=
              {overview.entities.players.filter(
                (p) => identityStatusFor(p) === "deferred_unresolved",
              ).length})
            </li>
            <li>
              Matches: {overview.entities.matches.length} (resolved=
              {overview.entities.matches.filter(
                (m) => identityStatusFor(m) === "resolved",
              ).length}
              , deferred=
              {overview.entities.matches.filter(
                (m) => identityStatusFor(m) === "deferred_unresolved",
              ).length})
            </li>
          </ul>
        </section>

        <p>
          <a href={`/admin/editorial/${id}`}>← back to editorial item</a>
        </p>
      </main>
    </div>
  );
}