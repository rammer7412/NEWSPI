import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function load(name) {
  const direct = path.join(root, "src", `${name}.ts`);
  const file = fs.existsSync(direct) ? direct : path.join(root, "src", name, "index.ts");
  if (cache.has(file)) return cache.get(file).exports;
  const testModule = { exports: {} };
  cache.set(file, testModule);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier) => specifier.startsWith("@/") ? load(specifier.slice(2)) : nodeRequire(specifier);
  new Function("require", "module", "exports", code)(localRequire, testModule, testModule.exports);
  return testModule.exports;
}

const game = load("lib/game");
const market = load("lib/market");
const storage = load("lib/storage");
const migration = load("lib/db/legacy-migration");
const demo = nodeRequire("../src/data/fallback-news.json")[0];
const article = (id) => ({ id, title: `데모 ${id}`, description: "", category: "technology",
  sourceUrl: "https://example.com/news", source: "테스트", publishedAt: new Date().toISOString(), isFallback: true });

test("해킹 판정은 20% 확률과 일반 뉴스 4회 보정을 적용하며 기사별로 고정된다", () => {
  let state = storage.initialUserState();
  for (let index = 0; index < 4; index += 1) {
    const id = `normal-${index}`;
    state = game.recordArticleView(state, article(id));
    state = game.registerAnalyzedArticle(state, id, demo.analysis, true, 0.99);
    assert.equal(state.hackEvents[id].active, false);
  }
  assert.equal(state.hackNormalStreak, 4);
  state = game.recordArticleView(state, article("forced"));
  state = game.registerAnalyzedArticle(state, "forced", demo.analysis, true, 0.99);
  assert.equal(state.hackEvents.forced.active, true);
  assert.equal(state.hackNormalStreak, 0);
  state = game.registerAnalyzedArticle(state, "forced", demo.analysis, true, 0.99);
  assert.equal(state.hackEvents.forced.active, true);
  assert.equal(state.hackNormalStreak, 0);
  state = game.recordArticleView(state, article("failed"));
  state = game.registerAnalyzedArticle(state, "failed", demo.analysis, false, 0);
  assert.equal(state.hackEvents.failed, undefined);
  state = game.recordArticleView(state, article("chance"));
  state = game.registerAnalyzedArticle(state, "chance", demo.analysis, true, 0.19);
  assert.equal(state.hackEvents.chance.active, true);
});

test("베팅은 완전 일치, 방향 일치, 불일치에 맞게 정산하고 한 번만 반영한다", () => {
  const impact = demo.analysis.marketImpact;
  const base = game.recordArticleView(storage.initialUserState(), article("hack"));
  const pending = { ...base, hackEvents: { hack: { active: true, resolved: false, pendingAnalysis: demo.analysis } } };
  const exact = game.finalizeHackOnce(pending, "hack", impact, impact.relatedIssue, impact.direction, 30);
  assert.equal(exact.coins, 80);
  assert.equal(exact.hackEvents.hack.prediction.profit, 30);
  assert.equal(exact.dailyMission.predictedArticleIds.length, 1);
  assert.equal(exact.processedImpactIds.length, 1);
  assert.equal(exact.newsHistory[0].summary.length, 3);
  assert.notEqual(exact.market[impact.relatedIssue].currentPrice, pending.market[impact.relatedIssue].currentPrice);
  assert.strictEqual(game.finalizeHackOnce(exact, "hack", impact, impact.relatedIssue, impact.direction, 30), exact);
  const directionOnly = game.finalizeHackOnce(pending, "hack", impact, "SPORTS", impact.direction, 20);
  assert.equal(directionOnly.coins, 50);
  assert.equal(directionOnly.hackEvents.hack.prediction.result, "DIRECTION_ONLY");
  const miss = game.finalizeHackOnce(pending, "hack", impact, impact.relatedIssue, "DOWN", 30);
  assert.equal(miss.coins, 20);
  assert.equal(miss.hackEvents.hack.prediction.result, "MISS");
  const poor = { ...pending, coins: 5 };
  const restored = game.finalizeHackOnce(poor, "hack", impact);
  assert.equal(restored.coins, 5);
  assert.equal(restored.dailyMission.predictedArticleIds.length, 0);
  assert.equal(restored.hackEvents.hack.resolved, true);
  assert.strictEqual(game.finalizeHackOnce(pending, "hack", impact, impact.relatedIssue, impact.direction, 200), pending);
});

