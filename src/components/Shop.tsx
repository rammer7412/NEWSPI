"use client";

import { BadgeCheck, Coins, Crown, Palette, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { SHOP_ITEMS, equippedTitleLabel } from "@/data/shop-items";
import { formatCoin } from "@/lib/format";
import type { ShopItemId, UserState } from "@/types";

type ActionResult = { ok: boolean; message: string };
type Props = {
  state: UserState;
  busy: boolean;
  onPurchase: (id: ShopItemId) => ActionResult | Promise<ActionResult>;
  onEquip: (id: ShopItemId) => ActionResult | Promise<ActionResult>;
};

export function Shop({ state, busy, onPurchase, onEquip }: Props) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const ownedItems = state.ownedShopItems ?? [];

  async function act(operation: () => ActionResult | Promise<ActionResult>) {
    const result = await operation();
    setSuccess(result.ok);
    setMessage(result.message);
  }

  return <div className="shop-layout">
    <div className="page-heading shop-heading"><div><span className="section-kicker">NEWSPI REWARD SHOP</span><h1>코인 상점<span className="title-dot">.</span></h1><p>뉴스를 읽고 모은 코인으로 나만의 칭호와 거래소 디자인을 완성하세요.</p></div><div className="shop-wallet"><Coins size={19} /><span>사용 가능</span><strong>{formatCoin(state.coins)}</strong></div></div>
    <section className="shop-profile glass-panel">
      <div><Crown size={20} /><span>현재 칭호</span><strong>{equippedTitleLabel(state.equippedTitle)}</strong></div>
      <div><Palette size={20} /><span>장착 디자인</span><strong>{state.equippedTheme ? SHOP_ITEMS.find((item) => item.id === state.equippedTheme)?.name : "NEWSPI 클래식"}</strong></div>
      <div><ShoppingBag size={20} /><span>보유 상품</span><strong>{ownedItems.length} / {SHOP_ITEMS.length}</strong></div>
    </section>
    {message && <div className={`shop-message ${success ? "success" : "error"}`} role="status"><Sparkles size={15} /> {message}</div>}
    <div className="shop-sections">
      {(["TITLE", "THEME"] as const).map((kind) => <section key={kind}>
        <div className="shop-section-title"><div><span className="section-kicker">{kind === "TITLE" ? "PLAYER TITLES" : "MARKET SKINS"}</span><h2>{kind === "TITLE" ? "칭호 컬렉션" : "디자인 테마"}</h2></div><small>{kind === "TITLE" ? "장착한 칭호는 상단 지갑에 표시됩니다." : "구매 후 전체 화면 색상이 즉시 바뀝니다."}</small></div>
        <div className="shop-grid">
          {SHOP_ITEMS.filter((item) => item.kind === kind).map((item) => {
            const owned = ownedItems.includes(item.id);
            const equipped = (kind === "TITLE" ? state.equippedTitle : state.equippedTheme) === item.id;
            return <article className={`shop-card glass-panel ${equipped ? "equipped" : ""}`} key={item.id} style={{ "--shop-accent": item.accent } as CSSProperties}>
              <div className="shop-card-top"><span className="shop-icon">{kind === "TITLE" ? <Crown size={24} /> : <Palette size={24} />}</span>{equipped && <span className="shop-equipped"><BadgeCheck size={13} /> 장착 중</span>}</div>
              <h3>{item.name}</h3><p>{item.description}</p>
              <div className="shop-card-bottom"><strong><Coins size={15} /> {formatCoin(item.price)}</strong>{owned
                ? <button className="outline-button" disabled={busy || equipped} onClick={() => void act(() => onEquip(item.id))}>{equipped ? "장착 완료" : "장착하기"}</button>
                : <button className="primary-button" disabled={busy || state.coins < item.price} onClick={() => void act(() => onPurchase(item.id))}>{state.coins < item.price ? "코인 부족" : "구매하기"}</button>}
              </div>
            </article>;
          })}
        </div>
      </section>)}
    </div>
    <p className="market-disclaimer">상점 상품과 NEWSPI 코인은 게임 안에서만 사용되며 실제 금전 가치가 없습니다.</p>
  </div>;
}
