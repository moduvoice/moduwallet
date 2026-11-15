"use client";
// 주문 시트: 금액 입력(키패드) → 견적 확인 → 데모 체결 → 완료
import Link from "next/link";
import { useEffect, useState } from "react";
import { executeDemo, getQuote, usePortfolio } from "@/lib/client";
import type { Stock, Trade, TradeQuote } from "@/lib/types";
import { fmtQty, fmtUsd } from "./format";
import { IconClose, IconDelete, IconInfo } from "./icons";
import { Sheet } from "./Sheet";
import { btnGray, StockLogo, unitOf } from "./ui";

type Side = "buy" | "sell";

type Props = {
  open: boolean;
  onClose: () => void;
  stock: Stock;
  side: Side;
  price?: number; // 현재가(팔 수 있는 금액 계산용)
};

export function OrderSheet({ open, onClose, stock, side, price }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label={`${(stock.nameKo ?? stock.name)} ${side === "buy" ? "사기" : "팔기"}`}>
      {(close) => <OrderBody stock={stock} side={side} price={price} close={close} />}
    </Sheet>
  );
}

const MIN_USD = 1;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;
type Key = (typeof KEYS)[number];

/** 키 하나를 눌렀을 때의 다음 입력값 */
function applyKey(t: string, k: Key): string {
  if (k === "del") return t.slice(0, -1);
  if (k === ".") return t.includes(".") ? t : t === "" ? "0." : `${t}.`;
  if (t === "0") return k;
  const next = t + k;
  const [int, dec] = next.split(".");
  if ((dec && dec.length > 2) || int.length > 7) return t;
  return next;
}

/** 입력값을 $1,234.5 처럼 보여 준다(입력한 소수 자리 그대로) */
function showAmount(t: string): string {
  if (!t) return "$0";
  const [int, dec] = t.split(".");
  const head = Number(int || "0").toLocaleString("en-US");
  return `$${head}${t.includes(".") ? `.${dec ?? ""}` : ""}`;
}

const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

/** 견적이 내 잔고·보유 수량 안에 들어오는지 확인(팔기는 시세가 살짝 움직인 만큼만 맞춰 줌) */
function fit(q: TradeQuote, usdc: number, heldQty: number): { quote?: TradeQuote; problem?: string } {
  if (q.side === "buy") {
    if (q.usd > usdc + 1e-6) return { problem: "수수료를 포함하면 잔고가 모자라요" };
    return { quote: q };
  }
  if (q.qty <= heldQty + 1e-9) return { quote: q };
  if (q.qty <= heldQty * 1.02) {
    const k = heldQty / q.qty;
    return { quote: { ...q, qty: heldQty, usd: q.usd * k, fee: q.fee * k } };
  }
  return { problem: "가진 수량보다 많아요" };
}

function isExpired(q: TradeQuote): boolean {
  const ms = Date.parse(q.expiresAt);
  return Number.isFinite(ms) && ms < Date.now();
}

