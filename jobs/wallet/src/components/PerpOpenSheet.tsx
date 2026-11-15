"use client";
// 레버리지 시작하기: 한 화면에 질문 하나씩
//   어느 쪽? → 몇 배? → 얼마? → 확인 → 완료
import Link from "next/link";
import { useEffect, useState } from "react";
import { displayName, useLang, useT } from "@/i18n";
import { getPerpHistory, getPerpOpenQuote, openPositionDemo, useAsync, useOnline, usePortfolio } from "@/lib/client";
import type { PerpMarket, PerpQuote, Price } from "@/lib/types";
import { Chart } from "./Chart";
import { LocalHint } from "./chrome";
import { fmtSignedUsd, fmtUsd } from "./format";
import { IconBack, IconClose } from "./icons";
import { LeverageGuide } from "./LeverageGuide";
import {
  applyKey,
  CheckBurst,
  floor2,
  isExpired,
  Keypad,
  QuietNote,
  quoteErrorKey,
  quoteErrorOf,
  QuoteRow,
  QuoteSource,
  showNumber,
  Spinner,
  toText,
  useQuoteExpiry,
  type Key,
  type QuoteError,
} from "./orderKit";
import { estLiqDistance, fmtRate, minMargin, riskOf, SIDE, type PerpSide } from "./perp";
import { Sheet } from "./Sheet";
import { btnGray, Change, Skeleton, StockLogo } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  market: PerpMarket;
  price?: Price;
};

export function PerpOpenSheet({ open, onClose, market, price }: Props) {
  const t = useT();
  const lang = useLang();
  return (
    <Sheet open={open} onClose={onClose} label={t("perp.sheet.aria", { name: displayName(lang, market) })}>
      {(close) => <Body market={market} price={price} close={close} />}
    </Sheet>
  );
}

type Step = "side" | "lev" | "amount" | "confirm" | "done";
const ORDER: Step[] = ["side", "lev", "amount", "confirm"];
const FEE_EST = 0.0007; // 여는 수수료 어림(움직이는 금액 대비). 실제 값은 견적으로 받는다
const ACK_KEY = "moduwallet.perpAck.v1";

function readAck(): boolean {
  try {
    return localStorage.getItem(ACK_KEY) === "1";
  } catch {
    return false;
  }
}