test("해킹 기사는 정산 전 기록에 분석을 공개하지 않는다", () => {
  const id = "locked";
  let state = game.recordArticleView(storage.initialUserState(), article(id));
  state = game.registerAnalyzedArticle(state, id, demo.analysis, true, 0);
  assert.equal(state.hackEvents[id].active, true);
  assert.equal(state.newsHistory[0].summary.length, 0);
  assert.equal(state.newsHistory[0].importance, "");
  const resolved = game.finalizeHackOnce(state, id, demo.analysis.marketImpact, "AI_TECH", "UP", 10);
  assert.equal(resolved.newsHistory[0].summary.length, 3);
});

test("1분 변동은 ±0.5%, 기사 영향은 최대 ±5%이고 한 기사에 한 번만 적용된다", () => {
  const base = storage.initialUserState();
  const tickBase = { ...base, nextMarketTickAt: 60_000 };
  for (const sample of [0, 1]) {
    const ticked = market.advanceMarketTicks(tickBase, 60_000, () => sample);
    for (const id of Object.keys(base.market)) {
      const rate = (ticked.market[id].currentPrice - base.market[id].currentPrice) / base.market[id].currentPrice;
      assert.ok(Math.abs(rate) <= 0.005000001);
    }
  }
  assert.equal(market.clampMagnitude(100), 5);
  assert.equal(market.clampMagnitude(-0.1), 0.5);
  const impact = { relatedIssue: "AI_TECH", direction: "UP", magnitude: 100, reason: "테스트" };
  const changed = game.applyArticleImpactOnce(base, "one", impact);
  const rate = (changed.market.AI_TECH.currentPrice - base.market.AI_TECH.currentPrice) / base.market.AI_TECH.currentPrice;
  assert.ok(rate <= 0.05 && rate >= 0);
  assert.strictEqual(changed.market.SPORTS, base.market.SPORTS);
  assert.strictEqual(game.applyArticleImpactOnce(changed, "one", impact), changed);
  assert.strictEqual(market.applyIssueImpact(base.market, "AI_TECH", "NEUTRAL", 5), base.market);
});

test("퀴즈 보상과 미션 보상은 중복 지급되지 않고 오답은 연승을 초기화한다", () => {
  let state = game.recordArticleView(storage.initialUserState(), article("q1"));
  state = game.applyQuizAward(state, "q1");
  assert.equal(state.coins, 75);
  assert.strictEqual(game.applyQuizAward(state, "q1"), state);
  state = game.recordArticleView(state, article("q2"));
  state = game.applyWrongQuizAnswer(state, "q2");
  assert.equal(state.dailyMission.quizStreak, 0);
  state = game.applyQuizAward(state, "q2");
  assert.equal(state.coins, 85);
  assert.equal(state.newsHistory.find((item) => item.articleId === "q2").quizReward, 10);
  state = game.recordArticleView(state, article("q3"));
  state = game.recordArticleView(state, article("q3"));
  assert.equal(state.dailyMission.readArticleIds.length, 3);
  state = game.claimMissionReward(state, "explorer");
  assert.equal(state.coins, 105);
  assert.strictEqual(game.claimMissionReward(state, "explorer"), state);
  const beforeAll = state.coins;
  assert.strictEqual(game.claimAllMissionReward(state), state);
  assert.equal(state.coins, beforeAll);
  state = { ...state, dailyMission: { ...state.dailyMission, quizStreak: 2, predictedArticleIds: ["hack"] } };
  state = game.claimMissionReward(state, "streak");
  state = game.claimMissionReward(state, "hacker");
  state = game.claimAllMissionReward(state);
  assert.equal(state.coins, beforeAll + 60);
  assert.strictEqual(game.claimAllMissionReward(state), state);
});

