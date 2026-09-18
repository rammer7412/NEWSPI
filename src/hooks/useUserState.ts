"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceMarketTicks, applyIssueImpact } from "@/lib/market";
import { initialUserState, loadUserState, saveUserState } from "@/lib/storage";
import { HAPPY_PHRASES, normalizeHappyPhrase } from "@/data/happy-phrases";
import type { AnalyzedNews, IssueId, UserState } from "@/types";

type TradeResult = { ok: boolean; message: string };
export const ROULETTE_COST = 10;

export function useUserState() {
  const [state, setState] = useState<UserState>(initialUserState);
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);
  const [secondsToNextTick, setSecondsToNextTick] = useState(60);

  useEffect(() => {
    const loaded = advanceMarketTicks(loadUserState(), Date.now());
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      stateRef.current = loaded;
      saveUserState(loaded);
      setState(loaded);
      setSecondsToNextTick(Math.max(0, Math.ceil((loaded.nextMarketTickAt - Date.now()) / 1000)));
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  const commit = useCallback((update: (previous: UserState) => UserState) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    saveUserState(next);
    setState(next);
  }, []);

  const syncMarket = useCallback(() => {
    if (Date.now() >= stateRef.current.nextMarketTickAt) {
      commit((previous) => advanceMarketTicks(previous, Date.now()));
    }
    setSecondsToNextTick(Math.max(0, Math.ceil((stateRef.current.nextMarketTickAt - Date.now()) / 1000)));
  }, [commit]);

  useEffect(() => {
    if (!hydrated) return;
    const interval = window.setInterval(syncMarket, 1000);
    document.addEventListener("visibilitychange", syncMarket);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncMarket);
    };
  }, [hydrated, syncMarket]);

  const markSeen = useCallback((id: string) => {
    commit((previous) => ({
      ...previous,
      seenNewsIds: [...new Set([...previous.seenNewsIds, id])].slice(-100),
    }));
  }, [commit]);

  const cacheAnalysis = useCallback((id: string, analysis: AnalyzedNews) => {
    commit((previous) => ({
      ...previous,
      cachedAnalyses: Object.fromEntries(
        [...Object.entries(previous.cachedAnalyses).filter(([key]) => key !== id), [id, analysis]].slice(-60),
      ),
    }));
  }, [commit]);

  const spendRouletteCoins = useCallback((): boolean => {
    if (stateRef.current.coins < ROULETTE_COST) return false;
    commit((previous) => ({ ...previous, coins: previous.coins - ROULETTE_COST }));
    return true;
  }, [commit]);

  const refundRouletteCoins = useCallback(() => {
    commit((previous) => ({ ...previous, coins: previous.coins + ROULETTE_COST }));
  }, [commit]);

  const earnHappyCoin = useCallback((typedText: string): TradeResult => {
    const phrase = HAPPY_PHRASES[stateRef.current.happyTypingCount % HAPPY_PHRASES.length];
    if (normalizeHappyPhrase(typedText) !== normalizeHappyPhrase(phrase)) {
      return { ok: false, message: "문장을 다시 확인해 주세요. 마침표까지 따라 적으면 1 C를 받을 수 있어요." };
    }
    commit((previous) => ({
      ...previous,
      coins: previous.coins + 1,
      happyTypingCount: previous.happyTypingCount + 1,
    }));
    return { ok: true, message: "잘 적었어요. 1 C가 보유 코인에 추가됐습니다." };
  }, [commit]);

  const recordWrongAttempt = useCallback((id: string) => {
    if (stateRef.current.completedQuizIds.includes(id) || (stateRef.current.quizAttempts[id] ?? 0) >= 2) return;
    commit((previous) => ({
      ...previous,
      quizAttempts: { ...previous.quizAttempts, [id]: Math.min(2, (previous.quizAttempts[id] ?? 0) + 1) },
    }));
  }, [commit]);

  const awardQuiz = useCallback((id: string): number => {
    if (stateRef.current.completedQuizIds.includes(id)) return 0;
    const attempts = stateRef.current.quizAttempts[id] ?? 0;
    const reward = attempts === 0 ? 100 : attempts === 1 ? 50 : 0;
    commit((previous) => ({
      ...previous,
      coins: previous.coins + reward,
      completedQuizIds: [...previous.completedQuizIds, id],
    }));
    return reward;
  }, [commit]);

  const buy = useCallback((id: IssueId, quantity: number): TradeResult => {
    syncMarket();
    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, message: "매수 수량은 1 이상의 정수여야 합니다." };
    const price = stateRef.current.market[id]?.currentPrice;
    if (!price) return { ok: false, message: "이슈 가격을 확인할 수 없습니다." };
    const cost = price * quantity;
    if (cost > stateRef.current.coins) return { ok: false, message: "보유 코인이 부족합니다." };
    commit((previous) => {
      const holding = previous.holdings[id];
      const nextQuantity = holding.quantity + quantity;
      return {
        ...previous,
        coins: previous.coins - cost,
        holdings: {
          ...previous.holdings,
          [id]: {
            quantity: nextQuantity,
            averagePrice: ((holding.quantity * holding.averagePrice) + cost) / nextQuantity,
          },
        },
      };
    });
    return { ok: true, message: `${quantity}주를 매수했습니다.` };
  }, [commit, syncMarket]);

  const sell = useCallback((id: IssueId, quantity: number): TradeResult => {
    syncMarket();
    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, message: "매도 수량은 1 이상의 정수여야 합니다." };
    const holding = stateRef.current.holdings[id];
    if (quantity > holding.quantity) return { ok: false, message: "보유 수량이 부족합니다." };
    const price = stateRef.current.market[id]?.currentPrice;
    if (!price) return { ok: false, message: "이슈 가격을 확인할 수 없습니다." };
    commit((previous) => ({
      ...previous,
      coins: previous.coins + price * quantity,
      holdings: {
        ...previous.holdings,
        [id]: {
          quantity: previous.holdings[id].quantity - quantity,
          averagePrice: previous.holdings[id].quantity === quantity ? 0 : previous.holdings[id].averagePrice,
        },
      },
    }));
    return { ok: true, message: `${quantity}주를 매도했습니다.` };
  }, [commit, syncMarket]);

  const applyNewsImpact = useCallback((articleId: string, issueId: IssueId, direction: AnalyzedNews["marketImpact"]["direction"]) => {
    syncMarket();
    if (stateRef.current.processedImpactIds.includes(articleId)) return { applied: false, before: 0, after: 0 };
    const before = stateRef.current.market[issueId].currentPrice;
    commit((previous) => ({
      ...previous,
      market: applyIssueImpact(previous.market, issueId, direction),
      processedImpactIds: [...previous.processedImpactIds, articleId],
    }));
    return { applied: true, before, after: stateRef.current.market[issueId].currentPrice };
  }, [commit, syncMarket]);

  const reset = useCallback(() => commit(() => initialUserState()), [commit]);

  return { state, hydrated, secondsToNextTick, markSeen, cacheAnalysis, spendRouletteCoins, refundRouletteCoins, earnHappyCoin, recordWrongAttempt, awardQuiz, buy, sell, applyNewsImpact, reset };
}
