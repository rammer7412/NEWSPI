import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { validateLegacyState } from "@/lib/db/legacy-migration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

async function execute(action: string, payload: Record<string, unknown>) {
  if (!isSupabaseConfigured) return NextResponse.json({ message: "Local Demo Mode에서만 이용할 수 있습니다." }, { status: 503, headers: noStore });
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: "인증을 다시 시도해 주세요." }, { status: 401, headers: noStore });
    if (action === "migrate") {
      try { payload = { state: validateLegacyState(payload.state) }; }
      catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "기존 데이터를 확인할 수 없습니다." }, { status: 400, headers: noStore }); }
    }
    const { data, error } = await supabase.rpc("newspi_game_action", { p_action: action, p_payload: payload });
    if (error || !data) return NextResponse.json({ message: "게임 데이터를 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 503, headers: noStore });
    return NextResponse.json(data, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "게임 서버에 연결하지 못했습니다. 다시 시도해 주세요." }, { status: 503, headers: noStore });
  }
}

export async function GET() {
  return execute("bootstrap", {});
}

export async function POST(request: NextRequest) {
  let body: { action?: unknown; payload?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 1_000_000) return NextResponse.json({ message: "요청 데이터가 너무 큽니다." }, { status: 413, headers: noStore });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "요청을 읽을 수 없습니다." }, { status: 400, headers: noStore });
  }
  const allowed = ["migrate", "mark_migrated", "reset", "spend_roulette", "refund_roulette", "record_view",
    "register_analysis", "wrong_quiz", "award_quiz", "happy", "buy", "sell", "tick", "apply_impact",
    "resolve_hack", "claim_mission", "claim_all"];
  if (!body || typeof body !== "object" || typeof body.action !== "string" || !allowed.includes(body.action) ||
    !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return NextResponse.json({ message: "올바른 게임 요청이 필요합니다." }, { status: 400, headers: noStore });
  }
  return execute(body.action, body.payload as Record<string, unknown>);
}
