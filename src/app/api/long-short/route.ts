import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ISSUE_IDS, type IssueId, type LongShortBet, type LongShortDirection } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
type BetRow = {
  id: string; asset_id: IssueId; direction: LongShortDirection; stake: number;
  entry_price: number; exit_price: number | null; payout: number | null;
  status: LongShortBet["status"]; opened_at: string; expires_at: string; settled_at: string | null;
};
type RpcResult = {
  ok: boolean; message?: string; state?: unknown; applied?: boolean; serverNow?: number;
  activeBet?: BetRow | null; recentBets?: BetRow[]; settledBet?: BetRow | null;
};

function rpcFailure(code?: string) {
  const known: Record<string, string> = {
    PGRST202: "롱·숏 DB 함수를 찾지 못했습니다. SQL 마이그레이션과 스키마 캐시를 확인해 주세요.",
    "42P01": "롱·숏 DB 테이블이 없습니다. Supabase SQL 마이그레이션을 적용해 주세요.",
    "42703": "롱·숏 DB 구조가 현재 코드와 다릅니다. SQL 마이그레이션을 확인해 주세요.",
    "42883": "롱·숏 DB 함수가 없습니다. Supabase SQL 마이그레이션을 확인해 주세요.",
    "42501": "롱·숏 DB 접근 권한을 확인해 주세요.",
  };
  return NextResponse.json({
    message: known[code || ""] || "예측 서버에 연결하지 못했습니다. 서버의 DB 오류 코드를 확인해 주세요.",
    errorCode: known[code || ""] ? code : "RPC_ERROR",
  }, { status: 503, headers });
}

function toBet(row: BetRow): LongShortBet {
  return {
    id: row.id, assetId: row.asset_id, direction: row.direction, stake: row.stake,
    entryPrice: Number(row.entry_price), exitPrice: row.exit_price === null ? null : Number(row.exit_price),
    payout: row.payout, status: row.status,
    openedAt: Date.parse(row.opened_at), expiresAt: Date.parse(row.expires_at),
    settledAt: row.settled_at ? Date.parse(row.settled_at) : null,
  };
}

async function execute(action: "status" | "open", payload: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured) return NextResponse.json({ message: "Supabase 연결 후 이용할 수 있습니다." }, { status: 503, headers });
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: "인증을 다시 시도해 주세요." }, { status: 401, headers });
    const { data, error } = await supabase.rpc("newspi_long_short_action", {
      p_action: action, p_payload: payload,
    });
    if (error) {
      console.error("Long/short RPC failed:", error.code || "UNKNOWN");
      return rpcFailure(error.code);
    }
    if (!data) return rpcFailure("EMPTY_RESULT");
    const result = data as RpcResult;
    return NextResponse.json({
      ok: result.ok, message: result.message || "", applied: result.applied,
      state: result.state, serverNow: result.serverNow,
      longShort: {
        active: result.activeBet ? toBet(result.activeBet) : null,
        recent: (result.recentBets || []).map(toBet),
      },
      settledBet: result.settledBet ? toBet(result.settledBet) : null,
    }, { headers });
  } catch {
    return rpcFailure("NETWORK_ERROR");
  }
}

export async function GET() {
  return execute("status");
}

export async function POST(request: NextRequest) {
  let body: { assetId?: unknown; direction?: unknown; stakeChoice?: unknown; requestId?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 1000) return NextResponse.json({ message: "요청이 너무 큽니다." }, { status: 413, headers });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "요청을 읽을 수 없습니다." }, { status: 400, headers });
  }
  if (!body || !ISSUE_IDS.includes(body.assetId as IssueId) ||
    !["LONG", "SHORT"].includes(body.direction as string) ||
    !["10", "25", "50", "MAX"].includes(body.stakeChoice as string) ||
    typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    return NextResponse.json({ message: "이슈, 방향, 베팅 금액을 확인해 주세요." }, { status: 400, headers });
  }
  return execute("open", {
    assetId: body.assetId, direction: body.direction, stakeChoice: body.stakeChoice, requestId: body.requestId,
  });
}
