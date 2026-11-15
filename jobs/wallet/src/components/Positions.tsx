"use client";
// 진행 중인 레버리지: 카드 · 정리하기 시트 · 청산 알림
import { useEffect, useState, type ReactNode } from "react";
import { closePositionDemo, getPerpCloseQuote, positionPnl, positionRoe } from "@/lib/client";
import type { PerpCloseQuote, PerpMarket, Position, Price, Trade } from "@/lib/types";
import { fmtPct, fmtSignedUsd, fmtUsd, toneOf, toneText } from "./format";
import { IconClose } from "./icons";
import { CheckBurst, isExpired, QuoteRow, QuoteSource, Spinner, useQuoteExpiry } from "./orderKit";
import { clearLiquidated, fmtRate, remainToLiq, SIDE, useLiquidated } from "./perp";
import { Sheet } from "./Sheet";
import { btnGray, btnPrimary, Skeleton, StockLogo } from "./ui";

type Named = { nameKo: string; icon?: string };

function nameOf(markets: PerpMarket[] | undefined, symbol: string): Named {
  const m = markets?.find((x) => x.symbol === symbol);
  return { nameKo: m?.nameKo ?? symbol, icon: m?.icon };
}

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
  const [closingId, setClosingId] = useState<string | null>(null);
  const [target, setTarget] = useState<Position | null>(null); // 시트가 열려 있는 동안 붙잡아 둔다(정리 후에도 완료 화면 유지)

  return (
    <>
      {positions.length > 0 && (
        <section aria-label="진행 중인 레버리지">
          {header}
          <ul className="flex flex-col gap-3">
        {positions.map((pos) => (
          <li key={pos.id}>
            <PositionCard
              pos={pos}
              info={nameOf(markets, pos.symbol)}
              price={prices[pos.symbol]?.price}
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
      <Sheet open={closingId !== null && target !== null} onClose={() => setClosingId(null)} label="레버리지 정리하기">
        {(close) => target && <CloseBody pos={target} info={nameOf(markets, target.symbol)} close={close} />}
      </Sheet>
    </>
  );
}

function PositionCard({
  pos,
  info,
  price,
  loading,
  onClose,
}: {
  pos: Position;
  info: Named;
  price?: number;
  loading?: boolean;
  onClose: () => void;
}) {
  const s = SIDE[pos.side];
  const pnl = price ? positionPnl(pos, price) : 0;
  const roe = price ? positionRoe(pos, price) : 0;
  const tone = toneOf(pnl, 0.005);

  // 청산까지 남은 거리. 막대는 "처음 거리 대비 얼마나 남았나"
  const remain = price ? Math.max(0, remainToLiq(pos, price)) : undefined;
  const initial = pos.entry > 0 ? Math.abs(pos.entry - pos.liqPrice) / pos.entry : 0;
  const health = remain !== undefined && initial > 0 ? Math.min(1, remain / initial) : 1;
  const level = health > 0.5 ? "ok" : health > 0.25 ? "warn" : "bad";
  const barColor = { ok: "bg-ok", warn: "bg-warn", bad: "bg-up" }[level];
  const barText = { ok: "text-sub", warn: "text-warn", bad: "text-up" }[level];

  return (
    <article className="rounded-card bg-card px-5 pb-4 pt-5">
      <div className="flex items-center gap-3">
        <StockLogo symbol={pos.symbol} icon={info.icon} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold text-ink">{info.nameKo}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-bold">
            <span className="rounded-md bg-fill px-1.5 py-0.5 tabular-nums text-sub">{pos.leverage}배</span>
            <span className={`rounded-md px-1.5 py-0.5 ${s.soft} ${s.text}`}>
              {s.dir} <span className="font-medium opacity-80">{s.word}</span>
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
            넣은 돈 {fmtUsd(pos.margin)} → 지금 {fmtUsd(Math.max(0, pos.margin + pnl))}
          </p>
        </>
      ) : loading ? (
        <div role="status" aria-label="불러오는 중">
          <Skeleton className="mt-4 h-8 w-40" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      ) : (
        <p className="mt-4 text-[15px] text-mute">가격을 불러오지 못했어요 · 넣은 돈 {fmtUsd(pos.margin)}</p>
      )}

      {remain !== undefined && (
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-fill-strong"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(health * 100)}
            aria-label="청산까지 남은 여유"
          >
            <span className={`block h-full rounded-full transition-[width] duration-500 ${barColor}`} style={{ width: `${Math.max(3, health * 100)}%` }} />
          </div>
          <p className={`mt-2 text-[13px] font-semibold ${barText}`}>
            {level === "bad" && <span aria-hidden="true">🚨 </span>}
            청산까지 {fmtRate(remain)} 남았어요
          </p>
          <p className="mt-0.5 text-[12px] tabular-nums text-mute">
            지금 {fmtUsd(price ?? 0)} · {fmtUsd(pos.liqPrice)}가 되면 넣은 돈을 모두 잃어요
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="press mt-4 flex h-12 w-full items-center justify-center rounded-btn bg-fill text-[15px] font-bold text-sub active:bg-fill-strong"
      >
        정리하기
      </button>
    </article>
  );
}

function CloseBody({ pos, info, close }: { pos: Position; info: Named; close: () => void }) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ nonce: number; quote?: PerpCloseQuote; error?: boolean }>();
  const [trade, setTrade] = useState<Trade>();
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    let alive = true;
    getPerpCloseQuote(pos)
      .then((q) => alive && setResult({ nonce, quote: q }))
      .catch(() => alive && setResult({ nonce, error: true }));
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
      setSubmitError("견적 시간이 지나서 새로 받았어요. 다시 확인해 주세요.");
      setNonce((n) => n + 1);
      return;
    }
    try {
      setTrade(closePositionDemo(pos.id, quote));
      navigator.vibrate?.(12);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "정리하지 못했어요. 다시 시도해 주세요.");
    }
  };

  if (trade) {
    const pnl = trade.pnl ?? 0;
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckBurst />
        <h2 className="anim-rise mt-6 text-[24px] font-bold leading-snug text-ink" role="status">
          {info.nameKo} {pos.leverage}배를
          <br />
          정리했어요
        </h2>
        <p className="anim-rise mt-2 text-[15px] text-mute">
          {fmtUsd(trade.usd)}를 돌려받았어요 ·{" "}
          <span className={`font-semibold ${toneText[toneOf(pnl, 0.005)]}`}>{fmtSignedUsd(pnl)}</span>
        </p>
        <button type="button" onClick={close} className={`${btnPrimary} mt-9`}>
          확인
        </button>
      </div>
    );
  }

  const pnl = quote ? positionPnl(pos, quote.price) : 0;
  const back = quote ? Math.max(0, pos.margin + pnl - quote.fee) : 0;
  const net = back - pos.margin;
  const tone = toneOf(net, 0.005);

  return (
    <div>
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <StockLogo symbol={pos.symbol} icon={info.icon} size={32} />
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">
          {info.nameKo} {pos.leverage}배 정리하기
        </h2>
        <button type="button" onClick={close} aria-label="닫기" className="press -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-mute">
          <IconClose size={22} />
        </button>
      </div>
      <div className="px-6 pt-5">
        <p className="text-[14px] font-medium text-mute">지금 정리하면 돌려받는 돈</p>
        {quote ? (
          <p className="mt-1 text-[36px] font-bold leading-tight tracking-[-0.03em] tabular-nums text-ink">{fmtUsd(back)}</p>
        ) : (
          <Skeleton className="mt-2 h-10 w-44" />
        )}
        <p className={`mt-1 min-h-[22px] text-[15px] font-semibold tabular-nums ${toneText[tone]}`}>
          {quote && (
            <>
              넣은 돈보다 {fmtSignedUsd(net)} ({fmtPct(net / pos.margin)})
            </>
          )}
        </p>

        <dl className="mt-4 space-y-3.5 rounded-[18px] bg-fill px-4 py-4 text-[15px]" aria-busy={!quote}>
          <QuoteRow label="넣은 돈" value={fmtUsd(pos.margin)} />
          <QuoteRow label="손익" value={quote ? fmtSignedUsd(pnl) : undefined} className={quote ? toneText[toneOf(pnl, 0.005)] : "text-ink"} />
          <QuoteRow label="수수료" value={quote ? `-${fmtUsd(quote.fee)}` : undefined} />
          <QuoteRow label="정리 가격" hint={`시작 ${fmtUsd(pos.entry)}`} value={quote ? fmtUsd(quote.price) : undefined} />
        </dl>
        <QuoteSource quote={quote} />

        <p className="mt-3 min-h-5 text-center text-[13px] font-medium text-up" role="alert">
          {submitError ?? (fresh?.error ? "견적을 받지 못했어요." : "")}
        </p>

        <div className="mt-1 flex gap-2">
          <button type="button" onClick={close} className={`${btnGray} !w-[34%] shrink-0`}>
            취소
          </button>
          {fresh?.error ? (
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="press flex h-14 flex-1 items-center justify-center rounded-btn bg-ink text-[17px] font-bold text-white"
            >
              견적 다시 받기
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={!quote || loading} className={`${btnPrimary} !w-auto flex-1`}>
              {quote && !loading ? "정리하기" : <Spinner />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 청산 알림(화면 위쪽에 잠깐 뜬다) */
export function LiquidationToast({ markets }: { markets?: PerpMarket[] }) {
  const dead = useLiquidated();
  useEffect(() => {
    if (!dead.length) return;
    const id = setTimeout(clearLiquidated, 9000);
    return () => clearTimeout(id);
  }, [dead]);
  if (!dead.length) return null;
  const first = dead[0];
  const lost = dead.reduce((sum, p) => sum + p.margin, 0);
  const name = nameOf(markets, first.symbol).nameKo;
  return (
    <div
      className="fixed inset-x-0 z-40 mx-auto w-full max-w-[480px] px-4"
      style={{ top: "calc(var(--safe-top) + 10px)" }}
      role="alert"
    >
      <div className="anim-rise flex items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <span className="text-[22px] leading-none" aria-hidden="true">
          🚨
        </span>
        <p className="min-w-0 flex-1 text-[14px] leading-snug">
          <b className="font-bold">
            {name} {first.leverage}배{dead.length > 1 ? ` 외 ${dead.length - 1}건이` : "가"} 청산됐어요
          </b>
          <span className="block text-white/75">넣은 돈 {fmtUsd(lost)}를 잃었어요. 내역에서 볼 수 있어요.</span>
        </p>
        <button type="button" onClick={clearLiquidated} aria-label="알림 닫기" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center">
          <IconClose size={20} />
        </button>
      </div>
    </div>
  );
}
