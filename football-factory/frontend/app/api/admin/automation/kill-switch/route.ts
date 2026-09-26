import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "cache-control": "no-store, max-age=0" };

type AutomationEnabledState = "true" | "false" | "missing" | "invalid";

function readAutomationEnabledState(): AutomationEnabledState {
  const value = process.env.AUTOMATION_ENABLED;
  if (value === undefined) return "missing";
  if (value === "true") return "true";
  if (value === "false") return "false";
  return "invalid";
}

export async function GET(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { state: readAutomationEnabledState() },
    { status: 200, headers: NO_STORE },
  );
}
