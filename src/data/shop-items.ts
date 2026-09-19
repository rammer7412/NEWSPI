import type { ShopItemId, ShopItemKind } from "@/types";

export type ShopItem = {
  id: ShopItemId;
  kind: ShopItemKind;
  name: string;
  description: string;
  price: number;
  accent: string;
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: "TITLE_NEWS_SCOUT", kind: "TITLE", name: "뉴스 정찰대", description: "오늘의 이슈를 가장 먼저 찾아내는 탐험가 칭호", price: 300, accent: "#54e6cc" },
  { id: "TITLE_ISSUE_HUNTER", kind: "TITLE", name: "이슈 헌터", description: "뉴스와 시장의 연결고리를 추적하는 숙련자 칭호", price: 700, accent: "#ad96ff" },
  { id: "TITLE_MARKET_ORACLE", kind: "TITLE", name: "시장 예언자", description: "수많은 뉴스를 읽고 시장을 내다보는 최고 등급 칭호", price: 1500, accent: "#f6ca69" },
  { id: "THEME_VIOLET", kind: "THEME", name: "바이올렛 네온", description: "보라색 네온과 푸른 빛으로 바뀌는 거래소 디자인", price: 600, accent: "#a98cff" },
  { id: "THEME_GOLD", kind: "THEME", name: "골드 터미널", description: "프리미엄 골드 포인트를 강조한 투자 터미널 디자인", price: 1200, accent: "#f0bd55" },
  { id: "THEME_AURORA", kind: "THEME", name: "오로라 마켓", description: "민트와 핑크 오로라가 흐르는 최고 등급 디자인", price: 2500, accent: "#ff81bd" },
];

export const SHOP_BY_ID = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item])) as Record<ShopItemId, ShopItem>;

export function equippedTitleLabel(id: ShopItemId | null): string {
  return id && SHOP_BY_ID[id]?.kind === "TITLE" ? SHOP_BY_ID[id].name : "신입 뉴스 투자자";
}

export function shopThemeClass(id: ShopItemId | null): string {
  return id && SHOP_BY_ID[id]?.kind === "THEME" ? `shop-${id.toLowerCase().replaceAll("_", "-")}` : "";
}
