"use client";
// 홈(지갑): 총액 · 오늘 변화 · 빠른 동작 · 보유 자산 · 둘러보기
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { usePortfolio } from "@/lib/client";
import { DemoBadge } from "../DemoBadge";
import { fmtPct, fmtQty, fmtSignedUsd, fmtUsd, stockHref, toneArrow, toneOf, toneText } from "../format";
import { IconBag, IconChevron, IconPlus, IconSend } from "../icons";
import { Wordmark } from "../Logo";
import { usePrices, useStocks } from "../market";
import { Sheet } from "../Sheet";
import { TabBar } from "../TabBar";
import {
  btnPrimary,
  Card,
  DollarLogo,
  ErrorState,
  RowSkeleton,
  Screen,
  Skeleton,
  StockLogo,
  StockRow,
  unitOf,
} from "../ui";

const POPULAR = ["NVDA", "TSLA", "AAPL", "MSFT", "SPY", "QQQ", "AMZN", "GOOGL"];
const POPULAR_COUNT = 5;

export function HomeScreen() {
  const pf = usePortfolio();
  const stocks = useStocks();
  const [soon, setSoon] = useState<"입금" | "보내기" | null>(null);

  const popular = useMemo(() => {
    const all = stocks.data ?? [];
    const picked = POPULAR.map((s) => all.find((x) => x.symbol === s)).filter((x) => !!x);
    const rest = all.filter((x) => x.kind !== "crypto" && !picked.includes(x));
    return [...picked, ...rest].slice(0, POPULAR_COUNT);
  }, [stocks.data]);

  const symbols = useMemo(
    () => [...pf.holdings.map((h) => h.symbol), ...popular.map((s) => s.symbol)],
    [pf.holdings, popular],
  );
  const { prices, loading: pricesLoading, error: pricesError, reload: reloadPrices } = usePrices(symbols);

  // 총액 = USDC + 보유 주식 × 현재가. 시세를 못 받은 종목은 산 가격으로 계산한다.
  const hasHoldings = pf.holdings.length > 0;
  const missing = pf.holdings.some((h) => !prices[h.symbol]);
  let stockValue = 0;
  let dayChange = 0;
  for (const h of pf.holdings) {
    const p = prices[h.symbol];
    const now = p?.price ?? h.avgPrice;
    stockValue += h.qty * now;
    if (p) dayChange += h.qty * (p.price - p.price / (1 + p.change24h));
  }
  const total = pf.usdc + stockValue;
  const dayBase = stockValue - dayChange;
  const dayRatio = dayBase > 0 ? dayChange / dayBase : 0;
  const dayTone = toneOf(dayChange, 0.005);
  const totalLoading = hasHoldings && missing && pricesLoading;
  const stockShare = total > 0 ? stockValue / total : 0;

  return (
    <Screen tabbar>
      <header className="flex h-14 items-center justify-between px-5">
        <h1>
          <Wordmark />
        </h1>
        <DemoBadge />
      </header>

      <main className="flex flex-col gap-3 px-4">
        {/* 총액 */}
        <Card className="px-5 pb-5 pt-6">
          <p className="text-[14px] font-medium text-mute">내 지갑</p>
          {totalLoading ? (
            <div role="status" aria-label="불러오는 중">
              <Skeleton className="mt-2 h-10 w-44" />
              <Skeleton className="mt-3 h-4 w-32" />
            </div>
          ) : (
            <>
              <p className="mt-1 text-[36px] font-bold leading-tight tracking-[-0.03em] tabular-nums text-ink">
                {fmtUsd(total)}
              </p>
              <p className="mt-1 text-[15px] font-medium">
                {hasHoldings ? (
                  <>
                    <span className="text-mute">오늘 </span>
                    <span className={`tabular-nums ${toneText[dayTone]}`}>
                      {toneArrow[dayTone] && (
                        <span className="mr-0.5 text-[0.7em]" aria-hidden="true">
                          {toneArrow[dayTone]}
                        </span>
                      )}
                      {fmtSignedUsd(dayChange)} ({fmtPct(dayRatio)})
                    </span>
                  </>
                ) : (
                  <span className="text-mute">아직 가진 주식이 없어요</span>
                )}
              </p>
            </>
          )}

          {hasHoldings && !totalLoading && (
            <div className="mt-5">
              <div
                className="flex h-2 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`주식 ${Math.round(stockShare * 100)}%, 달러 ${100 - Math.round(stockShare * 100)}%`}
              >
                <span className="rounded-full bg-primary" style={{ width: `${stockShare * 100}%` }} />
                <span className="flex-1 rounded-full bg-fill-strong" />
              </div>
              <div className="mt-2 flex justify-between text-[13px] text-mute">
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  주식 <b className="font-semibold tabular-nums text-sub">{fmtUsd(stockValue)}</b>
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-fill-strong" aria-hidden="true" />
                  달러 <b className="font-semibold tabular-nums text-sub">{fmtUsd(pf.usdc)}</b>
                </span>
              </div>
            </div>
          )}

          {hasHoldings && missing && !pricesLoading && (
            <p className="mt-3 flex items-center justify-between rounded-xl bg-fill px-3 py-1 text-[13px] text-sub" role="alert">
              시세를 못 받은 종목은 산 가격으로 계산했어요
              <button type="button" onClick={reloadPrices} className="h-11 shrink-0 pl-2 font-semibold text-primary">
                다시 시도
              </button>
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Action label="입금" onClick={() => setSoon("입금")} icon={<IconPlus size={22} />} />
            <Action label="사기" href="/stocks" primary icon={<IconBag size={22} />} />
            <Action label="보내기" onClick={() => setSoon("보내기")} icon={<IconSend size={22} />} />
          </div>
        </Card>

        {/* 보유 자산 */}
        <Card className="pb-2 pt-5">
          <h2 className="px-5 pb-1 text-[18px] font-bold text-ink">가진 자산</h2>
          <div className="flex min-h-[68px] items-center gap-3 px-5 py-3">
            <DollarLogo />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-ink">달러</span>
              <span className="block text-[13px] text-mute">USDC · 주식 살 때 써요</span>
            </span>
            <span className="text-[16px] font-semibold tabular-nums text-ink">{fmtUsd(pf.usdc)}</span>
          </div>

          {pf.holdings.map((h) => {
            const meta = stocks.data?.find((s) => s.symbol === h.symbol);
            const p = prices[h.symbol];
            const value = h.qty * (p?.price ?? h.avgPrice);
            const gain = p ? h.qty * (p.price - h.avgPrice) : 0;
            const gainRatio = h.avgPrice > 0 && p ? p.price / h.avgPrice - 1 : 0;
            const tone = toneOf(gain, 0.005);
            return (
              <Link key={h.symbol} href={stockHref(h.symbol)} className="row-press flex min-h-[68px] items-center gap-3 px-5 py-3">
                <StockLogo symbol={h.symbol} icon={meta?.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-ink">{meta?.nameKo ?? meta?.name ?? h.symbol}</span>
                  <span className="block text-[13px] tabular-nums text-mute">
                    {fmtQty(h.qty)}
                    {unitOf(meta?.kind)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {p || !pricesLoading ? (
                    <>
                      <span className="block text-[16px] font-semibold tabular-nums text-ink">{fmtUsd(value)}</span>
                      {p ? (
                        <span className={`block text-[13px] font-medium tabular-nums ${toneText[tone]}`}>
                          {fmtSignedUsd(gain)} ({fmtPct(gainRatio)})
                        </span>
                      ) : (
                        <span className="block text-[13px] text-hint">산 가격 기준</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Skeleton className="ml-auto h-4 w-16" />
                      <Skeleton className="ml-auto mt-2 h-3 w-20" />
                    </>
                  )}
                </span>
              </Link>
            );
          })}

          {!hasHoldings && (
            <div className="mx-4 mb-3 mt-1 rounded-[18px] bg-primary-soft px-5 py-5">
              <p className="text-[17px] font-bold leading-snug text-ink">
                첫 주식을 사볼까요?
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-sub">
                엔비디아도, 애플도 1달러부터 살 수 있어요.
              </p>
              <Link href="/stocks" className={`${btnPrimary} mt-4 !h-12 !text-[16px]`}>
                주식 둘러보기
              </Link>
            </div>
          )}
        </Card>

        {/* 둘러보기 */}
        <Card className="pb-2 pt-5">
          <div className="flex items-center justify-between pl-5 pr-2">
            <h2 className="text-[18px] font-bold text-ink">둘러보기</h2>
            <Link href="/stocks" className="press flex h-11 items-center gap-0.5 px-3 text-[14px] font-semibold text-mute">
              전체 보기
              <IconChevron size={16} />
            </Link>
          </div>
          {stocks.loading && !stocks.data ? (
            <RowSkeleton rows={POPULAR_COUNT} />
          ) : stocks.error && !stocks.data ? (
            <ErrorState title="종목을 불러오지 못했어요" onRetry={stocks.reload} />
          ) : (
            <>
              {popular.map((s) => (
                <StockRow key={s.symbol} stock={s} price={prices[s.symbol]} loading={pricesLoading} />
              ))}
              {pricesError && popular.some((s) => !prices[s.symbol]) && (
                <div className="px-5 pb-3 pt-1">
                  <button
                    type="button"
                    onClick={reloadPrices}
                    className="press h-11 w-full rounded-xl bg-fill text-[14px] font-semibold text-sub"
                  >
                    시세 다시 불러오기
                  </button>
                </div>
              )}
            </>
          )}
        </Card>

        <p className="px-2 pb-2 pt-1 text-[12px] leading-relaxed text-hint">
          시세·견적 제공: True Markets. 토큰화 주식은 실제 주식이 아닌 증서이며 원금을 잃을 수 있어요. 이 화면은
          데모이고 투자 권유가 아니에요.
        </p>
      </main>

      <TabBar active="home" />

      <Sheet open={soon !== null} onClose={() => setSoon(null)} label={`${soon ?? ""} 안내`}>
        {(close) => (
          <div className="px-6 pt-7 text-center">
            <span className="text-[44px] leading-none" aria-hidden="true">
              🚧
            </span>
            <h2 className="mt-4 text-[22px] font-bold text-ink">{soon}은 데모에서는 준비 중이에요</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-mute">
              지금은 연습용 1,000 USDC 로 사고파는 것만 해 볼 수 있어요.
              <br />
              실제 지갑을 연결하면 쓸 수 있게 준비하고 있어요.
            </p>
            <button type="button" className={`${btnPrimary} mt-7`} onClick={close}>
              확인
            </button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

function Action({
  label,
  icon,
  href,
  onClick,
  primary,
}: {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const cls = `press flex h-[52px] w-full items-center justify-center gap-1.5 rounded-btn text-[15px] font-bold ${
    primary ? "bg-primary text-white active:bg-primary-press" : "bg-fill text-sub active:bg-fill-strong"
  }`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      {label}
    </button>
  );
}