function OrderBody({ stock, side, price, close }: Omit<Props, "open" | "onClose"> & { close: () => void }) {
  const pf = usePortfolio();
  const held = pf.holdings.find((h) => h.symbol === stock.symbol);
  const heldQty = held?.qty ?? 0;
  const unit = unitOf(stock.kind);
  const verb = side === "buy" ? "사기" : "팔기";
  const accent = side === "buy" ? "bg-up active:bg-up-press" : "bg-primary active:bg-primary-press";

  const [text, setText] = useState("");
  const [isMax, setIsMax] = useState(false);
  const [step, setStep] = useState<"amount" | "confirm" | "done">("amount");
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: TradeQuote; error?: boolean }>();
  const [trade, setTrade] = useState<Trade>();
  const [submitError, setSubmitError] = useState<string>();
  const [showRisk, setShowRisk] = useState(false);

  const amount = Number(text) || 0;
  const available = side === "buy" ? floor2(pf.usdc) : floor2(heldQty * (price ?? held?.avgPrice ?? 0));
  const over = amount > available + 0.004;
  const tooSmall = amount > 0 && amount < MIN_USD;
  const valid = amount >= MIN_USD && !over;
  const key = valid ? `${side}:${amount.toFixed(2)}:${nonce}` : "";
  const usdc = pf.usdc;

  // 금액이 바뀌면 잠깐(0.4초) 기다렸다가 견적을 새로 받는다
  useEffect(() => {
    if (!key || step === "done") return;
    let alive = true;
    const id = setTimeout(() => {
      getQuote(stock.symbol, side, amount)
        .then((q) => {
          if (!alive) return;
          // '최대'로 샀는데 수수료 때문에 잔고를 넘으면 금액을 조금 낮춰 다시 받는다
          if (side === "buy" && isMax && q.usd > usdc + 1e-6 && q.usd > 0) {
            setText(Math.max(0, floor2((amount * usdc) / q.usd) - 0.01).toFixed(2));
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
  }, [key, step, stock.symbol, side, amount, isMax, usdc]);

  const fresh = result && result.key === key ? result : undefined;
  const fitted = fresh?.quote ? fit(fresh.quote, pf.usdc, heldQty) : undefined;
  const quote = fitted?.quote;
  const quoteLoading = !!key && !fresh;
  const quoteError = !!fresh?.error;
  const expiresAt = fresh?.quote?.expiresAt;

  // 견적이 만료되면 새로 받는다
  useEffect(() => {
    if (!expiresAt || step === "done") return;
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms)) return;
    const id = setTimeout(() => setNonce((n) => n + 1), Math.max(ms, 3000));
    return () => clearTimeout(id);
  }, [expiresAt, step]);

  const press = (k: Key) => {
    setIsMax(false);
    setText((t) => applyKey(t, k));
  };

  const canNext = !!quote && !quoteLoading;

  // 키보드로도 입력할 수 있게
  useEffect(() => {
    if (step !== "amount") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key === "Backspace" ? "del" : e.key;
      if ((KEYS as readonly string[]).includes(k)) {
        e.preventDefault();
        setIsMax(false);
        setText((t) => applyKey(t, k as Key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

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
          {(stock.nameKo ?? stock.name)} {fmtQty(trade.qty)}
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
        {(stock.nameKo ?? stock.name)} {verb}
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
                  {quote.source === "truemarkets" ? "실시간 견적" : "현재가 기준 예상"}
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
            {submitError ?? (quoteError ? "견적을 받지 못했어요." : fitted?.problem) ?? ""}
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
  let status: { text: string; tone: "mute" | "bad" | "good" };
  if (over) status = { text: side === "buy" ? "살 수 있는 금액을 넘었어요" : "팔 수 있는 금액을 넘었어요", tone: "bad" };
  else if (tooSmall) status = { text: `${fmtUsd(MIN_USD)}부터 주문할 수 있어요`, tone: "bad" };
  else if (!key)
    status = {
      text: `${side === "buy" ? "살 수 있는 금액" : "팔 수 있는 금액"} ${fmtUsd(available)}`,
      tone: "mute",
    };
  else if (quoteLoading) status = { text: "견적 받는 중…", tone: "mute" };
  else if (quoteError) status = { text: "견적을 받지 못했어요", tone: "bad" };
  else if (fitted?.problem) status = { text: fitted.problem, tone: "bad" };
  else if (quote)
    status = {
      text: `약 ${fmtQty(quote.qty)}${unit} · ${quote.source === "truemarkets" ? "True Markets 실시간 견적" : "현재가 기준 예상"}`,
      tone: "good",
    };
  else status = { text: "", tone: "mute" };

  const chips: { label: string; add?: number }[] = [
    { label: "+$10", add: 10 },
    { label: "+$50", add: 50 },
    { label: "+$100", add: 100 },
    { label: "최대" },
  ];

  return (
    <div>
      {header}

      <div className="px-6 pb-1 pt-6 text-center">
        <p className="text-[14px] font-medium text-mute">{side === "buy" ? "얼마나 살까요?" : "얼마나 팔까요?"}</p>
        <p
          className={`mt-1 text-[44px] font-bold leading-tight tracking-[-0.03em] tabular-nums ${
            text ? (over ? "text-up" : "text-ink") : "text-faint"
          }`}
          aria-live="polite"
          aria-label={`주문 금액 ${showAmount(text)}`}
        >
          {showAmount(text)}
        </p>
        <p
          className={`mt-1 flex min-h-6 items-center justify-center gap-1.5 text-[14px] font-medium ${
            status.tone === "bad" ? "text-up" : status.tone === "good" ? "text-primary" : "text-mute"
          }`}
          role="status"
        >
          {status.text}
          {quoteError && !over && (
            <button type="button" onClick={() => setNonce((n) => n + 1)} className="-my-2.5 px-1 py-2.5 font-bold underline">
              다시 시도
            </button>
          )}
        </p>
      </div>

      <div className="mt-3 flex gap-2 px-5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={available < MIN_USD}
            onClick={() => {
              if (c.add) {
                setIsMax(false);
                setText((t) => String(Math.round(((Number(t) || 0) + c.add!) * 100) / 100));
              } else {
                setIsMax(true);
                setText(available.toFixed(2));
              }
            }}
            className="press h-11 flex-1 rounded-full bg-fill text-[14px] font-semibold text-sub active:bg-fill-strong disabled:text-faint"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 px-3" role="group" aria-label="숫자 키패드">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "del" ? "지우기" : k === "." ? "소수점" : k}
            className="press flex h-[56px] items-center justify-center rounded-2xl text-[24px] font-semibold text-ink active:bg-fill"
          >
            {k === "del" ? <IconDelete size={26} /> : k}
          </button>
        ))}
      </div>

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

function QuoteRow({ label, value, strong, hint }: { label: string; value?: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sub">
        {label}
        {hint && <span className="ml-1.5 text-[12px] text-hint">{hint}</span>}
      </dt>
      <dd className={`tabular-nums text-ink ${strong ? "text-[17px] font-bold" : "font-semibold"}`}>
        {value ?? <span className="skeleton inline-block h-4 w-16 align-middle" />}
      </dd>
    </div>
  );
}

/** 견적 남은 시간 */
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = Date.parse(expiresAt);
    if (!Number.isFinite(end)) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [expiresAt]);
  if (left === null) return null;
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <span className="tabular-nums" aria-label={`견적 남은 시간 ${m}분 ${left % 60}초`}>
      {m}:{s} 남음
    </span>
  );
}

function Spinner() {
  return (
    <span
      className="anim-spin block h-5 w-5 rounded-full border-[2.5px] border-current border-t-transparent"
      role="status"
      aria-label="불러오는 중"
    />
  );
}
