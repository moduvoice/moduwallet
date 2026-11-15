"use client";
// 레버리지 시작하기: 한 화면에 질문 하나씩
//   어느 쪽? → 몇 배? → 얼마? → 확인 → 완료
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPerpHistory, getPerpOpenQuote, openPositionDemo, useAsync, usePortfolio } from "@/lib/client";
import type { PerpMarket, PerpQuote, Price } from "@/lib/types";
import { Chart } from "./Chart";
import { fmtSignedUsd, fmtUsd, josa } from "./format";
import { IconBack, IconClose } from "./icons";
import { LeverageGuide } from "./LeverageGuide";
import {
  applyKey,
  CheckBurst,
  floor2,
  isExpired,
  Keypad,
  QuoteRow,
  QuoteSource,
  showNumber,
  Spinner,
  toText,
  useQuoteExpiry,
  type Key,
} from "./orderKit";
import { estLiqDistance, fmtRate, riskOf, SIDE, type PerpSide } from "./perp";
import { Sheet } from "./Sheet";
import { btnGray, Change, Skeleton, StockLogo } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  market: PerpMarket;
  price?: Price;
};

export function PerpOpenSheet({ open, onClose, market, price }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label={`${market.nameKo} 레버리지 시작하기`}>
      {(close) => <Body market={market} price={price} close={close} />}
    </Sheet>
  );
}

