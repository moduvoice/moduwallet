"use client";
// 레버리지 탭: 진행 중인 것 · 종목 고르기(주식 / 지수·원자재 / 코인)
import { useMemo, useState } from "react";
import { usePortfolio } from "@/lib/client";
import type { PerpMarket } from "@/lib/types";
import { DemoBadge } from "../DemoBadge";
import { fmtUsd } from "../format";
import { LeverageGuide } from "../LeverageGuide";
import { GROUPS, usePerpPrices, usePerps } from "../perp";
import { PerpOpenSheet } from "../PerpOpenSheet";
import { LiquidationToast, PositionList } from "../Positions";
import { TabBar } from "../TabBar";
import { Card, Change, ErrorState, RowSkeleton, Screen, Skeleton, StockLogo } from "../ui";

export function LeverageScreen() {
  const pf = usePortfolio();
  const perps = usePerps();
  const [guide, setGuide] = useState(false);
  const [picked, setPicked] = useState<PerpMarket | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const markets = perps.data;
  const positions = useMemo(() => pf.positions ?? [], [pf.positions]);
  const symbols = useMemo(
    () => [...(markets ?? []).map((m) => m.symbol), ...positions.map((p) => p.symbol)],
    [markets, positions],
  );
  const { prices, loading: pricesLoading, error: pricesError, reload: reloadPrices } = usePerpPrices(symbols);

  return (
    <Screen tabbar>
      <LiquidationToast markets={markets} />
      <header className="flex items-center justify-between pl-5 pr-5 pt-2">
        <h1 className="text-[24px] font-bold text-ink">레버리지</h1>
        <DemoBadge />
      </header>

      <main className="flex flex-col gap-3 px-4 pt-2">
        {/* 한 줄 소개 */}
        <button
          type="button"
          onClick={() => setGuide(true)}
          className="press flex min-h-[76px] items-center gap-3 rounded-card bg-ink px-5 py-4 text-left"
        >
          <span className="text-[26px] leading-none" aria-hidden="true">
            ⚡
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-white">적은 돈으로 크게 움직여요</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/70">
              크게 벌 수도, 넣은 돈을 모두 잃을 수도 있어요
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white">뭐예요?</span>
        </button>

        {/* 진행 중(있을 때만 보임) */}
        <PositionList
          positions={positions}
          markets={markets}
          prices={prices}
          loading={pricesLoading}
          header={
            <h2 className="px-1 pb-2 pt-2 text-[15px] font-bold text-sub">
              진행 중 <span className="tabular-nums text-primary">{positions.length}</span>
            </h2>
          }
        />

        {pricesError && (
          <p className="flex items-center justify-between rounded-xl bg-card px-4 py-1 text-[13px] text-sub" role="alert">
            가격을 불러오지 못했어요
            <button type="button" onClick={reloadPrices} className="h-11 pl-2 font-semibold text-primary">
              다시 시도
            </button>
          </p>
        )}

        {/* 종목 */}
        {perps.loading && !markets ? (
          <Card className="py-2">
            <div className="px-5 pb-1 pt-3">
              <Skeleton className="h-4 w-12" />
            </div>
            <RowSkeleton rows={7} />
          </Card>
        ) : perps.error && !markets ? (
          <Card>
            <ErrorState title="종목을 불러오지 못했어요" onRetry={perps.reload} />
          </Card>
        ) : (
          GROUPS.map((g) => {
            const list = (markets ?? []).filter(g.has);
            if (!list.length) return null;
            return (
              <Card key={g.key} className="pb-2 pt-4">
                <h2 className="px-5 pb-1 text-[14px] font-semibold text-mute">{g.label}</h2>
                <ul>
                  {list.map((m) => {
                    const p = prices[m.symbol];
                    return (
                      <li key={m.symbol}>
                        <button
                          type="button"
                          onClick={() => {
                            setPicked(m);
                            setSheetOpen(true);
                          }}
                          className="row-press flex min-h-[68px] w-full items-center gap-3 px-5 py-3 text-left"
                        >
                          <StockLogo symbol={m.symbol} icon={m.icon} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[16px] font-semibold text-ink">{m.nameKo}</span>
                            <span className="block text-[13px] tabular-nums text-mute">최대 {m.maxLeverage}배</span>
                          </span>
                          <span className="shrink-0 text-right">
                            {p ? (
                              <>
                                <span className="block text-[16px] font-semibold tabular-nums text-ink">{fmtUsd(p.price)}</span>
                                <Change ratio={p.change24h} className="block text-[13px] font-medium" />
                              </>
                            ) : pricesLoading ? (
                              <>
                                <Skeleton className="ml-auto h-4 w-16" />
                                <Skeleton className="ml-auto mt-2 h-3 w-10" />
                              </>
                            ) : (
                              <span className="text-[13px] text-hint">가격 없음</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })
        )}

        <p className="px-2 pb-2 pt-1 text-[12px] leading-relaxed text-hint">
          가격·견적 제공: True Markets. 레버리지는 넣은 돈을 모두 잃을 수 있는 위험한 거래예요. 이 화면은 데모라서 실제
          돈은 움직이지 않고, 투자 권유가 아니에요.
        </p>
      </main>

      <TabBar active="leverage" />

      <LeverageGuide open={guide} onClose={() => setGuide(false)} />
      {picked && (
        <PerpOpenSheet open={sheetOpen} onClose={() => setSheetOpen(false)} market={picked} price={prices[picked.symbol]} />
      )}
    </Screen>
  );
}
