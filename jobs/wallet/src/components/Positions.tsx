"use client";
// 진행 중인 레버리지: 카드 · 정리하기 시트 (청산 알림은 chrome.tsx 가 어느 화면에서든 띄운다)
import { useEffect, useState, type ReactNode } from "react";
import { displayName, useLang, useT } from "@/i18n";
import { closePositionDemo, getPerpCloseQuote, positionPnl, positionRoe, useOnline } from "@/lib/client";
import type { PerpCloseQuote, PerpMarket, Position, Price, Trade } from "@/lib/types";
import { LocalHint, StaleNote } from "./chrome";
import { fmtPct, fmtSignedUsd, fmtUsd, toneOf, toneText } from "./format";
import { IconClose } from "./icons";
import {
  CheckBurst,
  isExpired,
  quoteErrorKey,
  quoteErrorOf,
  QuoteRow,
  QuoteSource,
  Spinner,
  useQuoteExpiry,
  type QuoteError,
} from "./orderKit";
import { fmtRate, remainToLiq, SIDE } from "./perp";
import { Sheet } from "./Sheet";
import { btnGray, btnPrimary, Skeleton, StockLogo } from "./ui";

type Named = { name: string; icon?: string };

/**
 * 진행 중인 레버리지 목록(카드들 + 정리하기 시트).
 * 포지션이 없으면 아무것도 안 보이지만, 정리 완료 화면이 끝까지 보이도록 항상 화면에 넣어 둔다.
 */