test("뒤주 반복 보상, 날짜 초기화, 기록 100개 제한, 이전 데이터 이전이 작동한다", () => {
  let state = { ...storage.initialUserState(), coins: 0 };
  for (let index = 0; index < 10; index += 1) state = game.applyHappyReward(state);
  assert.equal(state.coins, 10);
  assert.equal(state.happyDailyEarned, 10);
  const spent = { ...state, coins: 0 };
  assert.equal(game.applyHappyReward(spent).coins, 1);
  assert.equal(game.applyHappyReward(spent).happyDailyEarned, 11);
  const nextDay = game.rolloverDailyState({ ...spent, happyDailyDate: "2000-01-01", dailyMission: { ...spent.dailyMission, date: "2000-01-01", readArticleIds: ["old"] } });
  assert.equal(nextDay.happyDailyEarned, 0);
  assert.equal(nextDay.dailyMission.readArticleIds.length, 0);
  assert.equal(game.applyHappyReward(nextDay).coins, 1);
  for (let index = 0; index < 105; index += 1) state = game.recordArticleView(state, article(`item-${index}`));
  assert.equal(state.newsHistory.length, 100);
  state = game.recordArticleView(state, article("item-104"));
  assert.equal(state.newsHistory.length, 100);
  const oldAnalysis = { ...demo.analysis, marketImpact: { direction: "positive", reason: "이전 형식" } };
  const migrated = storage.normalizeUserState({ coins: 12.75, holdings: { ECONOMY: { quantity: 2, averagePrice: 95 } },
    completedQuizIds: ["done"], processedImpactIds: ["old-news"], cachedAnalyses: { old: oldAnalysis } });
  assert.equal(migrated.coins, 12.75);
  assert.equal(migrated.holdings.ECONOMY.quantity, 2);
  assert.deepEqual(migrated.completedQuizIds, ["done"]);
  assert.equal(migrated.totalNewsCoinsEarned, 100);
  assert.equal(migrated.cachedAnalyses.old.marketImpact.direction, "UP");
  assert.equal(migrated.hackEvents["old-news"].active, false);
});

test("기존 게임 키를 정확히 읽고 이전 성공 후 게임 키만 지운다", () => {
  assert.deepEqual(migration.LEGACY_GAME_KEYS, ["newspi:user:v1", "newspi:user"]);
  const values = new Map([["newspi:user:v1", JSON.stringify(storage.initialUserState())], ["newspi:theme", "dark"]]);
  const prior = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
  };
  try {
    assert.equal(migration.readLegacyState().coins, game.INITIAL_COINS);
    migration.clearLegacyState();
    assert.equal(values.has("newspi:user:v1"), false);
    assert.equal(values.get("newspi:theme"), "dark");
  } finally { globalThis.localStorage = prior; }
});

test("롱·숏 결과는 상승·하락·무승부를 구분하고 승리 지급액을 내림한다", () => {
  assert.deepEqual(game.settleLongShortBet("LONG", 25, 100, 101), { status: "WON", payout: 45 });
  assert.deepEqual(game.settleLongShortBet("SHORT", 25, 100, 99), { status: "WON", payout: 45 });
  assert.deepEqual(game.settleLongShortBet("LONG", 10, 100, 99), { status: "LOST", payout: 0 });
  assert.deepEqual(game.settleLongShortBet("SHORT", 10, 100, 101), { status: "LOST", payout: 0 });
  assert.deepEqual(game.settleLongShortBet("LONG", 25, 100, 100), { status: "DRAW", payout: 25 });
  assert.deepEqual(game.settleLongShortBet("SHORT", 25, 100, 100), { status: "DRAW", payout: 25 });
});

test("손상된 이전 데이터는 거부하며 브라우저 값을 유지한다", () => {
  const values = new Map([["newspi:user:v1", "{bad-json"]]);
  const prior = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, removeItem: (key) => values.delete(key) };
  try {
    assert.throws(() => migration.readLegacyState());
    assert.equal(values.get("newspi:user:v1"), "{bad-json");
    const invalid = { ...storage.initialUserState(), holdings: { ...storage.initialUserState().holdings,
      AI_TECH: { quantity: -1, averagePrice: 100 } } };
    assert.throws(() => migration.validateLegacyState(invalid));
  } finally { globalThis.localStorage = prior; }
});
