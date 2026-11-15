"use client";
// 종목 상세: 가격 · 차트 · 내 보유 · 사기/팔기
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getHistory, useAsync, usePortfolio } from "@/lib/client";
import type { HistoryPoint, Range, Stock } from "@/lib/types";
import { Chart } from "../Chart";
import { fmtDate, fmtDateTime, fmtPct, fmtQty, fmtSignedUsd, fmtUsd, toneArrow, toneOf, toneText } from "../format";
import { IconBack } from "../icons";
import { usePrices, useStocks } from "../market";
import { OrderSheet } from "../OrderSheet";
import { btnGray, Card, ErrorState, Screen, Skeleton, StockLogo, unitOf } from "../ui";

const RANGES: { key: Range; label: string; word: string }[] = [
  { key: "1D", label: "1일", word: "어제보다" },
  { key: "1W", label: "1주", word: "1주 전보다" },
  { key: "1M", label: "1달", word: "1달 전보다" },
  { key: "3M", label: "3달", word: "3달 전보다" },
  { key: "1Y", label: "1년", word: "1년 전보다" },
];

const UP = "#F04452";
const DOWN = "#3182F6";
const FLAT = "#8B95A1";

function TopBar({ title }: { title?: string }) {
  const router = useRouter();
  return (
    <header className="flex h-14 items-center px-2">
      <button
        type="button"
        aria-label="뒤로"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/stocks");
        }}
        className="press flex h-11 w-11 items-center justify-center rounded-full text-ink"
      >
        <IconBack size={26} />
      </button>
      {title && <span className="ml-1 text-[15px] font-semibold text-mute">{title}</span>}
    </header>
  );
}

/** 주소에서 종목을 읽기 전(미리 만들어 두는 틀) */
export function DetailFallback() {
  return (
    <Screen>
      <div className="h-14" />
      <div className="px-5" role="status" aria-label="불러오는 중">
        <Skeleton className="h-11 w-11 !rounded-full" />
        <Skeleton className="mt-4 h-5 w-32" />
        <Skeleton className="mt-3 h-10 w-44" />
        <Skeleton className="mt-3 h-4 w-36" />
        <Skeleton className="mt-8 h-[200px] w-full !rounded-2xl" />
      </div>
    </Screen>
  );
}

