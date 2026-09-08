// Football Factory — /api/health/wordpress (Phase 2)
// Safe diagnostic for the WordPress integration. Does NOT perform an
// external probe on every request (that would be expensive and slow
// the health endpoint). Default response is "configured" booleans only.
//
// Optional ?probe=1 forces a single bounded GET against the
// WPGraphQL endpoint and reports reachability.

import { NextResponse } from "next/server";
import { WordPressClient } from "@/lib/wordpress/client";
import { WordPressClientError } from "@/lib/wordpress/client";

export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 4000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const doProbe = url.searchParams.get("probe") === "1";

  const client = new WordPressClient();
  const body: Record<string, unknown> = {
    ok: true,
    provider: "wpgraphql",
    configured: client.configured,
    endpoint_host: client.endpoint_host,
    reachable: null,
  };

  if (doProbe && client.configured) {
    try {
      await client.request({
        query: "{ __typename }",
        timeout_ms: PROBE_TIMEOUT_MS,
      });
      body.reachable = true;
    } catch (err) {
      if (err instanceof WordPressClientError) {
        body.reachable = false;
        body.reason = err.kind;
      } else {
        body.reachable = false;
        body.reason = "UNKNOWN";
      }
    }
  }

  return NextResponse.json(body, { status: 200 });
}
