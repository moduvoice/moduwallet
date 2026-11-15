"use client";
// 주문 시트: 금액 입력(키패드, 달러 ↔ 주) → 견적 확인 → 데모 체결 → 완료
import Link from "next/link";
import { useEffect, useState } from "react";
import { displayName, useLang, useT } from "@/i18n";
import { executeDemo, getQuote, useOnline, usePortfolio } from "@/lib/client";
import type { Stock, Trade, TradeQuote } from "@/lib/types";
import { LocalHint } from "./chrome";
import { fmtUsd } from "./format";
import { IconClose, IconInfo } from "./icons";
import {
  applyKey,
  CheckBurst,
  floor2,
  floor6,
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
import { Sheet } from "./Sheet";
import { btnGray, qtyText, StockLogo } from "./ui";

type Side = "buy" | "sell";

type Props = {
  open: boolean;
  onClose: () => void;
  stock: Stock;
  side: Side;
  price?: number; // 현재가(달러 ↔ 주 환산, 최대값 계산용)
};

export function OrderSheet({ open, onClose, stock, side, price }: Props) {
  const t = useT();
  const lang = useLang();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t(side === "buy" ? "order.title.buy" : "order.title.sell", { name: displayName(lang, stock) })}
    >
      {(close) => <OrderBody stock={stock} side={side} price={price} close={close} />}
    </Sheet>
  );
}

const MIN_USD = 1;
const FEE = 0.002; // 0.2%
type Mode = "usd" | "qty"; // 달러로 입력 / 주식 수로 입력
const DP: Record<Mode, number> = { usd: 2, qty: 6 };

/** 견적을 내 잔고·보유 수량에 맞춘다. 전부 팔 때는 가진 수량과 정확히 같게 해서 남는 게 없게 한다 */
function fit(q: TradeQuote, usdc: number, heldQty: number, all: boolean): TradeQuote | undefined {
  if (q.side === "buy") return q.usd > usdc + 1e-6 ? undefined : q;
  if (heldQty <= 0 || q.qty <= 0) return undefined;
  const k = heldQty / q.qty;
  const snap = all ? Math.abs(k - 1) <= 0.02 : k < 1 && k >= 0.98;
  if (snap) return { ...q, qty: heldQty, usd: q.usd * k, fee: q.fee * k };
  return k >= 1 ? q : undefined;
}