export function StockDetailScreen() {
  const params = useParams<{ symbol: string }>();
  const symbol = useMemo(() => {
    try {
      return decodeURIComponent(params.symbol ?? "");
    } catch {
      return params.symbol ?? "";
    }
  }, [params.symbol]);

  const stocks = useStocks();
  const pf = usePortfolio();
  const symbols = useMemo(() => [symbol], [symbol]);
  const { prices, loading: priceLoading, error: priceError, reload: reloadPrice } = usePrices(symbols);

  const [range, setRange] = useState<Range>("1D");
  const [scrub, setScrub] = useState<HistoryPoint | null>(null);
  const [order, setOrder] = useState<"buy" | "sell" | null>(null);
  const history = useAsync(() => getHistory(symbol, range), [symbol, range]);

  const found = stocks.data?.find((s) => s.symbol === symbol);
  const price = prices[symbol];
  const held = pf.holdings.find((h) => h.symbol === symbol);

  if (stocks.loading && !stocks.data) return <DetailFallback />;

  if (stocks.error && !stocks.data) {
    return (
      <Screen>
        <TopBar />
        <ErrorState title="종목을 불러오지 못했어요" onRetry={stocks.reload} />
      </Screen>
    );
  }

  if (!found) {
    return (
      <Screen>
        <TopBar />
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="text-[44px] leading-none" aria-hidden="true">
            🤔
          </span>
          <h1 className="mt-4 text-[20px] font-bold text-ink">찾을 수 없는 종목이에요</h1>
          <p className="mt-1.5 text-[14px] text-mute">&lsquo;{symbol}&rsquo; 은 아직 거래할 수 없어요.</p>
          <Link href="/stocks" className={`${btnGray} mt-6 !h-12 !w-auto px-6 !text-[15px]`}>
            다른 주식 찾기
          </Link>
        </div>
      </Screen>
    );
  }

  const stock: Stock = found;
  const unit = unitOf(stock.kind);
  // 방금 바꾼 기간의 기록이 올 때까지는 이전 기록을 흐리게 보여 준다
  const points = history.data && history.data.length >= 2 ? history.data : undefined;
  const rangeInfo = RANGES.find((r) => r.key === range)!;

  // 등락: 1일은 24시간 등락률, 그 밖에는 기록의 처음과 지금을 비교
  const now = price?.price ?? points?.[points.length - 1]?.price;
  let diff: number | undefined;
  let ratio: number | undefined;
  let word = rangeInfo.word;
  if (scrub && points) {
    const base = points[0].price;
    diff = scrub.price - base;
    ratio = base > 0 ? diff / base : 0;
    word = range === "1D" || range === "1W" ? fmtDateTime(scrub.t) : fmtDate(scrub.t);
  } else if (range === "1D" && price) {
    ratio = price.change24h;
    diff = price.price - price.price / (1 + price.change24h);
  } else if (points && now !== undefined && !history.loading) {
    const base = points[0].price;
    diff = now - base;
    ratio = base > 0 ? diff / base : 0;
  }
  const shown = scrub?.price ?? now;
  const tone = toneOf(ratio ?? 0);

  const chartTone = points ? toneOf(points[points.length - 1].price / points[0].price - 1) : "flat";
  const chartColor = chartTone === "up" ? UP : chartTone === "down" ? DOWN : FLAT;

  const value = held ? held.qty * (price?.price ?? held.avgPrice) : 0;
  const gain = held && price ? held.qty * (price.price - held.avgPrice) : 0;
  const gainRatio = held && price && held.avgPrice > 0 ? price.price / held.avgPrice - 1 : 0;
  const gainTone = toneOf(gain, 0.005);

  return (
    <Screen>
      <TopBar title={stock.symbol} />

      <main className="flex flex-1 flex-col gap-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 104px)" }}>
        <section className="px-5 pt-1">
          <StockLogo symbol={stock.symbol} icon={stock.icon} size={44} />
          <h1 className="mt-3 text-[17px] font-semibold text-sub">{(stock.nameKo ?? stock.name)}</h1>
          {shown !== undefined ? (
            <p className="mt-0.5 text-[36px] font-bold leading-tight tracking-[-0.03em] tabular-nums text-ink">
              {fmtUsd(shown)}
            </p>
          ) : priceLoading || history.loading ? (
            <Skeleton className="mt-2 h-10 w-44" />
          ) : (
            <p className="mt-0.5 text-[36px] font-bold leading-tight text-faint">$—</p>
          )}
          <p className="mt-1 min-h-[22px] text-[15px] font-medium">
            {diff !== undefined && ratio !== undefined ? (
              <>
                <span className="text-mute">{word} </span>
                <span className={`tabular-nums ${toneText[tone]}`}>
                  {toneArrow[tone] && (
                    <span className="mr-0.5 text-[0.7em]" aria-hidden="true">
                      {toneArrow[tone]}
                    </span>
                  )}
                  {fmtSignedUsd(diff)} ({fmtPct(ratio)})
                </span>
              </>
            ) : priceLoading || history.loading ? (
              <Skeleton className="h-4 w-36" />
            ) : priceError ? (
              <button type="button" onClick={reloadPrice} className="-my-3 py-3 font-semibold text-primary">
                시세 다시 불러오기
              </button>
            ) : null}
          </p>
        </section>

        {/* 차트 */}
        <section className="pt-2">
          <div className={`transition-opacity ${history.loading && points ? "opacity-40" : ""}`}>
            {points ? (
              <Chart
                points={points}
                color={chartColor}
                onScrub={setScrub}
                label={`${(stock.nameKo ?? stock.name)} ${rangeInfo.label} 가격 그래프`}
              />
            ) : history.loading ? (
              <div className="px-5" role="status" aria-label="그래프 불러오는 중">
                <Skeleton className="h-[200px] w-full !rounded-2xl" />
              </div>
            ) : history.error ? (
              <div className="flex h-[200px] items-center justify-center">
                <ErrorState title="그래프를 불러오지 못했어요" message="" onRetry={history.reload} />
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-[14px] text-mute">
                이 기간에는 아직 기록이 없어요
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-1 px-4" role="group" aria-label="기간">
            {RANGES.map((r) => {
              const on = r.key === range;
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setScrub(null);
                    setRange(r.key);
                  }}
                  className={`press h-11 flex-1 rounded-full text-[14px] font-semibold ${
                    on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-mute"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 내 보유 */}
        <div className="flex flex-col gap-3 px-4 pt-2">
          {held && (
            <Card className="px-5 py-5">
              <h2 className="text-[18px] font-bold text-ink">내 {stock.kind === "crypto" ? "코인" : "주식"}</h2>
              <dl className="mt-4 space-y-3 text-[15px]">
                <Row label="가진 수량" value={`${fmtQty(held.qty)}${unit}`} />
                <Row label="지금 가치" value={fmtUsd(value)} strong />
                <Row label={`1${unit}당 산 가격`} value={fmtUsd(held.avgPrice)} />
                {price && (
                  <Row
                    label="수익"
                    value={`${fmtSignedUsd(gain)} (${fmtPct(gainRatio)})`}
                    className={toneText[gainTone]}
                  />
                )}
              </dl>
            </Card>
          )}

          <Card className="px-5 py-5">
            <h2 className="text-[16px] font-bold text-ink">토큰화 {stock.kind === "crypto" ? "자산" : "주식"}이에요</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-mute">
              {stock.kind === "crypto"
                ? `${(stock.nameKo ?? stock.name)} 가격을 따라 움직이는 토큰이에요. 1달러부터 살 수 있고, 원금을 잃을 수 있어요.`
                : `${(stock.nameKo ?? stock.name)} 주가를 따라 움직이는 토큰(증서)이에요. 실제 주식은 아니고, 1달러부터 살 수 있어요. 원금을 잃을 수 있어요.`}
            </p>
            <p className="mt-2 text-[12px] text-hint">시세·견적 제공: True Markets</p>
          </Card>
        </div>
      </main>

      {/* 아래 고정 버튼 */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] bg-gradient-to-t from-page from-70% to-transparent px-4 pt-6"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
      >
        <div className="flex gap-2">
          {held && (
            <button
              type="button"
              onClick={() => setOrder("sell")}
              className="press flex h-14 flex-1 items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white active:bg-primary-press"
            >
              팔기
            </button>
          )}
          <button
            type="button"
            onClick={() => setOrder("buy")}
            className="press flex h-14 flex-1 items-center justify-center rounded-btn bg-up text-[17px] font-bold text-white active:bg-up-press"
          >
            사기
          </button>
        </div>
      </div>

      <OrderSheet
        open={order !== null}
        onClose={() => setOrder(null)}
        stock={stock}
        side={order ?? "buy"}
        price={price?.price}
      />
    </Screen>
  );
}

function Row({ label, value, strong, className = "text-ink" }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sub">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-[17px] font-bold" : "font-semibold"} ${className}`}>{value}</dd>
    </div>
  );
}