export function PositionList({
  positions,
  markets,
  prices,
  loading,
  header,
}: {
  header?: ReactNode;
  positions: Position[];
  markets?: PerpMarket[];
  prices: Record<string, Price>;
  loading?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [target, setTarget] = useState<Position | null>(null); // 시트가 열려 있는 동안 붙잡아 둔다(정리 후에도 완료 화면 유지)

  const infoOf = (symbol: string): Named => {
    const m = markets?.find((x) => x.symbol === symbol);
    return { name: displayName(lang, m, symbol), icon: m?.icon };
  };

  return (
    <>
      {positions.length > 0 && (
        <section aria-label={t("lev.active.aria")}>
          {header}
          <ul className="flex flex-col gap-3">
            {positions.map((pos) => (
              <li key={pos.id}>
                <PositionCard
                  pos={pos}
                  info={infoOf(pos.symbol)}
                  price={prices[pos.symbol]}
                  loading={loading}
                  onClose={() => {
                    setTarget(pos);
                    setClosingId(pos.id);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <Sheet open={closingId !== null && target !== null} onClose={() => setClosingId(null)} label={t("close.aria")}>
        {(close) => target && <CloseBody pos={target} info={infoOf(target.symbol)} close={close} />}
      </Sheet>
    </>
  );
}

function PositionCard({
  pos,
  info,
  price: quoteOfNow,
  loading,
  onClose,
}: {
  pos: Position;
  info: Named;
  price?: Price;
  loading?: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const online = useOnline();
  const s = SIDE[pos.side];
  const price = quoteOfNow?.price;
  const pnl = price ? positionPnl(pos, price) : 0;
  const roe = price ? positionRoe(pos, price) : 0;
  const tone = toneOf(pnl, 0.005);

  // 청산까지 남은 거리. 막대는 "처음 거리 대비 얼마나 남았나"
  const remain = price ? Math.max(0, remainToLiq(pos, price)) : undefined;
  const initial = pos.entry > 0 ? Math.abs(pos.entry - pos.liqPrice) / pos.entry : 0;
  const health = remain !== undefined && initial > 0 ? Math.min(1, remain / initial) : 1;
  const level = health > 0.5 ? "ok" : health > 0.25 ? "warn" : "bad";
  const barColor = { ok: "bg-ok", warn: "bg-warn", bad: "bg-danger" }[level];
  const barText = { ok: "text-sub", warn: "text-warn", bad: "text-danger" }[level];

  return (
    <article className="rounded-card bg-card px-5 pb-4 pt-5">
      <div className="flex items-center gap-3">
        <StockLogo symbol={pos.symbol} icon={info.icon} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold text-ink">{info.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-bold">
            <span className="rounded-md bg-fill px-1.5 py-0.5 tabular-nums text-sub">{t("lev.x", { n: pos.leverage })}</span>
            <span className={`rounded-md px-1.5 py-0.5 ${s.soft} ${s.text}`}>
              {t(s.dir)} <span className="font-medium opacity-80">{t(s.word)}</span>
            </span>
          </p>
        </div>
      </div>

      {price ? (
        <>
          <p className={`mt-4 text-[28px] font-bold leading-tight tracking-[-0.02em] tabular-nums ${toneText[tone]}`}>
            {fmtSignedUsd(pnl)}
            <span className="ml-1.5 text-[16px] font-semibold">({fmtPct(roe)})</span>
          </p>
          <p className="mt-0.5 text-[13px] tabular-nums text-mute">
            {t("pos.value", { a: fmtUsd(pos.margin), b: fmtUsd(Math.max(0, pos.margin + pnl)) })}
          </p>
        </>
      ) : loading ? (
        <div role="status" aria-label={t("c.loading")}>
          <Skeleton className="mt-4 h-8 w-40" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      ) : (
        <p className="mt-4 text-[15px] text-mute">{t("pos.noPrice", { v: fmtUsd(pos.margin) })}</p>
      )}

      {remain !== undefined && (
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-fill-strong"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(health * 100)}
            aria-label={t("pos.meter.aria")}
          >
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${barColor}`}
              style={{ width: `${Math.max(3, health * 100)}%` }}
            />
          </div>
          <p className={`mt-2 text-[13px] font-semibold ${barText}`}>
            {level === "bad" && <span aria-hidden="true">🚨 </span>}
            {t("pos.remain", { pct: fmtRate(remain) })}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed tabular-nums text-mute">
            {t("pos.liqAt", { now: fmtUsd(price ?? 0), liq: fmtUsd(pos.liqPrice) })}
            <StaleNote at={quoteOfNow?.at} className="ml-1.5" />
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        disabled={!online}
        className="press mt-4 flex h-12 w-full items-center justify-center rounded-btn bg-fill px-3 text-center text-[15px] font-bold leading-tight text-sub active:bg-fill-strong disabled:text-faint"
      >
        {t("pos.close")}
      </button>
    </article>
  );
}

function CloseBody({ pos, info, close }: { pos: Position; info: Named; close: () => void }) {
  const t = useT();
  const online = useOnline();
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ nonce: number; quote?: PerpCloseQuote; error?: QuoteError }>();
  const [trade, setTrade] = useState<Trade>();
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    let alive = true;
    getPerpCloseQuote(pos)
      .then((q) => alive && setResult({ nonce, quote: q }))
      .catch((e) => alive && setResult({ nonce, error: quoteErrorOf(e) }));
    return () => {
      alive = false;
    };
  }, [pos, nonce]);

  const fresh = result && result.nonce === nonce ? result : undefined;
  const quote = fresh?.quote;
  const loading = !fresh;
  useQuoteExpiry(quote?.expiresAt, !trade, () => setNonce((n) => n + 1));

  const submit = () => {
    if (!quote) return;
    if (isExpired(quote)) {
      setSubmitError(t("quote.expired"));
      setNonce((n) => n + 1);
      return;
    }
    try {
      setTrade(closePositionDemo(pos.id, quote));
      navigator.vibrate?.(12);
    } catch {
      setSubmitError(t("err.close"));
    }
  };

  if (trade) {
    const pnl = trade.pnl ?? 0;
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckBurst />
        <h2 className="anim-rise mt-6 text-[24px] font-bold leading-snug text-ink" role="status">
          {t("close.done", { name: info.name, n: pos.leverage })}
        </h2>
        <p className="anim-rise mt-2 text-[15px] text-mute">
          {t("close.done.body", { v: fmtUsd(trade.usd) })} ·{" "}
          <span className={`font-semibold ${toneText[toneOf(pnl, 0.005)]}`}>{fmtSignedUsd(pnl)}</span>
        </p>
        <button type="button" onClick={close} className={`${btnPrimary} mt-9`}>
          {t("c.ok")}
        </button>
      </div>
    );
  }

  const openFee = pos.openFee ?? 0;
  const pnl = quote ? positionPnl(pos, quote.price) : 0;
  const back = quote ? Math.max(0, pos.margin + pnl - quote.fee) : 0;
  const net = back - pos.margin - openFee; // 여는 수수료까지 포함한 실제 손익
  const tone = toneOf(net, 0.005);

  return (
    <div>
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <StockLogo symbol={pos.symbol} icon={info.icon} size={32} />
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">{t("close.title", { name: info.name, n: pos.leverage })}</h2>
        <button
          type="button"
          onClick={close}
          aria-label={t("c.close")}
          className="press -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute"
        >
          <IconClose size={22} />
        </button>
      </div>
      <div className="px-6 pt-5">
        <p className="text-[14px] font-medium text-mute">{t("close.back")}</p>
        {quote ? (
          <>
            <p className="mt-1 text-[36px] font-bold leading-tight tracking-[-0.03em] tabular-nums text-ink">{fmtUsd(back)}</p>
            <LocalHint usd={back} />
          </>
        ) : (
          <Skeleton className="mt-2 h-10 w-44" />
        )}
        <p className={`mt-1 min-h-[22px] text-[15px] font-semibold tabular-nums ${toneText[tone]}`}>
          {quote && t("close.vs", { v: fmtSignedUsd(net), pct: fmtPct(net / pos.margin) })}
        </p>

        <dl className="mt-4 space-y-3.5 rounded-[18px] bg-fill px-4 py-4 text-[15px]" aria-busy={!quote}>
          <QuoteRow label={t("close.row.margin")} value={fmtUsd(pos.margin)} />
          <QuoteRow
            label={t("close.row.pnl")}
            value={quote ? fmtSignedUsd(pnl) : undefined}
            className={quote ? toneText[toneOf(pnl, 0.005)] : "text-ink"}
          />
          <QuoteRow label={t("close.row.fee")} value={quote ? `-${fmtUsd(quote.fee + openFee)}` : undefined} />
          <QuoteRow
            label={t("close.row.price")}
            hint={t("close.row.entry", { v: fmtUsd(pos.entry) })}
            value={quote ? fmtUsd(quote.price) : undefined}
          />
        </dl>
        <QuoteSource quote={quote} />

        <p className="mt-2 min-h-5 text-center text-[13px] font-medium text-danger" role="alert">
          {!online ? t("offline.order") : (submitError ?? (fresh?.error ? t(quoteErrorKey[fresh.error]) : ""))}
        </p>

        <div className="sticky bottom-0 mt-1 flex gap-2 bg-card pb-1 pt-1">
          <button type="button" onClick={close} className={`${btnGray} !w-[34%] shrink-0`}>
            {t("c.cancel")}
          </button>
          {fresh?.error ? (
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="press flex h-14 flex-1 items-center justify-center rounded-btn bg-ink px-2 text-center text-[17px] font-bold leading-tight text-white"
            >
              {t("quote.again")}
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={!quote || loading || !online} className={`${btnPrimary} !w-auto flex-1`}>
              {(quote && !loading) || !online ? t("pos.close") : <Spinner />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