function OrderBody({ stock, side, price, close }: Omit<Props, "open" | "onClose"> & { close: () => void }) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const pf = usePortfolio();
  const held = pf.holdings.find((h) => h.symbol === stock.symbol);
  const heldQty = held?.qty ?? 0;
  const usdc = pf.usdc;
  const coin = stock.kind === "crypto";
  const name = displayName(lang, stock);
  const verb = t(side === "buy" ? "act.buy" : "act.sell");
  const accent = side === "buy" ? "bg-up active:bg-up-press" : "bg-down active:bg-down-press";
  const px = price ?? held?.avgPrice; // 환산에 쓰는 1주 가격
  const qtyOf = (n: number) => qtyText(t, stock.kind, n);

  const [mode, setMode] = useState<Mode>("usd");
  const [text, setText] = useState("");
  const [isMax, setIsMax] = useState(false); // 최대(살 수 있는 만큼 전부 / 가진 것 전부)
  const [trim, setTrim] = useState(1); // 최대로 살 때 견적이 잔고를 넘으면 조금씩 낮추는 비율
  const [notice, setNotice] = useState(0); // 0 보다 크면 "최대로 바꿨어요" 안내(바뀔 때마다 흔들림)
  const [step, setStep] = useState<"amount" | "confirm" | "done">("amount");
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: TradeQuote; error?: QuoteError }>();
  const [trade, setTrade] = useState<Trade>();
  const [submitError, setSubmitError] = useState<string>();
  const [showRisk, setShowRisk] = useState(false);

  // 입력할 수 있는 최대값(단위별). 가격을 모르면 견적을 받은 뒤에 맞춘다
  const maxOf = (m: Mode): number => {
    if (side === "buy") return m === "usd" ? floor2(usdc) : px ? floor6(usdc / (px * (1 + FEE))) : Infinity;
    return m === "qty" ? heldQty : px ? floor2(heldQty * px * (1 - FEE)) : Infinity;
  };
  const canOrder = side === "buy" ? usdc >= MIN_USD : heldQty > 0;

  // 견적 요청: 최대일 때는 살 때 = 잔고 전부(달러), 팔 때 = 가진 수량 전부(주)
  const amount = Number(text) || 0;
  const reqKind: Mode = isMax ? (side === "buy" ? "usd" : "qty") : mode;
  const reqValue = isMax ? (side === "buy" ? floor2(usdc * trim) : heldQty) : amount;
  const estUsd = reqKind === "usd" ? reqValue : px ? reqValue * px : undefined;
  const tooSmall = !isMax && amount > 0 && estUsd !== undefined && estUsd < MIN_USD;
  const valid = reqValue > 0 && canOrder && !tooSmall && online;
  const key = valid ? `${side}:${reqKind}:${reqValue}:${nonce}` : "";

  // 금액이 바뀌면 잠깐(0.4초) 기다렸다가 견적을 새로 받는다
  useEffect(() => {
    if (!key || step === "done") return;
    let alive = true;
    const id = setTimeout(() => {
      getQuote(stock.symbol, side, reqKind === "usd" ? { usd: reqValue } : { qty: reqValue })
        .then((q) => {
          if (!alive) return;
          if (side === "buy" && q.usd > usdc + 1e-6 && q.usd > 0) {
            // 수수료까지 더하면 잔고를 넘는다: 최대로 바꾸고, 이미 최대면 조금 낮춰 다시 받는다
            if (isMax) setTrim((v) => v * (usdc / q.usd) * 0.999);
            else {
              setIsMax(true);
              setNotice((n) => n + 1);
            }
            return;
          }
          if (side === "sell" && !isMax && q.qty > heldQty * 1.02) {
            // 받고 싶은 금액이 가진 주식으로는 모자라다: 전부 팔기로 바꾼다
            setIsMax(true);
            setNotice((n) => n + 1);
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
  }, [key, step, stock.symbol, side, reqKind, reqValue, isMax, usdc, heldQty]);

  const fresh = result && result.key === key ? result : undefined;
  const quote = fresh?.quote ? fit(fresh.quote, usdc, heldQty, isMax && side === "sell") : undefined;
  const quoteLoading = !!key && !fresh;
  const quoteError: QuoteError | undefined = fresh && !quote ? (fresh.error ?? "fail") : undefined;
  const expiresAt = fresh?.quote?.expiresAt;

  // 견적이 만료되면 새로 받는다
  useQuoteExpiry(expiresAt, step !== "done", () => setNonce((n) => n + 1));

  // 최대일 때 화면에 보이는 값(견적이 오면 견적 값으로)
  const maxText = (m: Mode): string => {
    if (side === "buy") {
      if (m === "usd") return floor2(usdc * trim).toFixed(2);
      const est = maxOf("qty");
      return toText(quote ? floor6(quote.qty) : Number.isFinite(est) ? floor6(est * trim) : 0, 6);
    }
    if (m === "qty") return toText(floor6(heldQty), 6) || toText(heldQty, 10);
    const v = quote ? floor2(quote.usd) : maxOf("usd");
    return Number.isFinite(v) && v > 0 ? v.toFixed(2) : "";
  };
  const shown = isMax ? maxText(mode) : text;
  const shownNum = Number(shown) || 0;

  /** 새 입력값을 받아들인다. 최대를 넘으면 그 자리에서 최대로 바꾼다(quiet = 안내 없이) */
  const enter = (next: string, m: Mode = mode, quiet = false) => {
    const n = Number(next) || 0;
    const limit = maxOf(m);
    const eps = m === "usd" ? 0.004 : 5e-7;
    const hit = n > 0 && (!canOrder || n >= limit - eps);
    const overLimit = n > 0 && (!canOrder || n > limit + eps);
    setTrim(1);
    setIsMax(hit && canOrder);
    setText(hit ? "" : next);
    setNotice(overLimit && !quiet ? (v) => v + 1 : 0);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    if (isMax) {
      setNotice(0);
      return;
    }
    // 지금 값을 새 단위로 바꿔 준다(견적이 있으면 견적 값, 없으면 현재가로)
    let next = "";
    if (amount > 0) {
      if (m === "qty") next = toText(quote ? quote.qty : px ? amount / px : 0, 6);
      else next = toText(quote ? quote.usd : px ? amount * px : 0, 2);
    }
    enter(next, m, true);
  };

  const press = (k: Key) => {
    const next = applyKey(shown, k, DP[mode]);
    if (next !== shown) enter(next); // 더 못 넣는 키(자릿수 한도)는 그대로 둔다
  };

  const canNext = !!quote && !quoteLoading && online;

  const submit = () => {
    if (!quote) return;
    if (isExpired(quote)) {
      setSubmitError(t("quote.expired"));
      setNonce((n) => n + 1);
      return;
    }
    try {
      const done = executeDemo(quote);
      setTrade(done);
      setStep("done");
      navigator.vibrate?.(12);
    } catch {
      setSubmitError(t("err.order"));
    }
  };

  // ---------- 완료 ----------
  if (step === "done" && trade) {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckBurst />
        <h2 className="anim-rise mt-6 text-[24px] font-bold leading-snug text-ink" role="status">
          {t(side === "buy" ? "order.done.buy" : "order.done.sell", { name, qty: qtyOf(trade.qty) })}
        </h2>
        <p className="anim-rise mt-2 text-[15px] text-mute">
          {t(side === "buy" ? "order.done.paid" : "order.done.got", { v: fmtUsd(trade.usd) })}
        </p>
        <div className="mt-9 flex w-full gap-2">
          <Link href="/history" replace className={btnGray}>
            {t("order.done.history")}
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

  const header = (
    <div className="flex items-center gap-2.5 px-5 pt-4">
      <StockLogo symbol={stock.symbol} icon={stock.icon} size={32} />
      <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">
        {t(side === "buy" ? "order.title.buy" : "order.title.sell", { name })}
      </h2>
      <button
        type="button"
        onClick={close}
        aria-label={t("c.close")}
        className="press -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mute"
      >
        <IconClose size={22} />
      </button>
    </div>
  );

  // ---------- 확인 ----------
  if (step === "confirm") {
    return (
      <div>
        {header}
        <div className="px-6 pt-5">
          <p className="text-[24px] font-bold leading-snug text-ink">
            {quote ? t(side === "buy" ? "order.ask.buy" : "order.ask.sell", { qty: qtyOf(quote.qty) }) : t("quote.refreshing")}
          </p>

          <dl className="mt-5 space-y-3.5 rounded-[18px] bg-fill px-4 py-4 text-[15px]" aria-busy={!quote}>
            <QuoteRow
              label={t(side === "buy" ? "order.pay" : "order.receive")}
              value={quote ? fmtUsd(quote.usd) : undefined}
              strong
              hint={t(side === "buy" ? "order.pay.hint" : "order.receive.hint")}
              sub={quote && <LocalHint usd={quote.usd} className="!text-[12px]" />}
            />
            <QuoteRow label={t(side === "buy" ? "order.getQty" : "order.sellQty")} value={quote ? qtyOf(quote.qty) : undefined} />
            <QuoteRow label={t(coin ? "order.pricePer.coin" : "order.pricePer.share")} value={quote ? fmtUsd(quote.price) : undefined} />
            <QuoteRow label={t("order.fee")} value={quote ? fmtUsd(quote.fee) : undefined} />
          </dl>

          <QuoteSource quote={quote} />
          <QuietNote>{t(side === "buy" ? "spread.buy" : "spread.sell")}</QuietNote>

          <div className="mt-3 rounded-[14px] border border-line px-3.5 py-3">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-sub">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-hint" />
              <span>
                {t("risk.line")}{" "}
                <button
                  type="button"
                  onClick={() => setShowRisk((v) => !v)}
                  aria-expanded={showRisk}
                  className="-my-3 py-3 font-semibold text-sub underline underline-offset-2"
                >
                  {t(showRisk ? "c.less" : "c.more")}
                </button>
              </span>
            </p>
            {showRisk && (
              <div className="anim-rise">
                <ul className="mt-2 list-disc space-y-1 pl-9 text-[13px] leading-relaxed text-mute">
                  <li>{t("risk.1")}</li>
                  <li>{t("risk.2")}</li>
                  <li>{t("risk.3")}</li>
                  <li>{t("risk.4")}</li>
                </ul>
                <Link
                  href="/terms"
                  replace
                  className="ml-6 mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-primary underline underline-offset-2"
                >
                  {t("risk.terms")}
                </Link>
              </div>
            )}
          </div>

          <p className="mt-3 min-h-5 text-center text-[13px] font-medium text-danger" role="alert">
            {!online ? t("offline.order") : (submitError ?? (quoteError ? t(quoteErrorKey[quoteError]) : ""))}
          </p>

          <div className="sticky bottom-0 mt-2 flex gap-2 bg-card pb-1 pt-1">
            <button
              type="button"
              className="press flex h-14 w-[34%] shrink-0 items-center justify-center rounded-btn bg-fill px-2 text-center text-[17px] font-bold leading-tight text-sub active:bg-fill-strong"
              onClick={() => {
                setSubmitError(undefined);
                setStep("amount");
              }}
            >
              {t("c.prev")}
            </button>
            {quoteError ? (
              <button
                type="button"
                onClick={() => setNonce((n) => n + 1)}
                className="press flex h-14 flex-1 items-center justify-center rounded-btn bg-ink px-2 text-center text-[17px] font-bold leading-tight text-white"
              >
                {t("quote.again")}
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canNext}
                className={`press flex h-14 flex-1 items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${accent}`}
              >
                {canNext || !online ? verb : <Spinner />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- 금액 입력 ----------
  const sourceText = t(quote?.source === "estimate" ? "quote.est" : "quote.live");

  // 입력값 아래 한 줄: 다른 단위로 바꾼 값(달러 ↔ 주)
  let convert = "";
  if (quote) convert = mode === "usd" ? `≈ ${qtyOf(quote.qty)}` : `≈ ${fmtUsd(quote.usd)}`;
  else if (shownNum > 0 && px) convert = mode === "usd" ? `≈ ${qtyOf(shownNum / px)}` : `≈ ${fmtUsd(shownNum * px)}`;

  let status: { text: string; tone: "mute" | "bad" | "good" };
  if (!online) status = { text: t("offline.order"), tone: "bad" };
  else if (!canOrder)
    status = { text: t(side === "buy" ? "order.st.noCash" : coin ? "order.st.noHold.coin" : "order.st.noHold.stock"), tone: "mute" };
  else if (tooSmall) status = { text: t("order.st.min", { min: fmtUsd(MIN_USD) }), tone: "bad" };
  else if (!key) status = { text: t(mode === "usd" ? "order.st.enterUsd" : "order.st.enterQty"), tone: "mute" };
  else if (quoteLoading) status = { text: [convert, t("quote.loading")].filter(Boolean).join(" · "), tone: "mute" };
  else if (quote) status = { text: `${convert} · ${sourceText}`, tone: "good" };
  else status = { text: t(quoteErrorKey[quoteError ?? "fail"]), tone: "bad" };

  const limitText =
    side === "buy"
      ? t("order.limit.buy", { v: fmtUsd(floor2(usdc)) })
      : px
        ? t("order.limit.sell", { qty: qtyOf(heldQty), v: fmtUsd(heldQty * px) })
        : t("order.limit.sellNoPx", { qty: qtyOf(heldQty) });

  const steps = mode === "usd" ? [10, 50, 100] : px && px >= 5000 ? [0.001, 0.01, 0.1] : [0.1, 1, 10];
  const unitLabel = t(coin ? "unit.coin" : "unit.share");
  const amountText = mode === "usd" ? `$${showNumber(shown)}` : qtyOf(0).replace("0", showNumber(shown));
  const long = amountText.length > 10;

  return (
    <div>
      {header}

      <div className="px-6 pb-1 pt-3 text-center">
        <div className="flex justify-center" role="group" aria-label={t("order.unit.aria")}>
          <div className="flex rounded-full bg-fill p-1">
            {(["usd", "qty"] as const).map((m) => {
              const on = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => switchMode(m)}
                  className={`press relative h-9 min-w-[64px] rounded-full px-4 text-[14px] font-semibold after:absolute after:inset-x-0 after:-inset-y-1.5 ${
                    on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-mute"
                  }`}
                >
                  {m === "usd" ? t("unit.usd") : unitLabel}
                </button>
              );
            })}
          </div>
        </div>

        <p
          key={notice}
          className={`amount-big mt-3 font-bold leading-tight tracking-[-0.03em] tabular-nums ${long ? "is-long" : ""} ${
            shown ? "text-ink" : "text-faint"
          } ${notice ? "anim-shake" : ""}`}
          aria-live="polite"
          aria-label={t(mode === "usd" ? "order.amount.aria.usd" : "order.amount.aria.qty", { v: amountText })}
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
          {notice > 0 && canOrder ? (
            <span key={notice} className="anim-rise inline-block font-semibold text-sub">
              {t(mode === "usd" ? "order.clamped.usd" : "order.clamped.qty")}
            </span>
          ) : (
            limitText
          )}
        </p>
      </div>

      <div className="mt-2 flex gap-1.5 px-4">
        {steps.map((add) => (
          <button
            key={`${mode}${add}`}
            type="button"
            disabled={!canOrder}
            onClick={() => enter(toText(shownNum + add, DP[mode]))}
            className="press h-11 min-w-0 flex-1 rounded-full bg-fill text-[14px] font-semibold tabular-nums text-sub active:bg-fill-strong disabled:text-faint"
          >
            {mode === "usd" ? `+$${add}` : `+${add}`}
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
            setNotice(0);
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
          disabled={!canNext}
          onClick={() => {
            setSubmitError(undefined);
            setStep("confirm");
          }}
          className={`press flex h-14 w-full items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${accent}`}
        >
          {quoteLoading ? <Spinner /> : t("c.next")}
        </button>
      </div>
    </div>
  );
}
