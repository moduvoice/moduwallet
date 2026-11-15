"use client";
// 거래 내역: 날짜별로 묶어서 보여 준다
import Link from "next/link";
import { useMemo } from "react";
import { usePortfolio } from "@/lib/client";
import type { Trade } from "@/lib/types";
import { fmtDay, fmtQty, fmtTime, fmtUsd, stockHref } from "../format";
import { useStocks } from "../market";
import { TabBar } from "../TabBar";
import { btnPrimary, Card, EmptyState, Screen, StockLogo, unitOf } from "../ui";

export function HistoryScreen() {
  const { trades } = usePortfolio();
  const stocks = useStocks();

  const groups = useMemo(() => {
    const out: { day: string; items: Trade[] }[] = [];
    for (const t of trades) {
      const day = fmtDay(t.at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(t);
      else out.push({ day, items: [t] });
    }
    return out;
  }, [trades]);

  return (
    <Screen tabbar>
      <header className="px-5 pb-3 pt-3.5">
        <h1 className="text-[24px] font-bold text-ink">거래 내역</h1>
        {trades.length > 0 && <p className="mt-1 text-[14px] text-mute">지금까지 {trades.length}번 거래했어요</p>}
      </header>

      <main className="flex flex-col gap-3 px-4">
        {trades.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🧾"
              title="아직 거래가 없어요"
              message="주식을 사거나 팔면 여기에 차곡차곡 쌓여요."
              action={
                <Link href="/stocks" className={`${btnPrimary} !h-12 px-6 !text-[16px]`}>
                  주식 둘러보기
                </Link>
              }
            />
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.day + g.items[0].id} className="pb-2 pt-4">
              <h2 className="px-5 pb-1 text-[14px] font-semibold text-mute">{g.day}</h2>
              <ul>
                {g.items.map((t) => {
                  const meta = stocks.data?.find((s) => s.symbol === t.symbol);
                  const buy = t.side === "buy";
                  return (
                    <li key={t.id}>
                      <Link href={stockHref(t.symbol)} className="row-press flex min-h-[68px] items-center gap-3 px-5 py-3">
                        <StockLogo symbol={t.symbol} icon={meta?.icon} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[16px] font-semibold text-ink">{meta?.nameKo ?? meta?.name ?? t.symbol}</span>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-bold ${
                                buy ? "bg-up-soft text-up" : "bg-down-soft text-down"
                              }`}
                            >
                              {buy ? "구매" : "판매"}
                            </span>
                          </span>
                          <span className="block truncate text-[13px] tabular-nums text-mute">
                            {fmtTime(t.at)} · {fmtQty(t.qty)}
                            {unitOf(meta?.kind)} · {fmtUsd(t.price)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-[16px] font-semibold tabular-nums ${buy ? "text-ink" : "text-primary"}`}>
                            {buy ? "-" : "+"}
                            {fmtUsd(t.usd)}
                          </span>
                          <span className="block text-[12px] tabular-nums text-hint">수수료 {fmtUsd(t.fee)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))
        )}
        {trades.length > 0 && (
          <p className="px-2 pb-2 text-center text-[12px] text-hint">데모 체결 기록이에요 · 이 기기에만 저장돼요</p>
        )}
      </main>

      <TabBar active="history" />
    </Screen>
  );
}
