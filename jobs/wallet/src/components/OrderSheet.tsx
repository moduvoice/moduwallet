"use client";
// 주문 시트: 금액 입력(키패드, 달러 ↔ 주) → 견적 확인 → 데모 체결 → 완료
import Link from "next/link";
import { useEffect, useState } from "react";
import { executeDemo, getQuote, usePortfolio } from "@/lib/client";
import type { Stock, Trade, TradeQuote } from "@/lib/types";
import { fmtQty, fmtUsd } from "./format";
import { IconClose, IconInfo } from "./icons";
import {
  applyKey,
  Countdown,
  floor2,
  floor6,
  isExpired,
  Keypad,
  QuoteRow,
  showNumber,
  Spinner,
  toText,
  useQuoteExpiry,
  type Key,
} from "./orderKit";
import { Sheet } from "./Sheet";
import { btnGray, StockLogo, unitOf } from "./ui";

type Side = "buy" | "sell";

type Props = {
  open: boolean;
  onClose: () => void;
  stock: Stock;
  side: Side;
  price?: number; // 현재가(달러 ↔ 주 환산, 최대값 계산용)
};

export function OrderSheet({ open, onClose, stock, side, price }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label={`${stock.nameKo ?? stock.name} ${side === "buy" ? "사기" : "팔기"}`}>
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
  const pf = usePortfolio();
  const held = pf.holdings.find((h) => h.symbol === stock.symbol);
  const heldQty = held?.qty ?? 0;
  const usdc = pf.usdc;
  const unit = unitOf(stock.kind);
  const name = stock.nameKo ?? stock.name;
  const verb = side === "buy" ? "사기" : "팔기";
  const accent = side === "buy" ? "bg-up active:bg-up-press" : "bg-primary active:bg-primary-press";
  const px = price ?? held?.avgPrice; // 환산에 쓰는 1주 가격

  const [mode, setMode] = useState<Mode>("usd");
  const [text, setText] = useState("");
  const [isMax, setIsMax] = useState(false); // 최대(살 수 있는 만큼 전부 / 가진 것 전부)
  const [trim, setTrim] = useState(1); // 최대로 살 때 견적이 잔고를 넘으면 조금씩 낮추는 비율
  const [notice, setNotice] = useState(0); // 0 보다 크면 "최대로 바꿨어요" 안내(바뀔 때마다 흔들림)
  const [step, setStep] = useState<"amount" | "confirm" | "done">("amount");
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: TradeQuote; error?: boolean }>();
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
  const valid = reqValue > 0 && canOrder && !tooSmall;
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
            if (isMax) setTrim((t) => t * (usdc / q.usd) * 0.999);
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
        .catch(() => {
          if (alive) setResult({ key, error: true });
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
  const quoteError = !!fresh && !quote;
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
    const usd = quote ? floor2(quote.usd) : maxOf("usd");
    return Number.isFinite(usd) && usd > 0 ? usd.toFixed(2) : "";
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

  const canNext = !!quote && !quoteLoading;

  const submit = () => {
    if (!quote) return;
    if (isExpired(quote)) {
      setSubmitError("견적 시간이 지나서 새로 받았어요. 다시 확인해 주세요.");
      setNonce((n) => n + 1);
      return;
    }
    try {
      const t = executeDemo(quote);
      setTrade(t);
      setStep("done");
      navigator.vibrate?.(12);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "주문하지 못했어요. 다시 시도해 주세요.");
    }
  };

  // ---------- 완료 ----------
  if (step === "done" && trade) {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <span className="relative flex h-[76px] w-[76px] items-center justify-center">
          <span className="anim-ring absolute inset-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="anim-pop relative flex h-[76px] w-[76px] items-center justify-center rounded-full bg-primary">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path
                className="anim-check"
                d="M10 20.5l7 7 13.5-14.5"
                stroke="#fff"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
        <h2 className="anim-rise mt-6 text-[24px] font-bold leading-snug text-ink" role="status">
          {name} {fmtQty(trade.qty)}
          {unit}를
          <br />
          {side === "buy" ? "샀어요" : "팔았어요"}
        </h2>
        <p className="anim-rise mt-2 text-[15px] text-mute">
          {side === "buy" ? "낸 금액" : "받은 금액"} {fmtUsd(trade.usd)} · 데모 체결
        </p>
        <div className="mt-9 flex w-full gap-2">
          <Link href="/history" className={btnGray} onClick={close}>
            내역 보기
          </Link>
          <button
            type="button"
            onClick={close}
            className="press flex h-14 w-full items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white active:bg-primary-press"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-2.5 px-5 pt-4">
      <StockLogo symbol={stock.symbol} icon={stock.icon} size={32} />
      <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">
        {name} {verb}
      </h2>
      <button
        type="button"
        onClick={close}
        aria-label="닫기"
        className="press -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-mute"
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
            {quote ? (
              <>
                {fmtQty(quote.qty)}
                {unit}를 {side === "buy" ? "살까요?" : "팔까요?"}
              </>
            ) : (
              "견적을 새로 받고 있어요"
            )}
          </p>

          <dl className="mt-5 space-y-3.5 rounded-[18px] bg-fill px-4 py-4 text-[15px]" aria-busy={!quote}>
            <QuoteRow
              label={side === "buy" ? "내는 금액" : "받는 금액"}
              value={quote ? fmtUsd(quote.usd) : undefined}
              strong
              hint={side === "buy" ? "수수료 포함" : "수수료 뺀 금액"}
            />
            <QuoteRow
              label={side === "buy" ? "받는 수량" : "파는 수량"}
              value={quote ? `${fmtQty(quote.qty)}${unit}` : undefined}
            />
            <QuoteRow label={`1${unit}당 가격`} value={quote ? fmtUsd(quote.price) : undefined} />
            <QuoteRow label="수수료 (0.2%)" value={quote ? fmtUsd(quote.fee) : undefined} />
          </dl>

          <p className="mt-3 flex min-h-5 items-center justify-between text-[13px] text-mute">
            <span>
              견적 출처: True Markets
              {quote && (
                <span className="ml-1.5 rounded-full bg-fill px-2 py-0.5 text-[12px] font-semibold text-sub">
                  {quote.source === "estimate" ? "현재가 기준 예상" : "실시간 견적"}
                </span>
              )}
            </span>
            {quote && <Countdown key={quote.expiresAt} expiresAt={quote.expiresAt} />}
          </p>

          <div className="mt-4 rounded-[14px] border border-line px-3.5 py-3">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-sub">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-hint" />
              <span>
                토큰화 주식은 실제 주식이 아닌 증서이며, 원금을 잃을 수 있어요.{" "}
                <button
                  type="button"
                  onClick={() => setShowRisk((v) => !v)}
                  aria-expanded={showRisk}
                  className="-my-3 py-3 font-semibold text-sub underline underline-offset-2"
                >
                  {showRisk ? "접기" : "자세히"}
                </button>
              </span>
            </p>
            {showRisk && (
              <ul className="anim-rise mt-2 list-disc space-y-1 pl-9 text-[13px] leading-relaxed text-mute">
                <li>주가를 따라 움직이는 토큰이라, 의결권 같은 주주 권리는 없을 수 있어요.</li>
                <li>가격이 실제 주식과 조금 다를 수 있고, 장이 닫힌 시간에는 차이가 커질 수 있어요.</li>
                <li>발행사나 블록체인에 문제가 생기면 손실이 날 수 있어요.</li>
                <li>지금은 데모라서 실제 돈은 움직이지 않아요.</li>
              </ul>
            )}
          </div>

          <p className="mt-3 min-h-5 text-center text-[13px] font-medium text-up" role="alert">
            {submitError ?? (quoteError ? "견적을 받지 못했어요." : "")}
          </p>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="press flex h-14 w-[34%] shrink-0 items-center justify-center rounded-btn bg-fill text-[17px] font-bold text-sub active:bg-fill-strong"
              onClick={() => {
                setSubmitError(undefined);
                setStep("amount");
              }}
            >
              이전
            </button>
            {quoteError ? (
              <button
                type="button"
                onClick={() => setNonce((n) => n + 1)}
                className="press flex h-14 flex-1 items-center justify-center rounded-btn bg-ink text-[17px] font-bold text-white"
              >
                견적 다시 받기
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canNext}
                className={`press flex h-14 flex-1 items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${accent}`}
              >
                {canNext ? verb : <Spinner />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- 금액 입력 ----------
  const sourceText = quote?.source === "estimate" ? "현재가 기준 예상" : "True Markets 실시간 견적";

  // 입력값 아래 한 줄: 다른 단위로 바꾼 값(달러 ↔ 주)
  let convert = "";
  if (quote) convert = mode === "usd" ? `≈ ${fmtQty(quote.qty)}${unit}` : `≈ ${fmtUsd(quote.usd)}`;
  else if (shownNum > 0 && px) convert = mode === "usd" ? `≈ ${fmtQty(shownNum / px)}${unit}` : `≈ ${fmtUsd(shownNum * px)}`;

  let status: { text: string; tone: "mute" | "bad" | "good" };
  if (!canOrder)
    status = {
      text: side === "buy" ? "살 수 있는 달러가 없어요" : `가진 ${stock.kind === "crypto" ? "코인" : "주식"}이 없어요`,
      tone: "mute",
    };
  else if (tooSmall) status = { text: `${fmtUsd(MIN_USD)}부터 주문할 수 있어요`, tone: "bad" };
  else if (!key) status = { text: mode === "usd" ? "금액을 입력해 주세요" : "수량을 입력해 주세요", tone: "mute" };
  else if (quoteLoading) status = { text: [convert, "견적 받는 중…"].filter(Boolean).join(" · "), tone: "mute" };
  else if (quote) status = { text: `${convert} · ${sourceText}`, tone: "good" };
  else status = { text: "견적을 받지 못했어요", tone: "bad" };

  const limitText =
    side === "buy"
      ? `살 수 있는 금액 ${fmtUsd(floor2(usdc))}`
      : `가진 수량 ${fmtQty(heldQty)}${unit}${px ? ` · 약 ${fmtUsd(heldQty * px)}` : ""}`;

  const steps = mode === "usd" ? [10, 50, 100] : px && px >= 5000 ? [0.001, 0.01, 0.1] : [0.1, 1, 10];
  const big = showNumber(shown).length + 1 > 10;

  return (
    <div>
      {header}

      <div className="px-6 pb-1 pt-3 text-center">
        <div className="flex justify-center" role="group" aria-label="입력 단위">
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
                  {m === "usd" ? "달러" : unit}
                </button>
              );
            })}
          </div>
        </div>

        <p
          key={notice}
          className={`mt-3 font-bold leading-tight tracking-[-0.03em] tabular-nums ${big ? "text-[34px]" : "text-[44px]"} ${
            shown ? "text-ink" : "text-faint"
          } ${notice ? "anim-shake" : ""}`}
          aria-live="polite"
          aria-label={`주문 ${mode === "usd" ? "금액 $" : "수량 "}${showNumber(shown)}${mode === "qty" ? unit : ""}`}
        >
          {mode === "usd" && "$"}
          {showNumber(shown)}
          {mode === "qty" && <span className="ml-0.5 text-[0.6em]">{unit}</span>}
        </p>
        <p
          className={`mt-1 flex min-h-6 items-center justify-center gap-1.5 text-[14px] font-medium ${
            status.tone === "bad" ? "text-up" : status.tone === "good" ? "text-primary" : "text-mute"
          }`}
          role="status"
        >
          {status.text}
          {quoteError && (
            <button type="button" onClick={() => setNonce((n) => n + 1)} className="-my-2.5 px-1 py-2.5 font-bold underline">
              다시 시도
            </button>
          )}
        </p>
        <p className="mt-0.5 min-h-5 text-[13px] text-mute" role="status">
          {notice > 0 && canOrder ? (
            <span key={notice} className="anim-rise inline-block font-semibold text-sub">
              {mode === "usd" ? "최대 금액으로 바꿨어요" : "최대 수량으로 바꿨어요"}
            </span>
          ) : (
            limitText
          )}
        </p>
      </div>

      <div className="mt-2 flex gap-2 px-5">
        {steps.map((add) => (
          <button
            key={`${mode}${add}`}
            type="button"
            disabled={!canOrder}
            onClick={() => enter(toText(shownNum + add, DP[mode]))}
            className="press h-11 flex-1 rounded-full bg-fill text-[14px] font-semibold tabular-nums text-sub active:bg-fill-strong disabled:text-faint"
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
          className={`press h-11 flex-1 rounded-full text-[14px] font-semibold disabled:text-faint ${
            isMax ? "bg-primary-soft text-primary" : "bg-fill text-sub active:bg-fill-strong"
          }`}
        >
          최대
        </button>
      </div>

      <Keypad onKey={press} />

      <div className="px-5 pt-2">
        <button
          type="button"
          disabled={!canNext}
          onClick={() => {
            setSubmitError(undefined);
            setStep("confirm");
          }}
          className={`press flex h-14 w-full items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${accent}`}
        >
          {quoteLoading ? <Spinner /> : "다음"}
        </button>
      </div>
    </div>
  );
}
