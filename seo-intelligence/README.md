# FF90 SEO Intelligence Engine V1

Read-only keyword intelligence for the FF90 editorial workflow. This is a standalone Python 3.10+ module; it does **not** edit WordPress, Neon, or n8n. Publishing and production writes are **disabled**.

## Connectors

- **Google Search Console:** OAuth access token with `https://www.googleapis.com/auth/webmasters.readonly` and verified access to `sc-domain:ff90.online`. Supply `GSC_ACCESS_TOKEN` for each run (short-lived). Aggregates query/page clicks, impressions, CTR and position; by default uses 30 complete days ending three days ago. Up to 25,000 rows per request. No claim of exhaustive export where GSC omits anonymized or low-traffic queries.
- **Google Trends:** Official API access is limited to accepted alpha testers. **Do not scrape Trends or assume API credentials.** Import authorized/manual CSV as `keyword,interest,previous_interest`, with values 0..100 collected from the **same comparison context**; never mistake relative index for monthly search volume.
- **Ahrefs:** Official API v3 Keywords Explorer overview; needs `AHREFS_API_TOKEN`, eligible subscription and API units. Calls only with `--fetch-ahrefs` (max 40 keywords by default). Check costs and limits first. `--ahrefs-json` allows normalized offline data instead.

## Run

```bash
python seo-intelligence/engine.py --seed-file seo-intelligence/seeds.txt --output /tmp/ff90-seo.json
# with authorized sources:
GSC_ACCESS_TOKEN="..." AHREFS_API_TOKEN="..." python seo-intelligence/engine.py \
  --seed-file seo-intelligence/seeds.txt \
  --trends-csv /secure/google_trends.csv --fetch-ahrefs \
  --output /tmp/ff90-seo.json
# offline fixtures:
python seo-intelligence/engine.py --gsc-json seo-intelligence/tests/gsc.json \
  --ahrefs-json seo-intelligence/tests/ahrefs.json \
  --trends-csv seo-intelligence/tests/trends.csv \
  --output /tmp/ff90-seo.json
python -m unittest discover -s seo-intelligence/tests -v
```

Never commit secrets. Token provisioning should happen through secure environment / secret manager. Google Trends import requires human provenance and comparable ranges. Filter news intent and manually verify sources, dates, facts and copyright before creating drafts.

## Output contract

`schema_version`, `site`, `period`, `generated_at`, `source_status`, `warnings`, `approval_required=true`, `production_writes=false`, and `recommendations[]`.

Recommendations carry `sources`, `signals_available`, `score` (0..100 or null), and:
- `review_cannibalization`: same normalized query has multiple landing pages; inspect before changing canonical.
- `optimize_existing_page`: query already has a landing page; don't generate a competing draft.
- `propose_new_draft`: score >=55, at least two sources, no known page, **proposal only**.
- `research`: insufficient evidence; no automatic publication.

Scores are *heuristic prioritization*, not Google ranking predictions or traffic guarantees. Signals with missing data are excluded, not filled with fake values. Positions, impressions and CTR are source data; Ahrefs volume is an estimate. Do not conflate them.

## Release checklist / future integration

1. Validate real GSC property permissions, consent and pagination.
2. Validate Ahrefs subscription, response shapes, unit-budget guard, errors and throttling.
3. Request Google Trends official API access; until granted use reviewed CSV.
4. Add keyword-to-page topic clustering beyond exact normalized text and explicit duplicate URL controls.
5. Add n8n intake with schema validation, idempotency key, provenance, human approval and kill-switch default OFF.
6. Add reporting dashboard, weekly uplift checks, alerts and a staged non-production end-to-end test.

This V1 intentionally has **no scheduler**, no CMS API writes and no database migrations.
