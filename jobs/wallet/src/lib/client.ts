"use client";
// 화면에서 쓰는 데이터 함수. 화면 코드는 이 파일의 함수만 부른다(fetch 를 직접 쓰지 않는다).
import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryPoint, PerpCloseQuote, PerpMarket, PerpQuote, Portfolio, Position, Price, Range, Stock, Trade, TradeQuote } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

/** 거래 가능한 종목 전체 */
export function getStocks(): Promise<Stock[]> {
  return fetch("/api/stocks").then((r) => json<Stock[]>(r));
}

/** 여러 종목 현재가 */
export function getPrices(symbols: string[]): Promise<Price[]> {
  if (!symbols.length) return Promise.resolve([]);
  return fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(","))}`).then((r) => json<Price[]>(r));
}

/** 가격 기록(차트용) */
export function getHistory(symbol: string, range: Range): Promise<HistoryPoint[]> {
  return fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`).then((r) => json<HistoryPoint[]>(r));
}

/**
 * 실제 견적(True Markets). 금액을 달러로 주거나 주식 수로 준다.
 *  - 사기: { usd } = 낼 총액(수수료 포함) / { qty } = 받고 싶은 주식 수
 *  - 팔기: { qty } = 팔 주식 수 / { usd } = 받고 싶은 금액(현재가로 주식 수 환산)
 * 결과 TradeQuote.usd 는 살 때 내는 총액, 팔 때 받는 금액(수수료 반영)
 */
export function getQuote(symbol: string, side: "buy" | "sell", amount: { usd: number } | { qty: number }): Promise<TradeQuote> {
  return fetch("/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol, side, ...amount }),
  }).then((r) => json<TradeQuote>(r));
}

// ---------- 레버리지 ----------
/** 레버리지로 거래할 수 있는 종목(18개, 화면 순서대로) */
export function getPerps(): Promise<PerpMarket[]> {
  return fetch("/api/perps").then((r) => json<PerpMarket[]>(r));
}

/** 레버리지 종목 현재가(선물 가격 - 주식 현재가와 조금 다를 수 있음) */
export function getPerpPrices(symbols: string[]): Promise<Price[]> {
  if (!symbols.length) return Promise.resolve([]);
  return fetch(`/api/prices?perp=1&symbols=${encodeURIComponent(symbols.join(","))}`).then((r) => json<Price[]>(r));
}

export function getPerpHistory(symbol: string, range: Range): Promise<HistoryPoint[]> {
  return fetch(`/api/history?perp=1&symbol=${encodeURIComponent(symbol)}&range=${range}`).then((r) => json<HistoryPoint[]>(r));
}

/** 열기 견적. margin = 내가 넣는 돈(USD), leverage = 배율(1~종목 최대) */
export function getPerpOpenQuote(symbol: string, side: "long" | "short", margin: number, leverage: number): Promise<PerpQuote> {
  return fetch("/api/perp-quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "open", symbol, side, margin, leverage }),
  }).then((r) => json<PerpQuote>(r));
}

/** 닫기 견적(포지션 전체) */
export function getPerpCloseQuote(pos: Position): Promise<PerpCloseQuote> {
  return fetch("/api/perp-quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "close", symbol: pos.symbol, side: pos.side, qty: pos.qty, leverage: pos.leverage }),
  }).then((r) => json<PerpCloseQuote>(r));
}

/** 손익(USD). 롱은 오르면 +, 숏은 내리면 + */
export function positionPnl(pos: Position, price: number) {
  return (price - pos.entry) * pos.qty * (pos.side === "long" ? 1 : -1);
}

/** 손익률(넣은 돈 대비). 0.5 = +50% */
export function positionRoe(pos: Position, price: number) {
  return positionPnl(pos, price) / pos.margin;
}

/** 이 가격이면 청산(넣은 돈을 모두 잃음)인가 */
export function isLiquidated(pos: Position, price: number) {
  return pos.side === "long" ? price <= pos.liqPrice : price >= pos.liqPrice;
}

// ---------- 데모 지갑 ----------
const KEY = "moduwallet.portfolio.v1";
const START: Portfolio = { usdc: 1000, holdings: [], trades: [], positions: [] };

