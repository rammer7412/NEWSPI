"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceMarketTicks } from "@/lib/market";
import { initialUserState, loadUserState, saveUserState } from "@/lib/storage";
import { applyArticleImpactOnce, applyHappyReward, applyQuizAward, applyWrongQuizAnswer, claimAllMissionReward, claimMissionReward, finalizeHackOnce, HAPPY_DAILY_LIMIT, recordArticleView, registerAnalyzedArticle, rolloverDailyState } from "@/lib/game";
import { HAPPY_PHRASES, normalizeHappyPhrase } from "@/data/happy-phrases";
import type { AnalyzedNews, IssueId, MarketDirection, MarketImpact, MissionId, NewsArticle, UserState } from "@/types";

type TradeResult = { ok: boolean; message: string };
export const ROULETTE_COST = 10;

export function useUserState() {
  const [state, setState] = useState<UserState>(initialUserState);
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);
  const [secondsToNextTick, setSecondsToNextTick] = useState(60);

  useEffect(() => {
    const loaded = advanceMarketTicks(rolloverDailyState(loadUserState()), Date.now());
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
    const previous = rolloverDailyState(stateRef.current);
    const next = update(previous);
    if (next === stateRef.current) return next;
    stateRef.current = next;
    saveUserState(next);
    setState(next);
    return next;
  }, []);

  const syncMarket = useCallback(() => {
    const now = Date.now();
    if (now >= stateRef.current.nextMarketTickAt || rolloverDailyState(stateRef.current, now) !== stateRef.current) {
      commit((previous) => advanceMarketTicks(previous, now));
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

  const recordNewsView = useCallback((article: NewsArticle) => {
    commit((previous) => recordArticleView(previous, article));
  }, [commit]);

  const registerAnalysis = useCallback((article: NewsArticle, analysis: AnalyzedNews, available: boolean) => {
    const shouldDecide = available && !analysis.insufficient && !stateRef.current.hackEvents[article.id];
    const sample = shouldDecide ? Math.random() : 1;
    commit((previous) => registerAnalyzedArticle(previous, article.id, analysis, available, sample));
    return stateRef.current.hackEvents[article.id] ?? { active: false, resolved: false };
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
    commit((previous) => ({ ...previous, coins: Math.round((previous.coins - ROULETTE_COST) * 100) / 100 }));
    return true;
  }, [commit]);

  const refundRouletteCoins = useCallback(() => {
    commit((previous) => ({ ...previous, coins: Math.round((previous.coins + ROULETTE_COST) * 100) / 100 }));
  }, [commit]);

  const earnHappyCoin = useCallback((typedText: string): TradeResult => {
    commit((previous) => previous);
    if (stateRef.current.coins >= ROULETTE_COST) {
      return { ok: false, message: "행복한 뒤주는 파산 위기에 처한 백성에게만 열립니다." };
    }
    if (stateRef.current.happyDailyEarned >= HAPPY_DAILY_LIMIT) {
      return { ok: false, message: "오늘의 뒤주 보상 10 C를 모두 받았습니다. 내일 다시 이용해 주세요." };
    }
    const phrase = HAPPY_PHRASES[stateRef.current.happyTypingCount % HAPPY_PHRASES.length];
    if (normalizeHappyPhrase(typedText) !== normalizeHappyPhrase(phrase)) {
      return { ok: false, message: "문장을 다시 확인해 주세요. 마침표까지 따라 적으면 1 C를 받을 수 있어요." };
    }
    commit(applyHappyReward);
    return { ok: true, message: "잘 적었어요. 1 C가 보유 코인에 추가됐습니다." };
  }, [commit]);

  const recordWrongAttempt = useCallback((id: string) => {
    commit((previous) => applyWrongQuizAnswer(previous, id));
  }, [commit]);

  const awardQuiz = useCallback((id: string): number => {
    const before = stateRef.current.coins;
    commit((previous) => applyQuizAward(previous, id));
    return Math.round((stateRef.current.coins - before) * 100) / 100;
  }, [commit]);

  const buy = useCallback((id: IssueId, quantity: number): TradeResult => {
    syncMarket();
    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, message: "매수 수량은 1 이상의 정수여야 합니다." };
    const price = stateRef.current.market[id]?.currentPrice;
    if (!price) return { ok: false, message: "이슈 가격을 확인할 수 없습니다." };
    const cost = Math.round(price * quantity * 100) / 100;
    if (cost > stateRef.current.coins) return { ok: false, message: "보유 코인이 부족합니다." };
    commit((previous) => {
      const holding = previous.holdings[id];
      const nextQuantity = holding.quantity + quantity;
      return {
        ...previous,
        coins: Math.round((previous.coins - cost) * 100) / 100,
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
      coins: Math.round((previous.coins + Math.round(price * quantity * 100) / 100) * 100) / 100,
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

  const applyNewsImpact = useCallback((articleId: string, impact: MarketImpact) => {
    syncMarket();
    const before = stateRef.current.market[impact.relatedIssue].currentPrice;
    const previous = stateRef.current;
    commit((current) => applyArticleImpactOnce(current, articleId, impact));
    return { applied: !previous.processedImpactIds.includes(articleId) && stateRef.current.processedImpactIds.includes(articleId),
      before, after: stateRef.current.market[impact.relatedIssue].currentPrice };
  }, [commit, syncMarket]);

  const resolveHack = useCallback((articleId: string, impact: MarketImpact, selectedIssue?: IssueId,
    selectedDirection?: MarketDirection, betAmount = 0) => {
    syncMarket();
    const previous = stateRef.current;
    const event = previous.hackEvents[articleId];
    if (!event?.active || event.resolved) return { ok: false, message: "이미 복구한 분석입니다." };
    commit((current) => finalizeHackOnce(current, articleId, impact, selectedIssue, selectedDirection, betAmount));
    if (!stateRef.current.hackEvents[articleId]?.resolved) {
      return { ok: false, message: betAmount === 0 ? "베팅 없이 복구할 수 있는 잔액인지 확인해 주세요." : "이슈, 방향, 보유 코인에 맞는 베팅 금액을 확인해 주세요." };
    }
    return { ok: true, message: betAmount ? "예측이 정산되고 분석이 공개됐습니다." : "베팅 없이 분석이 복구됐습니다.",
      prediction: stateRef.current.hackEvents[articleId].prediction };
  }, [commit, syncMarket]);

  const claimMission = useCallback((id: MissionId) => {
    const before = stateRef.current.coins;
    commit((previous) => claimMissionReward(previous, id));
    return stateRef.current.coins > before;
  }, [commit]);

  const claimAllMissions = useCallback(() => {
    const before = stateRef.current.coins;
    commit(claimAllMissionReward);
    return stateRef.current.coins > before;
  }, [commit]);

  const reset = useCallback(() => commit(() => initialUserState()), [commit]);

  return { state, hydrated, secondsToNextTick, recordNewsView, registerAnalysis, cacheAnalysis, spendRouletteCoins,
    refundRouletteCoins, earnHappyCoin, recordWrongAttempt, awardQuiz, buy, sell, applyNewsImpact, resolveHack,
    claimMission, claimAllMissions, reset };
}
