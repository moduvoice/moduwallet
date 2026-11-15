"use client";
// 종목 목록·현재가를 화면들이 같이 쓰도록 한 번 받아 기억해 두는 훅.
// 데이터는 전부 src/lib/client.ts 의 함수로만 받는다.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getPrices, getStocks, useAsync } from "@/lib/client";
import type { Price, Stock } from "@/lib/types";

// ---------- 종목 목록 ----------
let stocksOnce: Promise<Stock[]> | undefined;

function loadStocks(): Promise<Stock[]> {
  if (!stocksOnce) {
    stocksOnce = getStocks().catch((e) => {
      stocksOnce = undefined; // 실패한 건 기억하지 않는다(다시 시도 가능)
      throw e;
    });
  }
  return stocksOnce;
}

/** 거래 가능한 종목 전체(화면을 옮겨 다녀도 한 번만 받음) */
export function useStocks() {
  return useAsync(loadStocks, []);
}

// ---------- 현재가 ----------
type PriceMap = Record<string, Price>;
const EMPTY: PriceMap = {};
let snapshot: PriceMap = EMPTY;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function merge(list: Price[]) {
  if (!list.length) return;
  const next = { ...snapshot };
  for (const p of list) {
    if (p && typeof p.price === "number" && Number.isFinite(p.price)) next[p.symbol] = p;
  }
  snapshot = next;
  listeners.forEach((fn) => fn());
}

const REFRESH_MS = 20_000;

/**
 * 여러 종목 현재가. 20초마다(화면이 보일 때만) 새로 받는다.
 * loading 은 "아직 한 번도 못 받았을 때"만 true 라서, 새로 고칠 때 화면이 깜빡이지 않는다.
 */
export function usePrices(symbols: string[]) {
  const prices = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
  const key = useMemo(() => [...new Set(symbols)].sort().join(","), [symbols]);
  const [status, setStatus] = useState<{ key: string; error?: Error }>({ key: "" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const run = () =>
      getPrices(key.split(","))
        .then((list) => {
          merge(list);
          if (alive) setStatus({ key });
        })
        .catch((e: Error) => {
          if (alive) setStatus({ key, error: e });
        });
    run();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [key, nonce]);

  const settled = !key || status.key === key;
  return {
    prices,
    loading: !settled,
    error: settled ? status.error : undefined,
    reload: () => {
      setStatus({ key: "" });
      setNonce((n) => n + 1);
    },
  };
}