const num = (v: unknown, min = 0, max = 1e9) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** 저장값을 검사해서 이상한 항목은 버린다. 전체가 깨졌으면 처음 상태로 */
function sanitize(raw: unknown): Portfolio {
  if (!raw || typeof raw !== "object") return START;
  const r = raw as Record<string, unknown>;
  const usdc = num(r.usdc);
  if (usdc === null) return START;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const holdings = arr(r.holdings).filter(
    (h): h is Portfolio["holdings"][number] =>
      !!h && typeof h.symbol === "string" && num(h.qty, 1e-12) !== null && num(h.avgPrice) !== null,
  );
  const trades = arr(r.trades).filter(
    (t): t is Trade => !!t && typeof t.symbol === "string" && typeof t.at === "string" && num(t.qty) !== null && num(t.usd, -1e9) !== null,
  );
  const positions = arr(r.positions).filter(
    (x): x is Position =>
      !!x && typeof x.symbol === "string" && (x.side === "long" || x.side === "short") &&
      num(x.margin, 1e-9) !== null && num(x.qty, 1e-12) !== null && num(x.entry, 1e-12) !== null &&
      num(x.leverage, 1, 100) !== null && num(x.liqPrice) !== null,
  );
  return { usdc, holdings, trades, positions };
}

function load(): Portfolio {
  if (typeof window === "undefined") return START;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : START;
  } catch {
    return START;
  }
}

function save(p: Portfolio) {
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("moduwallet:portfolio"));
}

/** 견적대로 데모 체결. 잔고가 모자라면 오류 */
export function executeDemo(q: TradeQuote): Trade {
  const p = load();
  const trade: Trade = {
    id: crypto.randomUUID(),
    symbol: q.symbol,
    side: q.side,
    qty: q.qty,
    price: q.price,
    usd: q.usd,
    fee: q.fee,
    at: new Date().toISOString(),
    mode: "demo",
  };
  const holdings = [...p.holdings];
  const i = holdings.findIndex((h) => h.symbol === q.symbol);
  if (q.side === "buy") {
    if (p.usdc < q.usd) throw new Error("USDC 잔고가 부족해요");
    const h = i >= 0 ? holdings[i] : { symbol: q.symbol, qty: 0, avgPrice: 0 };
    const qty = h.qty + q.qty;
    const next = { symbol: q.symbol, qty, avgPrice: (h.qty * h.avgPrice + q.usd) / qty, lastBuyAt: trade.at };
    if (i >= 0) holdings[i] = next;
    else holdings.push(next);
    save({ ...p, usdc: p.usdc - q.usd, holdings, trades: [trade, ...p.trades] });
  } else {
    if (i < 0 || holdings[i].qty < q.qty - 1e-9) throw new Error("보유 수량이 부족해요");
    trade.pnl = q.usd - q.qty * holdings[i].avgPrice; // 실현 손익(받은 돈 - 산 값)
    const left = holdings[i].qty - q.qty;
    if (left <= 1e-9) holdings.splice(i, 1);
    else holdings[i] = { ...holdings[i], qty: left };
    save({ ...p, usdc: p.usdc + q.usd, holdings, trades: [trade, ...p.trades] });
  }
  return trade;
}

/** 레버리지 열기(데모). 넣는 돈 + 수수료가 USDC 에서 빠진다 */
export function openPositionDemo(q: PerpQuote): Position {
  const p = load();
  const cost = q.margin + q.fee;
  if (p.usdc < cost - 1e-9) throw new Error("USDC 잔고가 부족해요");
  const pos: Position = {
    id: crypto.randomUUID(),
    symbol: q.symbol,
    side: q.side,
    leverage: q.leverage,
    margin: q.margin,
    qty: q.qty,
    entry: q.price,
    liqPrice: q.liqPrice,
    openFee: q.fee,
    openedAt: new Date().toISOString(),
    mode: "demo",
  };
  const trade: Trade = {
    id: crypto.randomUUID(),
    symbol: q.symbol,
    side: q.side === "long" ? "buy" : "sell",
    qty: q.qty,
    price: q.price,
    usd: cost,
    fee: q.fee,
    at: pos.openedAt,
    mode: "demo",
    kind: "perp-open",
    leverage: q.leverage,
    positionSide: q.side,
  };
  save({ ...p, usdc: p.usdc - cost, positions: [pos, ...(p.positions ?? [])], trades: [trade, ...p.trades] });
  return pos;
}

/** 레버리지 닫기(데모). 돌려받는 돈 = 넣은 돈 + 손익 - 수수료(0 아래로는 안 감) */
export function closePositionDemo(positionId: string, q: PerpCloseQuote): Trade {
  const p = load();
  const pos = (p.positions ?? []).find((x) => x.id === positionId);
  if (!pos) throw new Error("이미 닫힌 포지션이에요");
  const pnl = positionPnl(pos, q.price);
  const back = Math.max(0, pos.margin + pnl - q.fee);
  const trade: Trade = {
    id: crypto.randomUUID(),
    symbol: pos.symbol,
    side: pos.side === "long" ? "sell" : "buy",
    qty: pos.qty,
    price: q.price,
    usd: back,
    fee: q.fee,
    at: new Date().toISOString(),
    mode: "demo",
    kind: "perp-close",
    leverage: pos.leverage,
    positionSide: pos.side,
    pnl: back - pos.margin - (pos.openFee ?? 0), // 여는 수수료까지 포함한 실제 손익
  };
  save({ ...p, usdc: p.usdc + back, positions: (p.positions ?? []).filter((x) => x.id !== positionId), trades: [trade, ...p.trades] });
  return trade;
}

