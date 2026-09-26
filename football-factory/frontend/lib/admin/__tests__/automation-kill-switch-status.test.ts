import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/admin/automation/kill-switch/route";
import { createSessionToken } from "@/lib/auth/session";

const secret = "diagnostic-test-auth-secret-value-32-bytes-min";
const originalAutomationEnabled = process.env.AUTOMATION_ENABLED;
const originalAuthSecret = process.env.AUTH_SECRET;
const originalSessionCookieName = process.env.SESSION_COOKIE_NAME;
process.env.AUTH_SECRET = secret;
process.env.SESSION_COOKIE_NAME = "ff_session";

after(() => {
  if (originalAutomationEnabled === undefined) delete process.env.AUTOMATION_ENABLED;
  else process.env.AUTOMATION_ENABLED = originalAutomationEnabled;
  if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalAuthSecret;
  if (originalSessionCookieName === undefined) delete process.env.SESSION_COOKIE_NAME;
  else process.env.SESSION_COOKIE_NAME = originalSessionCookieName;
});

const routeSource = readFileSync(
  join(process.cwd(), "app/api/admin/automation/kill-switch/route.ts"),
  "utf8",
);

function request(role?: "admin" | "editor" | "member"): Request {
  const headers = new Headers();
  if (role) {
    const token = createSessionToken(
      { userId: "diagnostic-test-user", role, email: "diagnostic@example.test" },
      secret,
      60,
    );
    headers.set("cookie", `ff_session=${token}`);
  }
  return new Request("https://www.ff90.online/api/admin/automation/kill-switch", { headers });
}

test("kill-switch diagnostic allows an authorized Admin only and disables caching", async () => {
  process.env.AUTOMATION_ENABLED = "true";

  const response = await GET(request("admin"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await response.json(), { state: "true" });
});

test("kill-switch diagnostic rejects unauthenticated and non-Admin requests", async () => {
  for (const req of [request(), request("editor"), request("member")]) {
    const response = await GET(req);
    assert.ok([401, 403].includes(response.status));
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const body = await response.text();
    assert.doesNotMatch(body, /AUTOMATION_ENABLED|diagnostic-test-auth-secret-value|diagnostic-test-user/);
  }
});

test("kill-switch diagnostic reports only the constrained runtime state at request time", async () => {
  const cases: Array<[string | undefined, string]> = [
    ["true", "true"],
    ["false", "false"],
    [undefined, "missing"],
    ["TRUE", "invalid"],
    ["secret-must-not-appear-in-output", "invalid"],
  ];

  for (const [value, expected] of cases) {
    if (value === undefined) delete process.env.AUTOMATION_ENABLED;
    else process.env.AUTOMATION_ENABLED = value;

    const response = await GET(request("admin"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const body = await response.json();
    assert.deepEqual(body, { state: expected });
    assert.deepEqual(Object.keys(body), ["state"]);
    assert.doesNotMatch(JSON.stringify(body), /secret-must-not-appear-in-output/);
  }
});

test("diagnostic has no logging or mutation dependencies", () => {
  assert.doesNotMatch(routeSource, /console\.|logger\.|getDb|DATABASE_URL|fetch\s*\(/);
  assert.match(routeSource, /requireAdmin\(request\)/);
  assert.match(routeSource, /process\.env\.AUTOMATION_ENABLED/);
  assert.match(routeSource, /cache-control.*no-store/i);
});
