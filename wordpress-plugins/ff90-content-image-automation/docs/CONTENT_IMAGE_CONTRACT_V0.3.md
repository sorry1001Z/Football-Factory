# FF90 Content & Image Contract v0.3 — draft-safe integration

## Confirmed editorial basis
- FF90 Sports Editorial V2.5.2, STANDARD: 2,500–3,500 Thai characters (count non-whitespace Unicode characters in body after HTML removal). Other article types **not inferred** from proposed category ranges.
- H1/lead/H2/headline/source/fact rules require source-grounded full editorial QA. The sample SEO meta 120–160 chars is a target, not proof of acceptance for all kinds of news.
- 40 articles/day is a *target*, not an active scheduler.

## Approved latest image override
- 1 clean master per story. Decorated Hero output: **1200×675**. Featured image uses the hero approved by the editor.
- Card: **640×360**, derived from the same image; preview also at **320×180**.
- Evaluate headline, category, text clipping and safe areas at both display widths.
- If unreadable, missing QA evidence, or uncertain: select **clean master** without embedded headline or category label. WordPress HTML title outside the image remains intact.
- Clean master is preserved **before** adding text; do not erase text from flattened banner.
- If rights or visual QA are not PASS or clean master missing: HOLD.
- Need rights allowing derivatives/crops, not merely rights to view source image.
- Routing by article_type, then category; unknown type must never default to INSIDE MATCHDAY.
- `card_decision` selects assets; image pixel rendering, automatic visual readability detection and WordPress media upload are **not implemented** in this version. The `readability` flags must come from independent checks, not from AI self-certification.

## Production remains blocked
- Queue OFF, Auto Publish OFF, Kill Switch ON; no scheduler, enqueue, create/post/publish APIs.
- REST preflight always returns 422. Validating metadata alone does not verify facts, rights, image pixels or SEO rendering.
- Verify WordPress active theme conflict: 2026-10-17 blueprint mentioned 1280×720, later submitted editorial/image spec explicitly requests 1200×675. Need integration/thumbnail tests before deployment.
- Exact live SEO plugin mapping, QC profile selection, Neon migrations and MiniMax authentication remain unverified.

## Executable local tests
`php tests/test-validation.php` and `php -l` on all PHP files.
