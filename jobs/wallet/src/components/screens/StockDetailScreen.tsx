"use client";
// 종목 상세: 가격 · 차트 · 내 보유 · 사기/팔기
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { displayName, useLang, useT, type Key } from "@/i18n";
import { getHistory, useAsync, useOnline, usePortfolio } from "@/lib/client";
import type { HistoryPoint, Range, Stock } from "@/lib/types";
import { Chart } from "../Chart";
import { MarketChip, StaleNote, useMarket } from "../chrome";
import { fmtDate, fmtDateTime, fmtPct, fmtSignedUsd, fmtUsd, toneArrow, toneOf, toneText } from "../format";
import { IconBack, IconBolt, IconChevron } from "../icons";
import { usePrices, useStocks } from "../market";
import { OrderSheet } from "../OrderSheet";
import { usePerpPrices, usePerps } from "../perp";
import { PerpOpenSheet } from "../PerpOpenSheet";
import { btnGray, Card, ErrorState, qtyText, Screen, Skeleton, StockLogo } from "../ui";

const RANGES: { key: Range; label: Key; word: Key }[] = [
  { key: "1D", label: "range.1D", word: "range.vs.1D" },
  { key: "1W", label: "range.1W", word: "range.vs.1W" },
  { key: "1M", label: "range.1M", word: "range.vs.1M" },
  { key: "3M", label: "range.3M", word: "range.vs.3M" },
  { key: "1Y", label: "range.1Y", word: "range.vs.1Y" },
];

