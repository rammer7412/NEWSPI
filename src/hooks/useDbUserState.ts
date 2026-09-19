"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearLegacyState, readLegacyState } from "@/lib/db/legacy-migration";
import { initialUserState } from "@/lib/storage";
import type { AnalyzedNews, HackEventState, IssueId, LongShortBet, LongShortDirection, LongShortSnapshot, MarketDirection, MarketImpact, MissionId, NewsArticle, ShopItemId, UserState } from "@/types";

type GameResponse = {
  ok: boolean;
  message?: string;
  state: UserState;
  applied?: boolean;
  migrationCompleted?: boolean;
  longShort?: LongShortSnapshot;
  settledBet?: LongShortBet | null;
  serverNow?: number;
};
type TradeResult = { ok: boolean; message: string };

async function requestGame(action: string, payload: Record<string, unknown> = {}): Promise<GameResponse> {
  const longShort = action === "ls_open" || action === "ls_settle";
  const get = action === "bootstrap" || action === "ls_settle";
  const response = await fetch(longShort ? "/api/long-short" : "/api/game", {
    method: get ? "GET" : "POST",
    headers: get ? undefined : { "Content-Type": "application/json" },
    body: get ? undefined : JSON.stringify(longShort ? payload : { action, payload }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as GameResponse | { message?: string } | null;
  if (!response.ok || !data || !("state" in data)) throw new Error(data?.message || "게임 서버에 연결하지 못했습니다.");
  return data;
}

async function ensureAnonymousSession() {
  const supabase = createClient();
  const run = async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error("익명 세션을 확인하지 못했습니다.");
    if (session) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) throw new Error("익명 세션을 갱신하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error("익명 접속을 시작하지 못했습니다. Supabase 익명 로그인을 확인해 주세요.");
  };
  // Two tabs opened together should share the cookie created by the first tab.
  if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("newspi-anonymous-auth", run);
  else await run();
}

export function useDbUserState() {
  const [state, setState] = useState<UserState>(initialUserState);
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsToNextTick, setSecondsToNextTick] = useState(60);
  const [longShort, setLongShort] = useState<LongShortSnapshot>({ active: null, recent: [] });
  const longShortRef = useRef(longShort);
  const [retry, setRetry] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingCount = useRef(0);
  const tickPending = useRef(false);
  const spinIdRef = useRef<string | null>(null);

  const install = useCallback((next: UserState) => {
    stateRef.current = next;
    setState(next);
    setSecondsToNextTick(Math.max(0, Math.ceil((next.nextMarketTickAt - Date.now()) / 1000)));
  }, []);

  const run = useCallback((action: string, payload: Record<string, unknown> = {}) => {
    const task = queue.current.catch(() => undefined).then(async () => {
      pendingCount.current += 1;
      setBusy(true);
      try {
        const result = await requestGame(action, payload);
        install(result.state);
        if (result.longShort) {
          const snapshot = { ...result.longShort, settledBet: result.settledBet, serverNow: result.serverNow, receivedAt: Date.now() };
          longShortRef.current = snapshot;
          setLongShort(snapshot);
        }
        if (!result.ok) setActionError(result.message || "요청을 처리하지 못했습니다.");
        else if (action !== "tick" && action !== "bootstrap") setActionError(null);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "게임 데이터를 저장하지 못했습니다.";
        setActionError(message);
        throw error;
      } finally {
        pendingCount.current -= 1;
        if (pendingCount.current === 0) setBusy(false);
      }
    });
    queue.current = task;
    return task;
  }, [install]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await ensureAnonymousSession();
        if (cancelled) return;
        let result = await requestGame("bootstrap");
        if (!result.migrationCompleted) {
          const legacy = readLegacyState();
          result = legacy ? await requestGame("migrate", { state: legacy }) : await requestGame("mark_migrated");
          if (!result.ok) throw new Error(result.message || "기존 데이터를 이전하지 못했습니다.");
          if (legacy && result.applied) clearLegacyState();
          if (legacy && !result.applied) {
            setActionError("서버에 진행 기록이 있어 기존 브라우저 기록을 덮어쓰지 않았습니다. 로컬 데이터는 보관했습니다.");
          }
        }
        const betResult = await requestGame("ls_settle").catch(() => null);
        if (!cancelled) {
          install(betResult?.state ?? result.state);
          if (betResult?.longShort) {
            const snapshot = { ...betResult.longShort, settledBet: betResult.settledBet, serverNow: betResult.serverNow, receivedAt: Date.now() };
            longShortRef.current = snapshot;
            setLongShort(snapshot);
          }
          setHydrated(true);
          setLoadingError(null);
        }
      } catch (error) {
        if (!cancelled) setLoadingError(error instanceof Error ? error.message : "게임 데이터를 불러오지 못했습니다.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [install, retry]);

  const syncMarket = useCallback(async () => {
    const now = Date.now();
    setSecondsToNextTick(Math.max(0, Math.ceil((stateRef.current.nextMarketTickAt - now) / 1000)));
    if (now < stateRef.current.nextMarketTickAt || tickPending.current) return;
    tickPending.current = true;
    try { await run("tick"); }
    catch { /* The error banner remains visible; the next interval retries. */ }
    finally { tickPending.current = false; }
  }, [run]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => { void syncMarket(); }, 1000);
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void run("ls_settle").then(() => syncMarket()).catch(() => {
        void run("bootstrap").catch(() => undefined);
      });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [hydrated, run, syncMarket]);

  const recordNewsView = useCallback(async (article: NewsArticle) => {
    const result = await run("record_view", { article });
    if (!result.ok) throw new Error(result.message);
  }, [run]);

  const registerAnalysis = useCallback(async (article: NewsArticle, analysis: AnalyzedNews, available: boolean): Promise<HackEventState> => {
    const result = await run("register_analysis", { articleId: article.id, analysis, available });
    if (!result.ok) throw new Error(result.message);
    return result.state.hackEvents[article.id] ?? { active: false, resolved: false };
  }, [run]);

  // register_analysis saves the same analysis in the DB in the same transaction.
  const cacheAnalysis = useCallback(async (_id: string, _analysis: AnalyzedNews) => {
    void _id;
    void _analysis;
  }, []);

  const spendRouletteCoins = useCallback(async (): Promise<boolean> => {
    const spinId = crypto.randomUUID();
    const result = await run("spend_roulette", { spinId });
    if (result.ok && result.applied) { spinIdRef.current = spinId; return true; }
    return false;
  }, [run]);

  const refundRouletteCoins = useCallback(async () => {
    const spinId = spinIdRef.current;
    if (spinId) await run("refund_roulette", { spinId });
  }, [run]);

  const earnHappyCoin = useCallback(async (typedText: string): Promise<TradeResult> => {
    const result = await run("happy", { text: typedText });
    return { ok: result.ok && !!result.applied, message: result.ok ? "잘 적었어요. 1 C가 보유 코인에 추가됐습니다." : result.message || "문장을 다시 확인해 주세요." };
  }, [run]);

  const recordWrongAttempt = useCallback(async (id: string, selectedIndex: number) => {
    const result = await run("wrong_quiz", { articleId: id, selectedIndex });
    if (!result.ok) throw new Error(result.message);
  }, [run]);

  const awardQuiz = useCallback(async (id: string, selectedIndex: number): Promise<number> => {
    const before = stateRef.current.coins;
    const result = await run("award_quiz", { articleId: id, selectedIndex });
    if (!result.ok || !result.applied) throw new Error(result.message || "이미 처리된 퀴즈입니다.");
    return Math.round((result.state.coins - before) * 100) / 100;
  }, [run]);

  const buy = useCallback(async (id: IssueId, quantity: number): Promise<TradeResult> => {
    await syncMarket();
    const result = await run("buy", { assetId: id, quantity });
    return { ok: result.ok && !!result.applied, message: result.message || (result.ok ? `${quantity}주를 매수했습니다.` : "매수할 수 없습니다.") };
  }, [run, syncMarket]);

  const sell = useCallback(async (id: IssueId, quantity: number): Promise<TradeResult> => {
    await syncMarket();
    const result = await run("sell", { assetId: id, quantity });
    return { ok: result.ok && !!result.applied, message: result.message || (result.ok ? `${quantity}주를 매도했습니다.` : "매도할 수 없습니다.") };
  }, [run, syncMarket]);

  const applyNewsImpact = useCallback(async (articleId: string, impact: MarketImpact) => {
    const before = stateRef.current.market[impact.relatedIssue].currentPrice;
    const result = await run("apply_impact", { articleId });
    return { applied: !!result.applied, before, after: result.state.market[impact.relatedIssue].currentPrice };
  }, [run]);

  const resolveHack = useCallback(async (articleId: string, _impact: MarketImpact, selectedIssue?: IssueId,
    selectedDirection?: MarketDirection, betAmount = 0) => {
    const result = await run("resolve_hack", { articleId, selectedIssue, selectedDirection, betAmount });
    return { ok: result.ok && !!result.applied,
      message: result.ok ? (betAmount ? "예측이 정산되고 분석이 공개됐습니다." : "베팅 없이 분석이 복구됐습니다.") : result.message || "예측을 완료하지 못했습니다.",
      prediction: result.state.hackEvents[articleId]?.prediction };
  }, [run]);

  const openLongShort = useCallback(async (assetId: IssueId, direction: LongShortDirection,
    stakeChoice: "10" | "25" | "50" | "MAX"): Promise<TradeResult> => {
    const result = await run("ls_open", { assetId, direction, stakeChoice, requestId: crypto.randomUUID() });
    return { ok: result.ok && !!result.applied && !!result.longShort?.active,
      message: result.message || (result.ok ? "60초 예측을 시작했습니다." : "베팅을 시작하지 못했습니다.") };
  }, [run]);

  // Settles the current bet on the server once it is due; returns the settled
  // bet so the UI can show the result modal, or null when nothing settled yet.
  const settleLongShort = useCallback(async (): Promise<LongShortBet | null> => {
    const activeId = longShortRef.current.active?.id ?? null;
    const result = await run("ls_settle");
    return result.settledBet ?? (activeId && result.longShort
      ? result.longShort.recent.find((bet) => bet.id === activeId) ?? null : null);
  }, [run]);

  const claimMission = useCallback(async (id: MissionId) => {
    const result = await run("claim_mission", { missionId: id });
    return result.ok && !!result.applied;
  }, [run]);

  const claimAllMissions = useCallback(async () => {
    const result = await run("claim_all");
    return result.ok && !!result.applied;
  }, [run]);

  const purchaseItem = useCallback(async (id: ShopItemId): Promise<TradeResult> => {
    const result = await run("shop_purchase", { itemId: id });
    return { ok: result.ok && !!result.applied,
      message: result.message || (result.ok ? "구매했습니다. 보관함에서 장착할 수 있어요." : "상품을 구매하지 못했습니다.") };
  }, [run]);

  const equipItem = useCallback(async (id: ShopItemId): Promise<TradeResult> => {
    const result = await run("shop_equip", { itemId: id });
    return { ok: result.ok && !!result.applied,
      message: result.message || (result.ok ? "새 아이템을 장착했습니다." : "아이템을 장착하지 못했습니다.") };
  }, [run]);

  const reset = useCallback(async () => {
    const result = await run("reset");
    if (!result.ok) throw new Error(result.message);
    clearLegacyState();
  }, [run]);

  return { state, hydrated, loadingError, actionError, busy, retryLoad: () => setRetry((value) => value + 1),
    secondsToNextTick, recordNewsView, registerAnalysis, cacheAnalysis, spendRouletteCoins, refundRouletteCoins,
    earnHappyCoin, recordWrongAttempt, awardQuiz, buy, sell, applyNewsImpact, resolveHack, claimMission,
    claimAllMissions, purchaseItem, equipItem, reset, longShort, openLongShort, settleLongShort };
}
