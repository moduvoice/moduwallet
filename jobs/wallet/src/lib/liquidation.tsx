"use client";
// 어느 화면에 있든 열린 레버리지 포지션의 청산을 확인한다(데모). layout 에 <LiquidationWatcher /> 한 번.
// 청산되면 window 에 "moduwallet:liquidated" 이벤트(detail: Position[])를 보낸다 → 화면은 알림만 띄우면 된다.
import { useEffect } from "react";
import { checkLiquidationsDemo, getPerpPrices, usePortfolio } from "./client";

export function LiquidationWatcher({ everyMs = 15_000 }: { everyMs?: number }) {
  const { positions } = usePortfolio();
  const symbols = [...new Set((positions ?? []).map((p) => p.symbol))].sort().join(",");
  useEffect(() => {
    if (!symbols) return;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const prices = await getPerpPrices(symbols.split(","));
        if (!alive) return;
        const dead = checkLiquidationsDemo(prices);
        if (dead.length) window.dispatchEvent(new CustomEvent("moduwallet:liquidated", { detail: dead }));
      } catch {
        // 다음 차례에 다시
      }
    };
    tick();
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [symbols, everyMs]);
  return null;
}
