# FF90 shared configuration, training examples and QC contract
Status: integration design; staging E2E NOT_RUN

## Single source of truth
Do NOT create a separate training corpus, writing style guide, hero-picture policy, category mapping, SEO rubric or QA rubric for this plugin. Reuse already-approved FF90 settings, prompts, examples, workflows and artifacts, without copying secrets or configuring a competing SEO writer.

- Existing n8n: `football-factory/automation/n8n/workflows/FF90-MASTER.json` and FF90-01 through FF90-05.
- Existing contracts: `contracts/editorial.schema.json`, `image.schema.json`, `review.schema.json`, `quality-metrics.schema.json`, `pipeline-envelope.schema.json`.
- FF90 website/image/SEO policies: `docs/FF90_WEB_IMAGE_SKILLS.md` and `docs/FF90_HERMES_TASK.md`.
- Content training/examples: use canonical FF90 editorial-approved examples and existing prompt-factory location discovered by Codex; DO NOT pretend model weights were trained. Record source/version/hash of template and prompt per article. No invented dataset paths.
- SEO: existing SEO Growth V4 plugin is the sole owner for canonical, meta and JSON-LD where installed; do not add competing SEO output/head tags. Plugin accepts advice from existing FF90 SEO check, never sets SEO PASS itself.
- Pictures: match existing FF90 1280x720, 16:9, safe-area at least 64 px, Thai line wrapping and 13 category design rules. Separate licensed photo from original graphic; keep source author, source URL, original URL, license, attribution and alt text. Cover relevance and rights are independent gates; no generic Matchday/insignia placeholders as substitute for event photo.
- Existing News types: RESULT, PREVIEW, ANALYSIS, TRANSFER, BREAKING. Existing FF90 main categories can map these independently. Never create fake scores, logos or player identity.

## One QC, not two
Use FF90-05 review QC vocabulary **unaltered**:
`qa_article`, `qa_fact`, `qa_seo`, `qa_cover`, `qa_image_rights`, `qa_wp_draft`, `qa_desktop`, `qa_mobile`
Allowed values exactly PASS / FAIL / HOLD / NOT_CONFIGURED.

Pre-draft gate requires article/fact/seo PASS from the existing trusted server-side pipeline. A created draft with missing cover may be held for human review (qa_cover=HOLD and qa_image_rights=HOLD), not treated as complete or publishable. Attachment only if qa_cover=PASS and qa_image_rights=PASS, with provenance. Post-draft FF90-05 must execute WP draft/desktop/mobile checks and preserve human approval; those cannot be pre-certified by this plugin. A client-provided PASS string alone is not independently trusted verification: the production adapter must fetch/revalidate server-side QC by run_id/editorial_item_id, or use signed internal FF90 evidence, before enabling bridge. Do NOT switch on `FF90_BRIDGE_ENABLED` until this check is implemented and tested.

Review metrics use existing `quality-metrics.schema.json`: human_edited_title, human_edited_body, human_changed_image, human_changed_seo, human_changed_fact, human_rejected, critical_error. Never auto-switch publishing due to metrics.

## Existing WP pathway
`FF90-04-wordpress-draft.json` already calls `/api/automation/wp-draft` and `/api/automation/media` with `x-automation-secret`; it has idempotency through `run_id` and editorial ID. Do not reroute active FF90-04 to the new WordPress plugin without a staged compatibility/migration plan. Bridge's `/wp-json/ff90/v1/drafts` is an **optional future target** and not a drop-in endpoint: request field names, credential scheme and recovery IDs differ. Prefer existing route until end-to-end parity is proven.

## Acceptance tests before enabling
1. Compare sample FF90 editorial envelopes with plugin-mapped request; exact run_id, editorial_item_id, source_id, news_type, image metadata preserved.
2. Test all eight FF90 QC signals, HOLD, FAIL, NOT_CONFIGURED; no bypass by user-supplied PASS; receipt signed/trusted server-side.
3. Verify FF90 SEO meta/JSON-LD singleton and 13 graphics individually for wrapping, overflow, 1280x720 and rights records.
4. Confirm duplicate replays/retries/recovery don't create multiple drafts or lose existing editorial identity.
5. Real staging WP tests: auth (least-privilege), disabled switch, 403, 422, idempotence, error recovery and no public publish.
6. Verify 40 draft-only dry runs and production unchanged.
7. Log PASS/FAIL/NOT_RUN truthfully; keep kill-switch OFF until explicit operator authorization.

## Current bridge implementation caveats
The plugin endpoint currently accepts QA values supplied by the caller. Therefore it is NOT yet secure enough to trust external QA claims. It does not implement full FF90 settings retrieval, server-verified QC, prompt-version hash, renderer, SEO Growth V4 integration, UI or end-to-end tests. It is a staging-only scaffold. Do not turn on the bridge or redirect n8n yet.
