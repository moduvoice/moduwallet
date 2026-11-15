"use client";
// 화면에서 쓰는 데이터 함수. 화면 코드는 이 파일의 함수만 부른다(fetch 를 직접 쓰지 않는다).
import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryPoint, Portfolio, Price, Range, Stock, Trade, TradeQuote } from "./types";

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

/** 실제 견적. usd 는 주문 금액(팔 때도 USD 금액으로 지정) */
export function getQuote(symbol: string, side: "buy" | "sell", usd: number): Promise<TradeQuote> {
  return fetch("/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol, side, usd }),
  }).then((r) => json<TradeQuote>(r));
}

// ---------- 데모 지갑 ----------
const KEY = "moduwallet.portfolio.v1";
const START: Portfolio = { usdc: 1000, holdings: [], trades: [] };

function load(): Portfolio {
  if (typeof window === "undefined") return START;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Portfolio) : START;
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
    const next = { symbol: q.symbol, qty, avgPrice: (h.qty * h.avgPrice + q.usd) / qty };
    if (i >= 0) holdings[i] = next;
    else holdings.push(next);
    save({ usdc: p.usdc - q.usd, holdings, trades: [trade, ...p.trades] });
  } else {
    if (i < 0 || holdings[i].qty < q.qty - 1e-9) throw new Error("보유 수량이 부족해요");
    const left = holdings[i].qty - q.qty;
    if (left <= 1e-9) holdings.splice(i, 1);
    else holdings[i] = { ...holdings[i], qty: left };
    save({ usdc: p.usdc + q.usd, holdings, trades: [trade, ...p.trades] });
  }
  return trade;
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
