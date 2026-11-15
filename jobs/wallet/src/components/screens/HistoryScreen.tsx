"use client";
// 거래 내역: 실현 손익 요약 + 날짜별 목록
import Link from "next/link";
import { useMemo } from "react";
import { displayName, useLang, useT } from "@/i18n";
import { usePortfolio } from "@/lib/client";
import type { Trade } from "@/lib/types";
import { HeaderTools } from "../DemoBadge";
import { fmtDay, fmtSignedUsd, fmtTime, fmtUsd, stockHref, toneOf, toneText } from "../format";
import { useStocks } from "../market";
import { SIDE, usePerps } from "../perp";
import { TabBar } from "../TabBar";
import { btnPrimary, Card, EmptyState, qtyText, Screen, StockLogo } from "../ui";

export function HistoryScreen() {
  const t = useT();
  const lang = useLang();
  const { trades } = usePortfolio();
  const stocks = useStocks();
  const perps = usePerps();

  // lang 이 바뀌면 날짜 글자도 다시 만든다
  const groups = useMemo(() => {
    const out: { day: string; items: Trade[] }[] = [];
    for (const tr of trades) {
      const day = lang ? fmtDay(tr.at) : "";
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(tr);
      else out.push({ day, items: [tr] });
    }
    return out;
  }, [trades, lang]);

  // 요약: 이미 끝난 거래의 손익 합계, 지금까지 낸 수수료
  const realized = trades.reduce((sum, tr) => sum + (tr.pnl ?? 0), 0);
  const fees = trades.reduce((sum, tr) => sum + (tr.fee ?? 0), 0);
  const realizedTone = toneOf(realized, 0.005);

  return (
    <Screen tabbar>
      <header className="px-5 pb-3 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-[24px] font-bold text-ink">{t("hist.title")}</h1>
          <HeaderTools />
        </div>
        {trades.length > 0 && <p className="text-[14px] text-mute">{t("hist.count", { n: trades.length })}</p>}
      </header>

      <main className="flex flex-col gap-3 px-4">
        {trades.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🧾"
              title={t("hist.empty.title")}
              message={t("hist.empty.body")}
              action={
                <Link href="/stocks" className={`${btnPrimary} !h-12 px-6 !text-[16px]`}>
                  {t("home.first.cta")}
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <Card className="grid grid-cols-2 gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-mute">{t("hist.sum.pnl")}</p>
                <p className={`mt-0.5 text-[20px] font-bold tabular-nums ${toneText[realizedTone]}`}>{fmtSignedUsd(realized)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-mute">{t("hist.sum.fees")}</p>
                <p className="mt-0.5 text-[20px] font-bold tabular-nums text-ink">{fmtUsd(fees)}</p>
              </div>
            </Card>

            {groups.map((g) => (
              <Card key={g.day + g.items[0].id} className="pb-2 pt-4">
                <h2 className="px-5 pb-1 text-[14px] font-semibold text-mute">{g.day}</h2>
                <ul>
                  {g.items.map((tr) => {
                    if (tr.kind && tr.kind !== "spot") {
                      const m = perps.data?.find((x) => x.symbol === tr.symbol);
                      return (
                        <li key={tr.id}>
                          <PerpRow tr={tr} name={displayName(lang, m, tr.symbol)} icon={m?.icon} />
                        </li>
                      );
                    }
                    const meta = stocks.data?.find((s) => s.symbol === tr.symbol);
                    const buy = tr.side === "buy";
                    const hasPnl = !buy && typeof tr.pnl === "number";
                    return (
                      <li key={tr.id}>
                        <Link href={stockHref(tr.symbol)} className="row-press flex min-h-[68px] items-center gap-3 px-5 py-3">
                          <StockLogo symbol={tr.symbol} icon={meta?.icon} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[16px] font-semibold text-ink">{displayName(lang, meta, tr.symbol)}</span>
                              <Badge className={buy ? "bg-up-soft text-up" : "bg-down-soft text-down"}>
                                {t(buy ? "hist.badge.buy" : "hist.badge.sell")}
                              </Badge>
                            </span>
                            <span className="block truncate text-[13px] tabular-nums text-mute">
                              {fmtTime(tr.at)} · {qtyText(t, meta?.kind, tr.qty)} · {fmtUsd(tr.price)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[16px] font-semibold tabular-nums text-ink">
                              {buy ? "-" : "+"}
                              {fmtUsd(tr.usd)}
                            </span>
                            {hasPnl ? (
                              <span className={`block text-[12px] font-medium tabular-nums ${toneText[toneOf(tr.pnl ?? 0, 0.005)]}`}>
                                {t("hist.pnl", { v: fmtSignedUsd(tr.pnl ?? 0) })}
                              </span>
                            ) : (
                              <span className="block text-[12px] tabular-nums text-hint">{t("hist.fee", { v: fmtUsd(tr.fee) })}</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
            <p className="px-2 pb-2 text-center text-[12px] text-hint">{t("hist.foot")}</p>
          </>
        )}
      </main>

      <TabBar active="history" />
    </Screen>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-bold ${className}`}>{children}</span>;
}

/** 레버리지 거래 한 줄: 시작 / 정리 / 청산 */
function PerpRow({ tr, name, icon }: { tr: Trade; name: string; icon?: string }) {
  const t = useT();
  const side = tr.positionSide ?? (tr.side === "buy" ? "long" : "short");
  const s = SIDE[side];
  const pnl = tr.pnl ?? 0;
  const tone = toneOf(pnl, 0.005);
  const open = tr.kind === "perp-open";
  const dead = tr.kind === "perp-liquidated";
  return (
    <Link href="/leverage" className="row-press flex min-h-[68px] items-center gap-3 px-5 py-3">
      <StockLogo symbol={tr.symbol} icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[16px] font-semibold text-ink">{name}</span>
          <Badge className={dead ? "bg-ink text-white" : open ? `${s.soft} ${s.text}` : "bg-fill text-sub"}>
            {t(dead ? "hist.badge.liq" : open ? "hist.badge.open" : "hist.badge.close")}
          </Badge>
        </span>
        <span className="block truncate text-[13px] tabular-nums text-mute">
          {fmtTime(tr.at)} · {t("lev.x", { n: tr.leverage ?? 1 })} {t(s.dir)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {open ? (
          <>
            <span className="block text-[16px] font-semibold tabular-nums text-ink">-{fmtUsd(tr.usd)}</span>
            <span className="block text-[12px] tabular-nums text-hint">{t("hist.fee", { v: fmtUsd(tr.fee) })}</span>
          </>
        ) : (
          <>
            <span className="block text-[16px] font-semibold tabular-nums text-ink">{dead ? fmtUsd(0) : `+${fmtUsd(tr.usd)}`}</span>
            <span className={`block text-[12px] font-medium tabular-nums ${toneText[tone]}`}>
              {t(dead ? "hist.lostAll" : "hist.pnl", { v: fmtSignedUsd(pnl) })}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}
