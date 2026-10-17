# SEO WordPress port — 0.2.0 scope and V3 comparison

Current scope and known differences: see **MODULES_TH.md**. This supersedes
0.1.0's incomplete implementation inventory. These are independent plugins,
not a claim that an external product named SEO V4 is complete.

## Implemented from the previously identified missing capabilities

- `Intent.php`: weighted rules, negative phrases, locale, minimum confidence,
  deterministic ties, ambiguity, NFKC with PHP intl. Framework independent.
- `Quality.php`: V3 title/meta/heading/content/sentence/paragraph/stuffing/repeated
  phrase/freshness/provenance/schema/image/internal/external/duplicate policies,
  issue severities, recommendations and signals. Original Thai cluster heuristic.
- `Schema.php`: graph structure/duplicate IDs/references, safe depth bound.
- `ff90-seo-football`: V3 seed identities and intent rules in a separate package;
  explicit registry relations and advisory schema; real verified WordPress term
  landing pages rather than fabricated Next.js route assumptions.
- `ff90-seo-gsc`: separate OAuth code+PKCE/state/session validation, readonly scope,
  encrypted nonautoloaded per-site token options, refresh lock, selected property
  verification, query/page Search Analytics, admin UI and authenticated REST,
  disconnect+revocation. No SDK/Node requirement or production mock data.

## Reference evidence

`tests/export-v3.cjs` reads the unmodified TypeScript implementation and generates
47 reference cases: 20 deep-quality cases, 19 intent cases including Thai and
fullwidth Unicode, 8 schema cases. `tests/parity.php` compares complete quality
output and intent output; schema comparisons cover validity and issue codes,
allowing explanatory wording differences. Not an exhaustive proof over all input.

47/47 pass under PHP 8.4 with Intl. Additional WordPress contracts test adapters,
server permissions, post metadata, link protection and UTF-16 offsets. GSC tests
use explicitly named HTTP doubles, not live Google credentials or authorization.

## Retained behavior and deliberate adaptations

Native WordPress title/canonical/permalink/meta/robots/editor APIs remain in use.
Advisory output is default; standalone ownership is opt-in, with recognized SEO
plugin suppression and exact known Core schema coordination. Thai/score advice
alone never becomes a publishing veto. Generated article schema uses actual
native dates, authors and attachment URLs. Football suggestions do not silently
claim current squads/matches or insert entity graphs into public HTML.

Full canonical semantics intentionally differ from V3: stricter origin checks,
no external override allowlist, WordPress identity query preservation and trailing
slash retention. WP gate final-state enforcement is not a transactional approval
security perimeter. Unknown SEO plugins must declare external ownership or keep
advisory mode. Full-page caches require explicit invalidation integration.

The V3 GSC opportunity classifier/aggregate helpers and a full external SEO V4
specification are not claimed as completed here. GSC API now supports actual
read-only data once the operator supplies OAuth/consent/property access; actual
Google verification is still NOT_RUN. No ordinary-news Google Indexing API.
