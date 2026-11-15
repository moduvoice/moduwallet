"use client";
// 홈(지갑): 총액 · 오늘 변화 · 빠른 동작 · 보유 자산 · 레버리지 · 둘러보기
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { displayName, useLang, useT } from "@/i18n";
import { positionPnl, todayChange, usePortfolio } from "@/lib/client";
import { LocalHint, MarketChip, StaleNote } from "../chrome";
import { HeaderTools } from "../DemoBadge";
import { fmtPct, fmtSignedUsd, fmtUsd, stockHref, toneArrow, toneOf, toneText } from "../format";
import { IconBag, IconChevron, IconPlus, IconSend } from "../icons";
import { Wordmark } from "../Logo";
import { usePrices, useStocks } from "../market";
import { positionValue, usePerpPrices, usePerps } from "../perp";
import { PositionList } from "../Positions";
import { Sheet } from "../Sheet";
import { TabBar } from "../TabBar";
import { btnPrimary, Card, DollarLogo, ErrorState, qtyText, RowSkeleton, Screen, Skeleton, StockLogo, StockRow } from "../ui";

const POPULAR_COUNT = 5;

export function HomeScreen() {
  const t = useT();
  const lang = useLang();
  const pf = usePortfolio();
  const stocks = useStocks();
  const [soon, setSoon] = useState<"deposit" | "send" | null>(null);

  // 서버가 인기순으로 주므로 앞에서부터 고른다(코인 제외)
  const popular = useMemo(() => (stocks.data ?? []).filter((x) => x.kind !== "crypto").slice(0, POPULAR_COUNT), [stocks.data]);

  const symbols = useMemo(
    () => [...pf.holdings.map((h) => h.symbol), ...popular.map((s) => s.symbol)],
    [pf.holdings, popular],
  );
  const { prices, loading: pricesLoading, error: pricesError, reload: reloadPrices } = usePrices(symbols);

  // 레버리지: 진행 중인 것이 있을 때만 가격을 받는다(15초마다)
  const perps = usePerps();
  const positions = useMemo(() => pf.positions ?? [], [pf.positions]);
  const perpSymbols = useMemo(() => positions.map((p) => p.symbol), [positions]);
  const { prices: perpPrices, loading: perpLoading } = usePerpPrices(perpSymbols);
  const hasPositions = positions.length > 0;
  let levValue = 0; // 넣은 돈 + 손익
  let levPnl = 0;
  for (const pos of positions) {
    const pp = perpPrices[pos.symbol]?.price;
    levValue += positionValue(pos, pp);
    if (pp) levPnl += Math.max(-pos.margin, positionPnl(pos, pp));
  }

  // 총액 = USDC + 보유 주식 × 현재가 + 레버리지(넣은 돈 + 손익). 시세를 못 받은 종목은 산 가격으로 계산한다.
  const hasHoldings = pf.holdings.length > 0;
  const missing = pf.holdings.some((h) => !prices[h.symbol]);
  let stockValue = 0;
  let oldest: string | undefined; // 가장 오래된 시세 시각
  for (const h of pf.holdings) {
    const p = prices[h.symbol];
    stockValue += h.qty * (p?.price ?? h.avgPrice);
    if (p?.at && (!oldest || p.at < oldest)) oldest = p.at;
  }
  // 오늘 손익: 오늘 산 것은 산 가격부터 센다(사자마자 큰 마이너스로 보이지 않게)
  const today = hasHoldings ? todayChange(pf, Object.values(prices)) : { change: 0, ratio: 0 };
  const dayTone = toneOf(today.change, 0.005);
  const total = pf.usdc + stockValue + levValue;
  const totalLoading =
    (hasHoldings && missing && pricesLoading) || (hasPositions && perpLoading && positions.some((p) => !perpPrices[p.symbol]));
  const stockShare = total > 0 ? stockValue / total : 0;
  const levShare = total > 0 ? levValue / total : 0;
  const levTone = toneOf(levPnl, 0.005);
  const neverTraded = pf.trades.length === 0;

  return (
    <Screen tabbar>
      <header className="flex h-14 items-center justify-between gap-2 pl-5 pr-5">
        <h1 className="min-w-0">
          <Wordmark />
        </h1>
        <HeaderTools />
      </header>

      <main className="flex flex-col gap-3 px-4">
        {/* 총액 */}
        <Card className="px-5 pb-5 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-medium text-mute">{t("home.wallet")}</p>
            <MarketChip />
          </div>
          {totalLoading ? (
            <div role="status" aria-label={t("c.loading")}>
              <Skeleton className="mt-2 h-10 w-44" />
              <Skeleton className="mt-3 h-4 w-32" />
            </div>
          ) : (
            <>
              <p className="mt-1 text-[36px] font-bold leading-tight tracking-[-0.03em] tabular-nums text-ink">{fmtUsd(total)}</p>
              <LocalHint usd={total} />
              <p className="mt-1 text-[15px] font-medium">
                {hasHoldings ? (
                  <>
                    <span className="text-mute">{t("home.today")} </span>
                    <span className={`tabular-nums ${toneText[dayTone]}`}>
                      {toneArrow[dayTone] && (
                        <span className="mr-0.5 text-[0.7em]" aria-hidden="true">
                          {toneArrow[dayTone]}
                        </span>
                      )}
                      {fmtSignedUsd(today.change)} ({fmtPct(today.ratio)})
                    </span>
                    <StaleNote at={oldest} className="ml-2" />
                  </>
                ) : hasPositions ? (
                  <>
                    <span className="text-mute">{t("home.levPnl")} </span>
                    <span className={`tabular-nums ${toneText[levTone]}`}>{fmtSignedUsd(levPnl)}</span>
                  </>
                ) : (
                  <span className="text-mute">{t("home.noStocks")}</span>
                )}
              </p>
            </>
          )}

          {(hasHoldings || hasPositions) && !totalLoading && (
            <div className="mt-5">
              <div
                className="flex h-2 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={t("home.share.aria", { stocks: Math.round(stockShare * 100), lev: Math.round(levShare * 100) })}
              >
                {stockShare > 0 && <span className="rounded-full bg-primary" style={{ width: `${stockShare * 100}%` }} />}
                {levShare > 0 && <span className="rounded-full bg-violet" style={{ width: `${levShare * 100}%` }} />}
                <span className="flex-1 rounded-full bg-fill-strong" />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] text-mute">
                {(hasHoldings || !hasPositions) && (
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    {t("home.legend.stocks")} <b className="font-semibold tabular-nums text-sub">{fmtUsd(stockValue)}</b>
                  </span>
                )}
                {hasPositions && (
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-violet" aria-hidden="true" />
                    {t("home.legend.lev")} <b className="font-semibold tabular-nums text-sub">{fmtUsd(levValue)}</b>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-fill-strong" aria-hidden="true" />
                  {t("home.legend.cash")} <b className="font-semibold tabular-nums text-sub">{fmtUsd(pf.usdc)}</b>
                </span>
              </div>
            </div>
          )}

          {hasHoldings && missing && !pricesLoading && (
            <p className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-fill px-3 py-1 text-[13px] text-sub" role="alert">
              {t("home.priceFallback")}
              <button type="button" onClick={reloadPrices} className="min-h-11 shrink-0 pl-2 font-semibold text-primary">
                {t("c.retry")}
              </button>
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Action label={t("act.deposit")} onClick={() => setSoon("deposit")} icon={<IconPlus size={20} />} />
            <Action label={t("act.buy")} href="/stocks" primary icon={<IconBag size={20} />} />
            <Action label={t("act.send")} onClick={() => setSoon("send")} icon={<IconSend size={20} />} />
          </div>
        </Card>

        {/* 보유 자산 */}
        <Card className="pb-2 pt-5">
          <h2 className="px-5 pb-1 text-[18px] font-bold text-ink">{t("home.assets")}</h2>
          <div className="flex min-h-[68px] items-center gap-3 px-5 py-3">
            <DollarLogo />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-ink">{t("home.usd.name")}</span>
              <span className="block text-[13px] text-mute">{t("home.usd.sub")}</span>
            </span>
            <span className="shrink-0 text-[16px] font-semibold tabular-nums text-ink">{fmtUsd(pf.usdc)}</span>
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
                  <span className="block truncate text-[16px] font-semibold text-ink">{displayName(lang, meta, h.symbol)}</span>
                  <span className="block text-[13px] tabular-nums text-mute">{qtyText(t, meta?.kind, h.qty)}</span>
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
                        <span className="block text-[13px] text-hint">{t("home.costBasis")}</span>
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

          {/* 한 번도 거래한 적이 없을 때만 */}
          {neverTraded && !hasHoldings && (
            <div className="mx-4 mb-3 mt-1 rounded-[18px] bg-primary-soft px-5 py-5">
              <p className="text-[17px] font-bold leading-snug text-ink">{t("home.first.title")}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-sub">{t("home.first.body")}</p>
              <Link href="/stocks" className={`${btnPrimary} mt-4 !h-12 !text-[16px]`}>
                {t("home.first.cta")}
              </Link>
            </div>
          )}
        </Card>

        {/* 레버리지(진행 중인 것이 있을 때만 보임) */}
        <PositionList
          positions={positions}
          markets={perps.data}
          prices={perpPrices}
          loading={perpLoading}
          header={
            <div className="flex items-center justify-between pl-1">
              <h2 className="text-[15px] font-bold text-sub">
                {t("home.legend.lev")} <span className="tabular-nums text-primary">{positions.length}</span>
              </h2>
              <Link href="/leverage" className="press flex h-11 items-center gap-0.5 px-2 text-[14px] font-semibold text-mute">
                {t("c.viewAll")}
                <IconChevron size={16} />
              </Link>
            </div>
          }
        />

        {/* 둘러보기 */}
        <Card className="pb-2 pt-5">
          <div className="flex items-center justify-between pl-5 pr-2">
            <h2 className="text-[18px] font-bold text-ink">{t("home.explore")}</h2>
            <Link href="/stocks" className="press flex h-11 items-center gap-0.5 px-3 text-[14px] font-semibold text-mute">
              {t("c.viewAll")}
              <IconChevron size={16} />
            </Link>
          </div>
          {stocks.loading && !stocks.data ? (
            <RowSkeleton rows={POPULAR_COUNT} />
          ) : stocks.error && !stocks.data ? (
            <ErrorState title={t("home.stocksFail")} onRetry={stocks.reload} />
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
                    className="press min-h-11 w-full rounded-xl bg-fill px-3 text-[14px] font-semibold text-sub"
                  >
                    {t("price.reload")}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>

        <p className="px-2 pb-2 pt-1 text-[12px] leading-relaxed text-hint">
          {t("home.foot")}{" "}
          <Link href="/terms" className="font-semibold underline underline-offset-2">
            {t("menu.terms")}
          </Link>
        </p>
      </main>

      <TabBar active="home" />

      <Sheet open={soon !== null} onClose={() => setSoon(null)} label={t(soon === "send" ? "soon.send.title" : "soon.deposit.title")}>
        {(close) => (
          <div className="px-6 pt-7 text-center">
            <span className="text-[44px] leading-none" aria-hidden="true">
              🚧
            </span>
            <h2 className="mt-4 text-[22px] font-bold leading-snug text-ink">
              {t(soon === "send" ? "soon.send.title" : "soon.deposit.title")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-mute">{t("soon.body")}</p>
            <button type="button" className={`${btnPrimary} mt-7`} onClick={close}>
              {t("c.ok")}
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
  const cls = `press flex h-[52px] w-full min-w-0 items-center justify-center gap-1 rounded-btn px-1.5 text-[14px] font-bold ${
    primary ? "bg-primary text-white active:bg-primary-press" : "bg-fill text-sub active:bg-fill-strong"
  }`;
  const inner = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