function TopBar({ title }: { title?: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <header className="flex h-14 items-center px-2">
      <button
        type="button"
        aria-label={t("c.back")}
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
      <div className="px-5" aria-hidden="true">
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
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const market = useMarket();
  const params = useParams<{ symbol: string }>();
  // 주소의 기호는 대소문자를 가리지 않는다(/stocks/nvda 도 됨)
  const symbol = useMemo(() => {
    const raw = params.symbol ?? "";
    try {
      return decodeURIComponent(raw).toUpperCase();
    } catch {
      return raw.toUpperCase();
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

  const found = stocks.data?.find((s) => s.symbol.toUpperCase() === symbol);
  const price = prices[found?.symbol ?? symbol];
  const held = pf.holdings.find((h) => h.symbol === (found?.symbol ?? symbol));

  if (stocks.loading && !stocks.data) return <DetailFallback />;

  if (stocks.error && !stocks.data) {
    return (
      <Screen>
        <TopBar />
        <ErrorState title={t("home.stocksFail")} onRetry={stocks.reload} />
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
          <h1 className="mt-4 text-[20px] font-bold text-ink">{t("detail.notFound.title")}</h1>
          <p className="mt-1.5 text-[14px] text-mute">{t("detail.notFound.body", { symbol })}</p>
          <Link href="/stocks" className={`${btnGray} mt-6 !h-12 !w-auto px-6 !text-[15px]`}>
            {t("detail.notFound.cta")}
          </Link>
        </div>
      </Screen>
    );
  }

  const stock: Stock = found;
  const coin = stock.kind === "crypto";
  const name = displayName(lang, stock);
  // 방금 바꾼 기간의 기록이 올 때까지는 이전 기록을 흐리게 보여 준다
  const points = history.data && history.data.length >= 2 ? history.data : undefined;
  const rangeInfo = RANGES.find((r) => r.key === range)!;

  // 등락: 1일은 24시간 등락률, 그 밖에는 기록의 처음과 지금을 비교
  const now = price?.price ?? points?.[points.length - 1]?.price;
  let diff: number | undefined;
  let ratio: number | undefined;
  let word = t(rangeInfo.word);
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

  const value = held ? held.qty * (price?.price ?? held.avgPrice) : 0;
  const gain = held && price ? held.qty * (price.price - held.avgPrice) : 0;
  const gainRatio = held && price && held.avgPrice > 0 ? price.price / held.avgPrice - 1 : 0;
  const gainTone = toneOf(gain, 0.005);

  return (
    <Screen>
      <TopBar title={stock.symbol} />

      <main className="flex flex-1 flex-col gap-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 104px)" }}>
        <section className="px-5 pt-1">
          <div className="flex items-start justify-between gap-2">
            <StockLogo symbol={stock.symbol} icon={stock.icon} size={44} />
            {!coin && <MarketChip />}
          </div>
          <h1 className="mt-3 text-[17px] font-semibold text-sub">{name}</h1>
          {shown !== undefined ? (
            <p className="mt-0.5 text-[36px] font-bold leading-tight tracking-[-0.03em] tabular-nums text-ink">{fmtUsd(shown)}</p>
          ) : priceLoading || history.loading ? (
            <Skeleton className="mt-2 h-10 w-44" />
          ) : (
            <p className="mt-0.5 text-[36px] font-bold leading-tight text-faint">$—</p>
          )}
          <p className="mt-1 flex min-h-[22px] flex-wrap items-center gap-x-1.5 text-[15px] font-medium">
            {diff !== undefined && ratio !== undefined ? (
              <>
                <span className="text-mute">{word}</span>
                <span className={`tabular-nums ${toneText[tone]}`}>
                  {toneArrow[tone] && (
                    <span className="mr-0.5 text-[0.7em]" aria-hidden="true">
                      {toneArrow[tone]}
                    </span>
                  )}
                  {fmtSignedUsd(diff)} ({fmtPct(ratio)})
                </span>
                {!scrub && <StaleNote at={price?.at} />}
              </>
            ) : priceLoading || history.loading ? (
              <Skeleton className="h-4 w-36" />
            ) : priceError ? (
              <button type="button" onClick={reloadPrice} className="-my-3 py-3 font-semibold text-primary">
                {t("price.reload")}
              </button>
            ) : null}
          </p>
          {!coin && market && !market.open && <p className="mt-2 text-[12px] leading-relaxed text-hint">{t("market.closedNote")}</p>}
        </section>

        {/* 차트 */}
        <section className="pt-2">
          <div className={`transition-opacity ${history.loading && points ? "opacity-40" : ""}`}>
            {points ? (
              <Chart
                points={points}
                tone={chartTone}
                onScrub={setScrub}
                label={t("detail.chart.aria", { name, range: t(rangeInfo.label) })}
              />
            ) : history.loading ? (
              <div className="px-5" role="status" aria-label={t("detail.chart.loading")}>
                <Skeleton className="h-[200px] w-full !rounded-2xl" />
              </div>
            ) : history.error ? (
              <div className="flex h-[200px] items-center justify-center">
                <ErrorState title={t("detail.chart.fail")} message="" onRetry={history.reload} />
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center px-6 text-center text-[14px] text-mute">
                {t("detail.chart.empty")}
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-1 px-4" role="group" aria-label={t("detail.range.aria")}>
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
                  className={`press h-11 min-w-0 flex-1 truncate rounded-full px-1 text-[14px] font-semibold ${
                    on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-mute"
                  }`}
                >
                  {t(r.label)}
                </button>
              );
            })}
          </div>
        </section>

        {/* 내 보유 */}
        <div className="flex flex-col gap-3 px-4 pt-2">
          {held && (
            <Card className="px-5 py-5">
              <h2 className="text-[18px] font-bold text-ink">{t(coin ? "detail.mine.coin" : "detail.mine.stock")}</h2>
              <dl className="mt-4 space-y-3 text-[15px]">
                <Row label={t("detail.qty")} value={qtyText(t, stock.kind, held.qty)} />
                <Row label={t("detail.value")} value={fmtUsd(value)} strong />
                <Row label={t(coin ? "detail.avg.coin" : "detail.avg.share")} value={fmtUsd(held.avgPrice)} />
                {price && (
                  <Row label={t("detail.gain")} value={`${fmtSignedUsd(gain)} (${fmtPct(gainRatio)})`} className={toneText[gainTone]} />
                )}
              </dl>
            </Card>
          )}

          <LeverageEntry symbol={stock.symbol} />

          <Card className="px-5 py-5">
            <h2 className="text-[16px] font-bold text-ink">{t(coin ? "detail.token.title.coin" : "detail.token.title.stock")}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-mute">
              {t(coin ? "detail.token.body.coin" : "detail.token.body.stock", { name })}
            </p>
            <p className="mt-2 text-[12px] text-hint">
              {t("detail.source")} ·{" "}
              <Link href="/terms" className="font-semibold underline underline-offset-2">
                {t("menu.terms")}
              </Link>
            </p>
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
              disabled={!online}
              className="press flex h-14 min-w-0 flex-1 items-center justify-center rounded-btn bg-down px-2 text-[17px] font-bold text-white active:bg-down-press disabled:bg-fill-strong disabled:text-faint"
            >
              {t("act.sell")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOrder("buy")}
            disabled={!online}
            className="press flex h-14 min-w-0 flex-1 items-center justify-center rounded-btn bg-up px-2 text-[17px] font-bold text-white active:bg-up-press disabled:bg-fill-strong disabled:text-faint"
          >
            {t("act.buy")}
          </button>
        </div>
      </div>

      <OrderSheet open={order !== null} onClose={() => setOrder(null)} stock={stock} side={order ?? "buy"} price={price?.price} />
    </Screen>
  );
}

/** 같은 종목을 레버리지로도 거래할 수 있으면 보여 주는 입구 */
function LeverageEntry({ symbol }: { symbol: string }) {
  const t = useT();
  const perps = usePerps();
  const market = perps.data?.find((m) => m.symbol === symbol);
  const symbols = useMemo(() => (market ? [market.symbol] : []), [market]);
  const { prices } = usePerpPrices(symbols);
  const [open, setOpen] = useState(false);
  if (!market) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex min-h-[64px] w-full items-center gap-3 rounded-card bg-card px-5 py-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill text-ink" aria-hidden="true">
          <IconBolt size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-ink">{t("detail.lev.title")}</span>
          <span className="block text-[13px] leading-snug text-mute">{t("detail.lev.sub", { n: market.maxLeverage })}</span>
        </span>
        <IconChevron size={18} className="shrink-0 text-faint" />
      </button>
      <PerpOpenSheet open={open} onClose={() => setOpen(false)} market={market} price={prices[market.symbol]} />
    </>
  );
}

function Row({ label, value, strong, className = "text-ink" }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-sub">{label}</dt>
      <dd className={`shrink-0 text-right tabular-nums ${strong ? "text-[17px] font-bold" : "font-semibold"} ${className}`}>{value}</dd>
    </div>
  );
}