function Body({ market, price, close }: { market: PerpMarket; price?: Price; close: () => void }) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const pf = usePortfolio();
  const usdc = pf.usdc;
  const name = displayName(lang, market);
  const maxLev = Math.max(1, Math.floor(market.maxLeverage));

  const [step, setStep] = useState<Step>("side");
  const [side, setSide] = useState<PerpSide>("long");
  const [lev, setLev] = useState(Math.min(5, maxLev));
  const [text, setText] = useState("");
  const [isMax, setIsMax] = useState(false);
  const [trim, setTrim] = useState(1);
  const [notice, setNotice] = useState<{ n: number; kind: "max" | "min" }>({ n: 0, kind: "max" });
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: PerpQuote; error?: QuoteError }>();
  const [remembered, setRemembered] = useState(false); // 예전에 이미 동의함
  const [ack, setAck] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [guide, setGuide] = useState(false);

  const s = SIDE[side];
  const risk = riskOf(lev);
  const minUsd = minMargin(lev); // 움직이는 금액이 $10 이상이어야 한다

  // 넣을 수 있는 최대 = 잔고에서 수수료를 뺀 만큼
  const limit = floor2(usdc / (1 + lev * FEE_EST));
  const canOrder = limit >= minUsd;
  const maxMargin = floor2((usdc * trim) / (1 + lev * FEE_EST));
  const margin = isMax ? maxMargin : Number(text) || 0;
  const tooSmall = margin > 0 && margin < minUsd;
  const quoting = step === "amount" || step === "confirm";
  const valid = quoting && canOrder && margin >= minUsd && online;
  const key = valid ? `${side}:${lev}:${margin}:${nonce}` : "";

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const id = setTimeout(() => {
      getPerpOpenQuote(market.symbol, side, margin, lev)
        .then((q) => {
          if (!alive) return;
          if (q.margin + q.fee > usdc + 1e-6) {
            // 수수료까지 더하면 잔고를 넘는다: 최대로 바꾸고, 이미 최대면 조금 낮춰 다시 받는다
            if (isMax) setTrim((v) => v * 0.998);
            else {
              setIsMax(true);
              setNotice((v) => ({ n: v.n + 1, kind: "max" }));
            }
            return;
          }
          setResult({ key, quote: q });
        })
        .catch((e) => {
          if (alive) setResult({ key, error: quoteErrorOf(e) });
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [key, market.symbol, side, margin, lev, isMax, usdc]);

  const fresh = result && result.key === key ? result : undefined;
  const quote = fresh?.quote;
  const quoteLoading = !!key && !fresh;
  const quoteError = fresh?.error;
  useQuoteExpiry(quote?.expiresAt, quoting, () => setNonce((n) => n + 1));

  // 모두 잃는 선까지 거리: 견적이 있으면 견적의 청산가로, 없으면 어림값
  const liqDist = quote && quote.price > 0 ? Math.abs(quote.liqPrice - quote.price) / quote.price : estLiqDistance(lev, maxLev);
  const long = side === "long";

  const shown = isMax ? maxMargin.toFixed(2) : text;

  const enter = (next: string) => {
    const n = Number(next) || 0;
    const hit = n > 0 && (!canOrder || n >= limit - 0.004);
    setTrim(1);
    setIsMax(hit && canOrder);
    setText(hit ? "" : next);
    setNotice((v) => (n > 0 && (!canOrder || n > limit + 0.004) ? { n: v.n + 1, kind: "max" } : { n: 0, kind: "max" }));
  };
  const press = (k: Key) => {
    const next = applyKey(shown, k, 2);
    if (next !== shown) enter(next);
  };

  const back = () => {
    setSubmitError(undefined);
    const i = ORDER.indexOf(step);
    if (i > 0) setStep(ORDER[i - 1]);
  };

  const submit = () => {
    if (!quote) return;
    if (isExpired(quote)) {
      setSubmitError(t("quote.expired"));
      setNonce((n) => n + 1);
      return;
    }
    try {
      openPositionDemo(quote);
      if (!remembered) {
        try {
          localStorage.setItem(ACK_KEY, "1");
        } catch {
          // 저장을 못 해도 거래는 그대로 진행한다
        }
      }
      setStep("done");
      navigator.vibrate?.(12);
    } catch {
      setSubmitError(t("err.start"));
    }
  };

  // ---------- 완료 ----------
  if (step === "done") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckBurst />
        <h2 className="anim-rise mt-6 text-[24px] font-bold leading-snug text-ink" role="status">
          {t(long ? "perp.done.long" : "perp.done.short", { name, n: lev })}
        </h2>
        <p className="anim-rise mt-2 text-[15px] leading-relaxed text-mute">{t("perp.done.body")}</p>
        <div className="mt-9 flex w-full gap-2">
          <Link href="/leverage" replace className={btnGray}>
            {t("perp.done.view")}
          </Link>
          <button
            type="button"
            onClick={close}
            className="press flex h-14 w-full items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white active:bg-primary-press"
          >
            {t("c.ok")}
          </button>
        </div>
      </div>
    );
  }

  const stepIndex = ORDER.indexOf(step);
  const header = (
    <div className="flex items-center px-2 pt-2">
      {stepIndex > 0 ? (
        <button
          type="button"
          onClick={back}
          aria-label={t("c.prev")}
          className="press flex h-11 w-11 items-center justify-center rounded-full text-ink"
        >
          <IconBack size={24} />
        </button>
      ) : (
        <span className="flex h-11 w-11 items-center justify-center">
          <StockLogo symbol={market.symbol} icon={market.icon} size={30} />
        </span>
      )}
      <div
        className="flex flex-1 items-center justify-center gap-1.5"
        role="img"
        aria-label={t("perp.steps.aria", { n: stepIndex + 1, total: ORDER.length })}
      >
        {ORDER.map((o, i) => (
          <span
            key={o}
            className={`h-1.5 rounded-full transition-all ${
              i === stepIndex ? "w-5 bg-ink" : i < stepIndex ? "w-1.5 bg-ink" : "w-1.5 bg-fill-strong"
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={t("c.close")}
        className="press flex h-11 w-11 items-center justify-center rounded-full text-mute"
      >
        <IconClose size={22} />
      </button>
    </div>
  );

  // ---------- 1. 어느 쪽? ----------
  if (step === "side") {
    return (
      <div>
        {header}
        <div className="px-6 pt-3">
          <h2 className="text-[24px] font-bold leading-snug text-ink">{t("perp.q.side", { name })}</h2>
          <p className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2 text-[15px]">
            {price ? (
              <>
                <span className="font-semibold tabular-nums text-ink">{fmtUsd(price.price)}</span>
                <span className="text-mute">{t("range.vs.1D")}</span>
                <Change ratio={price.change24h} className="font-medium" />
              </>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
          </p>
        </div>
        <MiniChart symbol={market.symbol} name={name} />
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
          {(["long", "short"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSide(k);
                setStep("lev");
              }}
              className={`press flex min-h-[112px] flex-col items-start justify-between gap-2 rounded-card px-4 py-4 text-left ${SIDE[k].soft}`}
            >
              <span className={`text-[26px] leading-none ${SIDE[k].text}`} aria-hidden="true">
                {k === "long" ? "▲" : "▼"}
              </span>
              <span>
                <span className={`block text-[17px] font-bold leading-snug ${SIDE[k].text}`}>{t(SIDE[k].guess)}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-sub">{t(SIDE[k].sub)}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setGuide(true)}
          className="mx-auto mt-1 flex min-h-11 items-center px-4 text-[14px] font-semibold text-mute underline underline-offset-2"
        >
          {t("perp.guide.link")}
        </button>
        <LeverageGuide open={guide} onClose={() => setGuide(false)} />
      </div>
    );
  }

  // ---------- 2. 몇 배? ----------
  if (step === "lev") {
    const chips = [...new Set([2, 3, 5, 10, 20, maxLev].filter((n) => n <= maxLev))];
    return (
      <div>
        {header}
        <div className="px-6 pt-3">
          <h2 className="text-[24px] font-bold leading-snug text-ink">{t("perp.q.lev")}</h2>
          <p className="mt-1 text-[14px] text-mute">{t("perp.lev.max", { name, n: maxLev })}</p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">{t("lev.x", { n: lev })}</span>
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${risk.bg} ${risk.text}`}>{t(risk.label)}</span>
          </div>

          <input
            type="range"
            min={1}
            max={maxLev}
            step={1}
            value={lev}
            onChange={(e) => setLev(Number(e.target.value))}
            aria-label={t("perp.lev.aria")}
            aria-valuetext={`${t("lev.x", { n: lev })}, ${t(risk.label)}`}
            className="lev-range mt-3 h-11 w-full"
          />
          <div className="-mt-1 flex justify-between text-[12px] text-hint" aria-hidden="true">
            <span>{t("lev.x", { n: 1 })}</span>
            <span>{t("lev.x", { n: maxLev })}</span>
          </div>

          <div className="mt-2 flex gap-1.5" role="group" aria-label={t("perp.lev.common.aria")}>
            {chips.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === lev}
                onClick={() => setLev(n)}
                className={`press h-11 min-w-0 flex-1 rounded-full text-[14px] font-semibold tabular-nums ${
                  n === lev ? "bg-ink text-white" : "bg-fill text-sub active:bg-fill-strong"
                }`}
              >
                {t("lev.x", { n })}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2.5 rounded-[18px] bg-fill px-4 py-4 text-[15px] leading-snug" aria-live="polite">
            <p className="flex items-baseline justify-between gap-3 text-sub">
              <span>{t(long ? "perp.if.up1" : "perp.if.down1", { name })}</span>
              <b className="shrink-0 font-bold tabular-nums text-up">+{lev}%</b>
            </p>
            <p className="flex items-baseline justify-between gap-3 text-sub">
              <span>{t(long ? "perp.if.down1" : "perp.if.up1", { name })}</span>
              <b className="shrink-0 font-bold tabular-nums text-down">-{lev}%</b>
            </p>
            <p className={`border-t border-line pt-2.5 font-semibold ${lev > 10 ? "text-danger" : "text-ink"}`}>
              <span aria-hidden="true">🚨 </span>
              {t(long ? "perp.liq.down" : "perp.liq.up", { name, pct: fmtRate(liqDist) })}
            </p>
          </div>
        </div>
        <div className="sticky bottom-0 bg-card px-5 pb-1 pt-4">
          <button
            type="button"
            onClick={() => setStep("amount")}
            className={`press flex h-14 w-full items-center justify-center rounded-btn px-3 text-center text-[17px] font-bold leading-tight text-white ${s.bg}`}
          >
            {t("perp.lev.cta", { n: lev })}
          </button>
        </div>
      </div>
    );
  }

  // ---------- 4. 확인 ----------
  if (step === "confirm") {
    // 예시로 보여 줄 가격 변동 폭: 모두 잃는 선보다 안쪽에서 고른다
    const move = liqDist > 0.12 ? 0.1 : liqDist > 0.06 ? 0.05 : liqDist > 0.025 ? 0.02 : 0.01;
    const swing = quote ? Math.min(quote.margin, quote.notional * move) : 0;
    const needAck = !remembered;
    const canSubmit = !!quote && !quoteLoading && online && (!needAck || ack);
    return (
      <div>
        {header}
        <div className="px-6 pt-3">
          <h2 className="text-[22px] font-bold leading-snug text-ink">
            {t(long ? "perp.ask.long" : "perp.ask.short", { name, v: fmtUsd(margin), n: lev })}
          </h2>

          <table className="mt-4 w-full overflow-hidden rounded-[18px] bg-fill text-[14px]" aria-busy={!quote}>
            <caption className="sr-only">{t("perp.tbl.caption")}</caption>
            <thead>
              <tr className="text-left align-bottom text-[12px] text-mute">
                <th scope="col" className="px-4 pb-1 pt-3 font-medium">
                  {t("perp.tbl.price", { name })}
                </th>
                <th scope="col" className="px-4 pb-1 pt-3 text-right font-medium">
                  {t("perp.tbl.mine", { v: fmtUsd(margin) })}
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr>
                <td className="px-4 py-2 text-sub">{t(long ? "perp.tbl.up" : "perp.tbl.down", { pct: fmtRate(move) })}</td>
                <td className="px-4 py-2 text-right font-bold text-up">{quote ? fmtSignedUsd(swing) : "…"}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sub">{t(long ? "perp.tbl.down" : "perp.tbl.up", { pct: fmtRate(move) })}</td>
                <td className="px-4 py-2 text-right font-bold text-down">{quote ? fmtSignedUsd(-swing) : "…"}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-4 pb-3 pt-2.5 font-semibold text-ink">
                  {t(long ? "perp.tbl.down" : "perp.tbl.up", { pct: fmtRate(liqDist) })}
                  {quote && <span className="block text-[12px] font-normal text-mute">{t("perp.tbl.liqAt", { v: fmtUsd(quote.liqPrice) })}</span>}
                </td>
                <td className="px-4 pb-3 pt-2.5 text-right font-bold text-ink">
                  {quote ? fmtSignedUsd(-quote.margin) : "…"}
                  <span className="block text-[12px] font-semibold text-danger">{t("perp.tbl.loseAll")}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <dl className="mt-3 space-y-2.5 px-1 text-[14px]">
            <QuoteRow label={t("perp.row.notional")} hint={t("lev.x", { n: lev })} value={quote ? fmtUsd(quote.notional) : undefined} />
            <QuoteRow label={t("perp.row.entry")} value={quote ? fmtUsd(quote.price) : undefined} />
            <QuoteRow label={t("perp.row.fee")} value={quote ? fmtUsd(quote.fee) : undefined} />
            <QuoteRow
              label={t("perp.row.payNow")}
              hint={t("perp.row.payNow.hint")}
              value={quote ? fmtUsd(quote.margin + quote.fee) : undefined}
              strong
              sub={quote && <LocalHint usd={quote.margin + quote.fee} className="!text-[12px]" />}
            />
          </dl>
          <QuoteSource quote={quote} />
          <QuietNote>{t("spread.perp")}</QuietNote>

          {needAck && (
            <label className="mt-3 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[14px] border border-line px-3.5 py-2">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-5 w-5 shrink-0 accent-primary" />
              <span className="text-[14px] font-semibold leading-snug text-ink">{t("perp.ack")}</span>
            </label>
          )}

          <p className="mt-2 min-h-5 text-center text-[13px] font-medium text-danger" role="alert">
            {!online ? t("offline.order") : (submitError ?? (quoteError ? t(quoteErrorKey[quoteError]) : ""))}
          </p>

          <div className="sticky bottom-0 bg-card pb-1 pt-1">
            {quoteError ? (
              <button
                type="button"
                onClick={() => setNonce((n) => n + 1)}
                className="press flex h-14 w-full items-center justify-center rounded-btn bg-ink text-[17px] font-bold text-white"
              >
                {t("quote.again")}
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className={`press flex h-14 w-full items-center justify-center rounded-btn px-3 text-center text-[17px] font-bold leading-tight text-white disabled:bg-fill-strong disabled:text-faint ${s.bg}`}
              >
                {online && (!quote || quoteLoading) ? <Spinner /> : t("perp.start", { n: lev })}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- 3. 얼마? ----------
  let status: { text: string; tone: "mute" | "bad" | "good" };
  if (!online) status = { text: t("offline.order"), tone: "bad" };
  else if (!canOrder) status = { text: t("perp.st.noCash"), tone: "mute" };
  else if (tooSmall) status = { text: t("perp.st.min", { min: fmtUsd(minUsd) }), tone: "mute" };
  else if (!key) status = { text: t("order.st.enterUsd"), tone: "mute" };
  else if (quoteError) status = { text: t(quoteErrorKey[quoteError]), tone: "bad" };
  else
    status = {
      text: `${t("perp.st.moves", { v: fmtUsd(quote ? quote.notional : margin * lev) })}${quote ? "" : ` · ${t("quote.loading")}`}`,
      tone: quote ? "good" : "mute",
    };

  // '다음': 최소 금액보다 적으면 넘어가지 않고 최소 금액으로 올려 준다
  const bumpToMin = tooSmall && canOrder && online;
  const amountText = `$${showNumber(shown)}`;

  return (
    <div>
      {header}
      <div className="px-6 pb-1 pt-3 text-center">
        <h2 className="text-left text-[24px] font-bold leading-snug text-ink">{t("perp.q.amount")}</h2>
        <p className="mt-1 text-left text-[14px] text-mute">{t("perp.amount.sub", { dir: t(s.dir), n: lev })}</p>
        <p
          key={notice.n}
          className={`amount-big mt-4 font-bold leading-tight tracking-[-0.03em] tabular-nums ${amountText.length > 10 ? "is-long" : ""} ${
            shown ? "text-ink" : "text-faint"
          } ${notice.n ? "anim-shake" : ""}`}
          aria-live="polite"
          aria-label={t("perp.amount.aria", { v: amountText })}
        >
          {amountText}
        </p>
        <p
          className={`mt-1 flex min-h-6 flex-wrap items-center justify-center gap-x-1.5 text-[14px] font-medium ${
            status.tone === "bad" ? "text-danger" : status.tone === "good" ? "text-primary" : "text-mute"
          }`}
          role="status"
        >
          {status.text}
          {quoteError && online && (
            <button type="button" onClick={() => setNonce((n) => n + 1)} className="-my-2.5 px-1 py-2.5 font-bold underline">
              {t("c.retry")}
            </button>
          )}
        </p>
        <p className="mt-0.5 min-h-5 text-[13px] text-mute" role="status">
          {notice.n > 0 && canOrder ? (
            <span key={notice.n} className="anim-rise inline-block font-semibold text-sub">
              {notice.kind === "min" ? t("perp.minBumped", { v: fmtUsd(minUsd) }) : t("order.clamped.usd")}
            </span>
          ) : (
            t("perp.limit", { v: fmtUsd(limit) })
          )}
        </p>
      </div>

      <div className="mt-2 flex gap-1.5 px-4">
        {[10, 50, 100].map((add) => (
          <button
            key={add}
            type="button"
            disabled={!canOrder}
            onClick={() => enter(toText((Number(shown) || 0) + add, 2))}
            className="press h-11 min-w-0 flex-1 rounded-full bg-fill text-[14px] font-semibold tabular-nums text-sub active:bg-fill-strong disabled:text-faint"
          >
            +${add}
          </button>
        ))}
        <button
          type="button"
          disabled={!canOrder}
          aria-pressed={isMax}
          onClick={() => {
            setTrim(1);
            setIsMax(true);
            setText("");
            setNotice({ n: 0, kind: "max" });
          }}
          className={`press h-11 min-w-0 flex-1 truncate rounded-full px-1 text-[14px] font-semibold disabled:text-faint ${
            isMax ? "bg-primary-soft text-primary" : "bg-fill text-sub active:bg-fill-strong"
          }`}
        >
          {t("c.max")}
        </button>
      </div>

      <Keypad onKey={press} />

      <div className="sticky bottom-0 bg-card px-5 pb-1 pt-2">
        <button
          type="button"
          disabled={!bumpToMin && (!quote || quoteLoading || !online)}
          onClick={() => {
            if (bumpToMin) {
              setIsMax(false);
              setText(String(minUsd));
              setNotice((v) => ({ n: v.n + 1, kind: "min" }));
              return;
            }
            setSubmitError(undefined);
            setRemembered(readAck());
            setStep("confirm");
          }}
          className={`press flex h-14 w-full items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${s.bg}`}
        >
          {quoteLoading ? <Spinner /> : t("c.next")}
        </button>
      </div>
    </div>
  );
}

/** 첫 화면의 작은 1일 차트(판단 참고용) */
function MiniChart({ symbol, name }: { symbol: string; name: string }) {
  const t = useT();
  const history = useAsync(() => getPerpHistory(symbol, "1D"), [symbol]);
  const points = history.data && history.data.length >= 2 ? history.data : undefined;
  if (!points) {
    return (
      <div className="mt-3 flex h-[96px] items-center justify-center px-6">
        {history.loading ? (
          <Skeleton className="h-full w-full !rounded-2xl" />
        ) : (
          <span className="text-[13px] text-hint">{t("detail.chart.fail")}</span>
        )}
      </div>
    );
  }
  const up = points[points.length - 1].price >= points[0].price;
  return (
    <div className="mt-3 overflow-hidden">
      <Chart
        points={points}
        tone={up ? "up" : "down"}
        label={t("detail.chart.aria", { name, range: t("range.1D") })}
        height={96}
      />
    </div>
  );
}