type Step = "side" | "lev" | "amount" | "confirm" | "done";
const ORDER: Step[] = ["side", "lev", "amount", "confirm"];
const MIN_USD = 1;
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
  const pf = usePortfolio();
  const usdc = pf.usdc;
  const name = market.nameKo;
  const nameGa = name + josa(name, "이", "가"); // 엔비디아가 / 애플이
  const maxLev = Math.max(1, Math.floor(market.maxLeverage));

  const [step, setStep] = useState<Step>("side");
  const [side, setSide] = useState<PerpSide>("long");
  const [lev, setLev] = useState(Math.min(5, maxLev));
  const [text, setText] = useState("");
  const [isMax, setIsMax] = useState(false);
  const [trim, setTrim] = useState(1);
  const [notice, setNotice] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: PerpQuote; error?: boolean }>();
  const [remembered, setRemembered] = useState(false); // 예전에 이미 동의함
  const [ack, setAck] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [guide, setGuide] = useState(false);

  const s = SIDE[side];
  const risk = riskOf(lev);
  const canOrder = usdc >= MIN_USD;

  // 넣을 수 있는 최대 = 잔고에서 수수료를 뺀 만큼
  const maxMargin = floor2((usdc * trim) / (1 + lev * FEE_EST));
  const margin = isMax ? maxMargin : Number(text) || 0;
  const tooSmall = margin > 0 && margin < MIN_USD;
  const quoting = step === "amount" || step === "confirm";
  const valid = quoting && canOrder && margin >= MIN_USD;
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
            if (isMax) setTrim((t) => t * 0.998);
            else {
              setIsMax(true);
              setNotice((n) => n + 1);
            }
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
  }, [key, market.symbol, side, margin, lev, isMax, usdc]);

  const fresh = result && result.key === key ? result : undefined;
  const quote = fresh?.quote;
  const quoteLoading = !!key && !fresh;
  const quoteError = !!fresh?.error;
  useQuoteExpiry(quote?.expiresAt, quoting, () => setNonce((n) => n + 1));

  // 모두 잃는 선까지 거리: 견적이 있으면 견적의 청산가로, 없으면 어림값
  const liqDist = quote && quote.price > 0 ? Math.abs(quote.liqPrice - quote.price) / quote.price : estLiqDistance(lev, maxLev);
  const against = side === "long" ? "내리면" : "오르면"; // 잃는 방향
  const toward = side === "long" ? "오르면" : "내리면"; // 버는 방향

  const shown = isMax ? maxMargin.toFixed(2) : text;

  const enter = (next: string) => {
    const n = Number(next) || 0;
    const limit = floor2(usdc / (1 + lev * FEE_EST));
    const hit = n > 0 && (!canOrder || n >= limit - 0.004);
    setTrim(1);
    setIsMax(hit && canOrder);
    setText(hit ? "" : next);
    setNotice(n > 0 && (!canOrder || n > limit + 0.004) ? (v) => v + 1 : 0);
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
      setSubmitError("견적 시간이 지나서 새로 받았어요. 다시 확인해 주세요.");
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
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "시작하지 못했어요. 다시 시도해 주세요.");
    }
  };

  // ---------- 완료 ----------
  if (step === "done") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckBurst />
        <h2 className="anim-rise mt-6 text-[24px] font-bold leading-snug text-ink" role="status">
          {name} {lev}배,
          <br />
          {s.dir}으로 시작했어요
        </h2>
        <p className="anim-rise mt-2 text-[15px] leading-relaxed text-mute">
          홈과 레버리지 탭에서 지켜보다가
          <br />
          언제든 정리할 수 있어요 · 데모 체결
        </p>
        <div className="mt-9 flex w-full gap-2">
          <Link href="/leverage" className={btnGray} onClick={close}>
            내 레버리지 보기
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

  const stepIndex = ORDER.indexOf(step);
  const header = (
    <div className="flex items-center px-2 pt-2">
      {stepIndex > 0 ? (
        <button type="button" onClick={back} aria-label="이전" className="press flex h-11 w-11 items-center justify-center rounded-full text-ink">
          <IconBack size={24} />
        </button>
      ) : (
        <span className="flex h-11 w-11 items-center justify-center">
          <StockLogo symbol={market.symbol} icon={market.icon} size={30} />
        </span>
      )}
      <div className="flex flex-1 items-center justify-center gap-1.5" role="img" aria-label={`${ORDER.length}단계 중 ${stepIndex + 1}단계`}>
        {ORDER.map((o, i) => (
          <span key={o} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-5 bg-ink" : i < stepIndex ? "w-1.5 bg-ink" : "w-1.5 bg-fill-strong"}`} />
        ))}
      </div>
      <button type="button" onClick={close} aria-label="닫기" className="press flex h-11 w-11 items-center justify-center rounded-full text-mute">
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
          <h2 className="text-[24px] font-bold leading-snug text-ink">
            {name},
            <br />
            어느 쪽일 것 같아요?
          </h2>
          <p className="mt-2 flex min-h-6 items-center gap-2 text-[15px]">
            {price ? (
              <>
                <span className="font-semibold tabular-nums text-ink">{fmtUsd(price.price)}</span>
                <span className="text-mute">어제보다</span>
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
              className={`press flex min-h-[112px] flex-col items-start justify-between rounded-card px-4 py-4 text-left ${SIDE[k].soft}`}
            >
              <span className={`text-[26px] leading-none ${SIDE[k].text}`} aria-hidden="true">
                {k === "long" ? "▲" : "▼"}
              </span>
              <span>
                <span className={`block text-[18px] font-bold ${SIDE[k].text}`}>{SIDE[k].guess}</span>
                <span className="mt-0.5 block text-[13px] text-sub">
                  {k === "long" ? "오르면 벌어요" : "내리면 벌어요"} · {SIDE[k].word}
                </span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setGuide(true)}
          className="mx-auto mt-1 flex h-11 items-center px-4 text-[14px] font-semibold text-mute underline underline-offset-2"
        >
          레버리지가 뭐예요?
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
          <h2 className="text-[24px] font-bold leading-snug text-ink">몇 배로 할까요?</h2>
          <p className="mt-1 text-[14px] text-mute">
            {name}{josa(name, "은", "는")} 최대 {maxLev}배까지 할 수 있어요
          </p>

          <div className="mt-5 flex items-center justify-center gap-2.5">
            <span className="text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
              {lev}
              <span className="ml-0.5 text-[0.55em]">배</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${risk.bg} ${risk.text}`}>{risk.label}</span>
          </div>

          <input
            type="range"
            min={1}
            max={maxLev}
            step={1}
            value={lev}
            onChange={(e) => setLev(Number(e.target.value))}
            aria-label="배수"
            aria-valuetext={`${lev}배, ${risk.label}`}
            className="lev-range mt-3 h-11 w-full"
          />
          <div className="-mt-1 flex justify-between text-[12px] text-hint" aria-hidden="true">
            <span>1배</span>
            <span>{maxLev}배</span>
          </div>

          <div className="mt-2 flex gap-1.5" role="group" aria-label="자주 쓰는 배수">
            {chips.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === lev}
                onClick={() => setLev(n)}
                className={`press h-11 flex-1 rounded-full text-[14px] font-semibold tabular-nums ${
                  n === lev ? "bg-ink text-white" : "bg-fill text-sub active:bg-fill-strong"
                }`}
              >
                {n}배
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2.5 rounded-[18px] bg-fill px-4 py-4 text-[15px] leading-snug" aria-live="polite">
            <p className="text-sub">
              {nameGa} <b className="font-semibold text-ink">1% {toward}</b> 내 돈은{" "}
              <b className="font-bold tabular-nums text-up">+{lev}%</b>
            </p>
            <p className="text-sub">
              {nameGa} <b className="font-semibold text-ink">1% {against}</b> 내 돈은{" "}
              <b className="font-bold tabular-nums text-down">-{lev}%</b>
            </p>
            <p className="border-t border-line pt-2.5 font-semibold text-ink">
              <span aria-hidden="true">🚨 </span>
              {nameGa} <span className={risk.text}>약 {fmtRate(liqDist)}</span> {against} 넣은 돈을 모두 잃어요
            </p>
          </div>
        </div>
        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={() => setStep("amount")}
            className={`press flex h-14 w-full items-center justify-center rounded-btn text-[17px] font-bold text-white ${s.bg}`}
          >
            {lev}배로 할게요
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
    const canSubmit = !!quote && !quoteLoading && (!needAck || ack);
    return (
      <div>
        {header}
        <div className="px-6 pt-3">
          <h2 className="text-[22px] font-bold leading-snug text-ink">
            {nameGa} <span className={s.text}>{s.dir}</span>에
            <br />
            {fmtUsd(margin)}를 {lev}배로 넣을까요?
          </h2>

          <table className="mt-4 w-full overflow-hidden rounded-[18px] bg-fill text-[14px]" aria-busy={!quote}>
            <caption className="sr-only">가격이 움직이면 내 돈이 어떻게 되는지</caption>
            <thead>
              <tr className="text-left text-[12px] text-mute">
                <th scope="col" className="px-4 pb-1 pt-3 font-medium">
                  {name} 가격이
                </th>
                <th scope="col" className="px-4 pb-1 pt-3 text-right font-medium">
                  내 돈 {fmtUsd(margin)}은
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr>
                <td className="px-4 py-2 text-sub">
                  {fmtRate(move)} {toward}
                </td>
                <td className="px-4 py-2 text-right font-bold text-up">{quote ? fmtSignedUsd(swing) : "…"}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sub">
                  {fmtRate(move)} {against}
                </td>
                <td className="px-4 py-2 text-right font-bold text-down">{quote ? fmtSignedUsd(-swing) : "…"}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-4 pb-3 pt-2.5 font-semibold text-ink">
                  {fmtRate(liqDist)} {against}
                  <span className="block text-[12px] font-normal text-mute">{quote ? `${fmtUsd(quote.liqPrice)}가 되면 (청산)` : "청산"}</span>
                </td>
                <td className="px-4 pb-3 pt-2.5 text-right font-bold text-ink">
                  {quote ? fmtSignedUsd(-quote.margin) : "…"}
                  <span className="block text-[12px] font-semibold text-up">전부 잃어요</span>
                </td>
              </tr>
            </tbody>
          </table>

          <dl className="mt-3 space-y-2.5 px-1 text-[14px]">
            <QuoteRow label="실제로 움직이는 금액" hint={`${lev}배`} value={quote ? fmtUsd(quote.notional) : undefined} />
            <QuoteRow label="시작 가격" value={quote ? fmtUsd(quote.price) : undefined} />
            <QuoteRow label="수수료" value={quote ? fmtUsd(quote.fee) : undefined} />
            <QuoteRow label="지금 내는 돈" hint="넣는 돈 + 수수료" value={quote ? fmtUsd(quote.margin + quote.fee) : undefined} strong />
          </dl>
          <QuoteSource quote={quote} />

          {needAck && (
            <label className="mt-3 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[14px] border border-line px-3.5 py-2">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              <span className="text-[14px] font-semibold leading-snug text-ink">넣은 돈을 모두 잃을 수 있다는 걸 알아요</span>
            </label>
          )}

          <p className="mt-2 min-h-5 text-center text-[13px] font-medium text-up" role="alert">
            {submitError ?? (quoteError ? "견적을 받지 못했어요." : "")}
          </p>

          {quoteError ? (
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="press mt-1 flex h-14 w-full items-center justify-center rounded-btn bg-ink text-[17px] font-bold text-white"
            >
              견적 다시 받기
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={`press mt-1 flex h-14 w-full items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${s.bg}`}
            >
              {!quote || quoteLoading ? <Spinner /> : `${lev}배로 시작하기`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- 3. 얼마? ----------
  let status: { text: string; tone: "mute" | "bad" | "good" };
  if (!canOrder) status = { text: "넣을 수 있는 달러가 없어요", tone: "mute" };
  else if (tooSmall) status = { text: `${fmtUsd(MIN_USD)}부터 넣을 수 있어요`, tone: "bad" };
  else if (!key) status = { text: "금액을 입력해 주세요", tone: "mute" };
  else if (quoteError) status = { text: "견적을 받지 못했어요", tone: "bad" };
  else
    status = {
      text: `실제로 움직이는 금액 ${fmtUsd(quote ? quote.notional : margin * lev)}${quote ? "" : " · 견적 받는 중…"}`,
      tone: quote ? "good" : "mute",
    };

  return (
    <div>
      {header}
      <div className="px-6 pb-1 pt-3 text-center">
        <h2 className="text-left text-[24px] font-bold leading-snug text-ink">얼마를 넣을까요?</h2>
        <p className="mt-1 text-left text-[14px] text-mute">
          <span className={`font-semibold ${s.text}`}>{s.dir}</span> · {lev}배 · 잃어도 이 돈까지만 잃어요
        </p>
        <p
          key={notice}
          className={`mt-5 text-[44px] font-bold leading-tight tracking-[-0.03em] tabular-nums ${shown ? "text-ink" : "text-faint"} ${
            notice ? "anim-shake" : ""
          }`}
          aria-live="polite"
          aria-label={`넣는 돈 $${showNumber(shown)}`}
        >
          ${showNumber(shown)}
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
              최대 금액으로 바꿨어요
            </span>
          ) : (
            `넣을 수 있는 금액 ${fmtUsd(floor2(usdc / (1 + lev * FEE_EST)))}`
          )}
        </p>
      </div>

      <div className="mt-2 flex gap-2 px-5">
        {[10, 50, 100].map((add) => (
          <button
            key={add}
            type="button"
            disabled={!canOrder}
            onClick={() => enter(toText((Number(shown) || 0) + add, 2))}
            className="press h-11 flex-1 rounded-full bg-fill text-[14px] font-semibold tabular-nums text-sub active:bg-fill-strong disabled:text-faint"
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
          disabled={!quote || quoteLoading}
          onClick={() => {
            setSubmitError(undefined);
            setRemembered(readAck());
            setStep("confirm");
          }}
          className={`press flex h-14 w-full items-center justify-center rounded-btn text-[17px] font-bold text-white disabled:bg-fill-strong disabled:text-faint ${s.bg}`}
        >
          {quoteLoading ? <Spinner /> : "다음"}
        </button>
      </div>
    </div>
  );
}

/** 첫 화면의 작은 1일 차트(판단 참고용) */
function MiniChart({ symbol, name }: { symbol: string; name: string }) {
  const history = useAsync(() => getPerpHistory(symbol, "1D"), [symbol]);
  const points = history.data && history.data.length >= 2 ? history.data : undefined;
  if (!points) {
    return (
      <div className="mt-3 flex h-[96px] items-center justify-center px-6">
        {history.loading ? <Skeleton className="h-full w-full !rounded-2xl" /> : <span className="text-[13px] text-hint">그래프를 불러오지 못했어요</span>}
      </div>
    );
  }
  const up = points[points.length - 1].price >= points[0].price;
  return (
    <div className="mt-3 overflow-hidden">
      <Chart points={points} color={up ? "#F04452" : "#3182F6"} label={`${name} 1일 가격 그래프`} height={96} />
    </div>
  );
}
