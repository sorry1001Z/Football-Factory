# FF90 Automation Bridge (WordPress module)
Status: initial source-backed REST bridge; no external live integration tested.

## Responsibilities
n8n owns source intake, fact check, duplicate screening, MiniMax writing, image selection/rights QA and retry. This plugin receives the approved **draft payload only**, authenticates via existing WordPress Application Password over HTTPS and saves a **draft**, never publishing. Hermes is the development/operator agent; Qwen3/Ollama optional dev fallback. Other 5 GitHub repos are reference patterns only and NOT vendored.

## Install safely
Copy `wordpress-plugins/ff90-automation-bridge` to **staging** `wp-content/plugins/`. Activate. Bridge remains disabled. After backup, confirming correct staging site identity, restricting an integration account to minimum permissions, configure `define('FF90_BRIDGE_ENABLED', true);` in staging wp-config.php ONLY. Never deploy directly to production. Call `POST /wp-json/ff90/v1/drafts` with Basic Authentication using a scoped WordPress Application Password over HTTPS. Confirm account cannot publish. Plugin checks `edit_posts`. Keep credentials outside repository.

## JSON contract
```json
{
  "source_id":"ff90:event:sample-001",
  "source_url":"https://example.org/source-story",
  "source_title":"Verified original source headline",
  "title":"ตัวอย่างพาดหัวข่าว",
  "content_html":"<p>เนื้อหาข่าวอิงแหล่งข้อมูลที่ยืนยันแล้ว</p>",
  "facts_verified":true,
  "asset_type":"none",
  "rights_confirmed":false
}
```
Images are optional at this intake stage. For an already uploaded *verified* WordPress image use `asset_type:licensed_photo` or `original_graphic`, `rights_confirmed:true`, `image_license`, `image_source_url`, `image_author`, and `media_id`. Plugin does not download untrusted remote images. A metadata declaration alone is not proof; n8n/human rights QA must verify before submission.

## Safety / implementation next steps
- Kill switch OFF until operator enables staging explicitly.
- Needs integration tests for race/idempotency, metadata editing, hostile HTML/URL, WP role isolation and run audit; current smoke tests NOT_RUN.
- WordPress draft status does not itself prevent authorized humans or other plugins from publishing. Use separate least-privilege integration account and editorial approval.
- Build additional modules later: source connector, license-verification, SVG/Sharp graphic renderer, SEO, audit and retries. Do not enable active n8n jobs.
