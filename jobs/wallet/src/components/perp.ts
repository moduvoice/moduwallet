"use client";
// 레버리지 화면들이 같이 쓰는 데이터 훅과 계산. 데이터는 전부 src/lib/client.ts 의 함수로만 받는다.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { checkLiquidationsDemo, getPerpPrices, getPerps, positionPnl, useAsync } from "@/lib/client";
import type { PerpMarket, Position, Price } from "@/lib/types";

// ---------- 종목 목록 ----------
let perpsOnce: Promise<PerpMarket[]> | undefined;

function loadPerps(): Promise<PerpMarket[]> {
  if (!perpsOnce) {
    perpsOnce = getPerps().catch((e) => {
      perpsOnce = undefined; // 실패한 건 기억하지 않는다
      throw e;
    });
  }
  return perpsOnce;
}

/** 레버리지로 거래할 수 있는 종목(한 번만 받음) */
export function usePerps() {
  return useAsync(loadPerps, []);
}

// ---------- 현재가(선물 가격) + 청산 확인 ----------
type PriceMap = Record<string, Price>;
const EMPTY: PriceMap = {};
const NONE: Position[] = [];
let snapshot: PriceMap = EMPTY;
let liquidated: Position[] = NONE; // 방금 청산된 것(알림용)
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const emit = () => listeners.forEach((fn) => fn());

function accept(list: Price[]) {
  const good = list.filter((p) => p && typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0);
  if (!good.length) return;
  const next = { ...snapshot };
  for (const p of good) next[p.symbol] = p;
  snapshot = next;
  // 가격을 받을 때마다 청산 확인(데모). 청산된 포지션은 지갑에서 빠지고 알림으로 보여 준다
  const dead = checkLiquidationsDemo(good);
  if (dead.length) liquidated = [...liquidated, ...dead];
  emit();
}

const REFRESH_MS = 15_000;

/** 레버리지 종목 현재가. 15초마다(화면이 보일 때만) 새로 받고, 받을 때마다 청산을 확인한다 */
export function usePerpPrices(symbols: string[]) {
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
      getPerpPrices(key.split(","))
        .then((list) => {
          accept(list);
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

/** 방금 청산된 포지션(알림용) */
export function useLiquidated(): Position[] {
  return useSyncExternalStore(
    subscribe,
    () => liquidated,
    () => NONE,
  );
}

export function clearLiquidated() {
  if (!liquidated.length) return;
  liquidated = NONE;
  emit();
}

// ---------- 쉬운 말 · 계산 ----------
export type PerpSide = "long" | "short";

export const SIDE: Record<PerpSide, { guess: string; dir: string; word: string; text: string; soft: string; bg: string; hex: string }> = {
  long: { guess: "오를 것 같아요", dir: "오르는 쪽", word: "롱", text: "text-up", soft: "bg-up-soft", bg: "bg-up active:bg-up-press", hex: "#F04452" },
  short: { guess: "내릴 것 같아요", dir: "내리는 쪽", word: "숏", text: "text-down", soft: "bg-down-soft", bg: "bg-primary active:bg-primary-press", hex: "#3182F6" },
};

/** 17.5% / 20% / 2.5% 처럼 짧게(부호 없음) */
export function fmtRate(ratio: number): string {
  const v = Math.abs(ratio) * 100;
  const s = v.toFixed(v < 1 ? 2 : 1);
  return `${s.replace(/\.0+$/, "")}%`;
}

/**
 * 견적을 받기 전의 "모두 잃는 선"까지 거리(가격 변동률) 어림값.
 * 1/배수 에서 거래소가 남겨 두는 최소 증거금(최대 배수의 절반 수준)을 뺀다.
 */
export function estLiqDistance(leverage: number, maxLeverage: number): number {
  return Math.max(0.002, 1 / leverage - 1 / (2 * maxLeverage));
}

export type Risk = { label: string; text: string; bg: string };

/** 배수별 위험도(쉬운 말 + 색) */
export function riskOf(leverage: number): Risk {
  if (leverage <= 3) return { label: "위험 낮음", text: "text-ok", bg: "bg-ok-soft" };
  if (leverage <= 10) return { label: "위험 보통", text: "text-warn", bg: "bg-warn-soft" };
  return { label: "위험 높음", text: "text-up", bg: "bg-up-soft" };
}

/** 지금 가격에서 청산가까지 남은 거리(가격 변동률). 0 이하면 청산 */
export function remainToLiq(pos: Position, price: number): number {
  if (!(price > 0)) return 0;
  return pos.side === "long" ? (price - pos.liqPrice) / price : (pos.liqPrice - price) / price;
}

/** 포지션의 지금 가치 = 넣은 돈 + 손익(0 아래로는 안 감). 가격을 모르면 넣은 돈 */
export function positionValue(pos: Position, price?: number): number {
  return Math.max(0, pos.margin + (price ? positionPnl(pos, price) : 0));
}

export const GROUPS: { key: string; label: string; has: (m: PerpMarket) => boolean }[] = [
  { key: "stock", label: "주식", has: (m) => m.group === "stock" },
  { key: "macro", label: "지수 · 원자재", has: (m) => m.group === "index" || m.group === "commodity" },
  { key: "crypto", label: "코인", has: (m) => m.group === "crypto" },
];