/**
 * 현재가로 청산 확인(데모). 청산된 포지션은 넣은 돈을 모두 잃고 닫힌다.
 * 화면에서 레버리지 가격을 받을 때마다 부른다. 청산된 것을 돌려준다(알림용)
 */
export function checkLiquidationsDemo(prices: Price[]): Position[] {
  const p = load();
  const dead = (p.positions ?? []).filter((pos) => {
    const pr = prices.find((x) => x.symbol === pos.symbol);
    return pr ? isLiquidated(pos, pr.price) : false;
  });
  if (!dead.length) return [];
  const now = new Date().toISOString();
  const trades: Trade[] = dead.map((pos) => ({
    id: crypto.randomUUID(),
    symbol: pos.symbol,
    side: pos.side === "long" ? "sell" : "buy",
    qty: pos.qty,
    price: pos.liqPrice,
    usd: 0,
    fee: 0,
    at: now,
    mode: "demo",
    kind: "perp-liquidated",
    leverage: pos.leverage,
    positionSide: pos.side,
    pnl: -pos.margin - (pos.openFee ?? 0),
  }));
  save({ ...p, positions: (p.positions ?? []).filter((x) => !dead.includes(x)), trades: [...trades, ...p.trades] });
  return dead;
}

export function resetDemo() {
  save(START);
}

/** 데모 지갑 상태를 읽고, 바뀌면 다시 그린다 */
export function usePortfolio(): Portfolio {
  const [p, setP] = useState<Portfolio>(START);
  useEffect(() => {
    const update = () => setP(load());
    update();
    window.addEventListener("moduwallet:portfolio", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("moduwallet:portfolio", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return p;
}

/** 비동기 데이터 한 번 읽기 + 다시 읽기. deps 가 바뀌면 다시 읽는다 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; data?: T; error?: Error; done: boolean }>({ key, done: false });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    let alive = true;
    fnRef.current().then(
      (data) => alive && setState({ key, data, done: true }),
      (error: Error) => alive && setState((s) => ({ key, data: s.key === key ? s.data : undefined, error, done: true })),
    );
    return () => {
      alive = false;
    };
  }, [key, nonce]);
  const reload = useCallback(() => {
    setState((s) => ({ ...s, done: false }));
    setNonce((n) => n + 1);
  }, []);
  const stale = state.key !== key;
  return {
    data: stale ? undefined : state.data,
    error: stale ? undefined : state.error,
    loading: stale || !state.done,
    reload,
  };
}


// ---------- 화면 도우미 ----------
/**
 * 오늘 손익(주식·코인 보유분). 오늘(24시간 안에) 산 것은 산 가격부터, 그 전에 산 것은 24시간 전 가격부터 계산한다.
 * prices 에 없는 종목은 0 으로 본다.
 */
export function todayChange(p: Portfolio, prices: Price[]) {
  const dayAgo = Date.now() - 24 * 3600_000;
  let change = 0;
  let base = 0;
  for (const h of p.holdings) {
    const pr = prices.find((x) => x.symbol === h.symbol);
    if (!pr) continue;
    const prev = pr.price / (1 + pr.change24h);
    const boughtToday = h.lastBuyAt ? Date.parse(h.lastBuyAt) > dayAgo : false;
    const from = boughtToday ? h.avgPrice : prev;
    change += h.qty * (pr.price - from);
    base += h.qty * from;
  }
  return { change, ratio: base > 0 ? change / base : 0 };
}

/**
 * 미국 주식 시장 상태(정규장 월~금 9:30~16:00 뉴욕 시간, 공휴일은 따지지 않음).
 * 토큰은 장이 닫혀도 거래될 수 있지만 가격이 덜 움직이고 사고팔 때 가격 차이가 커질 수 있다.
 */
export function usMarketStatus(now = new Date()): { open: boolean; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const wd = get("weekday");
  const mins = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  const weekend = wd === "Sat" || wd === "Sun";
  const open = !weekend && mins >= 570 && mins < 960;
  return { open, label: open ? "미국 장 열림" : weekend ? "주말 · 미국 장 닫힘" : "미국 장 닫힘" };
}

/** 1달러가 각 통화로 얼마인지(참고용, 1시간마다 갱신). rates: { KRW, VND, THB, CNY, RUB, JPY, EUR } */
export function getFx(): Promise<{ rates: Record<string, number>; usdKrw: number; updatedAt: string }> {
  return fetch("/api/fx").then((r) => json<{ rates: Record<string, number>; usdKrw: number; updatedAt: string }>(r));
}

/** 브라우저가 인터넷에 연결돼 있는지 */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
