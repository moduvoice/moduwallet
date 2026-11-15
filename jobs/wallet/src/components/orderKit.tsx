"use client";
// 주문 시트들(주식 사기·팔기, 레버리지)이 같이 쓰는 부품: 숫자 키패드, 견적 줄, 남은 시간, 완료 체크
import { useEffect, useEffectEvent, useState } from "react";
import { useT, type Key as TKey } from "@/i18n";
import { IconDelete } from "./icons";

export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;
export type Key = (typeof KEYS)[number];

/** 키 하나를 눌렀을 때의 다음 입력값(dp = 소수 자리 한도) */
export function applyKey(t: string, k: Key, dp: number): string {
  if (k === "del") return t.slice(0, -1);
  if (k === ".") return t.includes(".") ? t : t === "" ? "0." : `${t}.`;
  if (t === "0") return k;
  const next = t + k;
  const [int, dec] = next.split(".");
  if ((dec && dec.length > dp) || int.length > 7) return t;
  return next;
}

/** 입력값을 1,234.5 처럼 보여 준다(입력한 소수 자리 그대로) */
export function showNumber(t: string): string {
  if (!t) return "0";
  const [int, dec] = t.split(".");
  const head = Number(int || "0").toLocaleString("en-US");
  return `${head}${t.includes(".") ? `.${dec ?? ""}` : ""}`;
}

export const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;
export const floor6 = (n: number) => Math.floor(n * 1e6 + 1e-6) / 1e6;

/** 숫자를 입력 글자로(소수 끝의 0 은 뗀다) */
export function toText(n: number, dp: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "";
  const s = n.toFixed(dp);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export function isExpired(q: { expiresAt: string }): boolean {
  const ms = Date.parse(q.expiresAt);
  return Number.isFinite(ms) && ms < Date.now();
}

/** 견적 실패 종류: busy = 요청이 많음(429), fail = 그 밖 */
export type QuoteError = "busy" | "fail";

export function quoteErrorOf(e: unknown): QuoteError {
  return e instanceof Error && e.message.trim().startsWith("429") ? "busy" : "fail";
}

export const quoteErrorKey: Record<QuoteError, TKey> = { busy: "quote.busy", fail: "quote.fail" };

/** 숫자 키패드. active 인 동안에는 실제 키보드로도 입력된다 */
export function Keypad({ onKey, active = true }: { onKey: (k: Key) => void; active?: boolean }) {
  const t = useT();
  const fire = useEffectEvent((k: Key) => onKey(k));
  useEffect(() => {
    if (!active) return;
    const listen = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key === "Backspace" ? "del" : e.key;
      if ((KEYS as readonly string[]).includes(k)) {
        e.preventDefault();
        fire(k as Key);
      }
    };
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, [active]);

  return (
    <div className="mt-2 grid grid-cols-3 px-3" role="group" aria-label={t("keypad.aria")}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === "del" ? t("keypad.del") : k === "." ? t("keypad.dot") : k}
          className="kp-key press flex items-center justify-center rounded-2xl text-[24px] font-semibold text-ink active:bg-fill"
        >
          {k === "del" ? <IconDelete size={26} /> : k}
        </button>
      ))}
    </div>
  );
}

export function QuoteRow({
  label,
  value,
  strong,
  hint,
  sub,
  className = "text-ink",
}: {
  label: string;
  value?: string;
  strong?: boolean;
  hint?: string;
  sub?: React.ReactNode; // 값 아래 작은 글씨(현지 통화 환산 등)
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-sub">
        {label}
        {hint && <span className="ml-1.5 text-[12px] text-hint">{hint}</span>}
      </dt>
      <dd className={`shrink-0 text-right tabular-nums ${className} ${strong ? "text-[17px] font-bold" : "font-semibold"}`}>
        {value ?? <span className="skeleton inline-block h-4 w-16 align-middle" />}
        {value && sub}
      </dd>
    </div>
  );
}

/** 견적 출처 + 남은 시간 한 줄 */
export function QuoteSource({ quote }: { quote?: { source: "truemarkets" | "estimate"; expiresAt: string } }) {
  const t = useT();
  return (
    <p className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[13px] text-mute">
      <span>
        {t("quote.source")}
        {quote && (
          <span className="ml-1.5 inline-block rounded-full bg-fill px-2 py-0.5 text-[12px] font-semibold text-sub">
            {t(quote.source === "estimate" ? "quote.tag.est" : "quote.tag.live")}
          </span>
        )}
      </span>
      {quote && <Countdown key={quote.expiresAt} expiresAt={quote.expiresAt} />}
    </p>
  );
}

/** 견적 남은 시간 */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const t = useT();
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
  return <span className="tabular-nums">{t("quote.left", { t: `${m}:${s}` })}</span>;
}

/** 견적이 만료되면 onExpire 를 부른다(새 견적 받기용) */
export function useQuoteExpiry(expiresAt: string | undefined, active: boolean, onExpire: () => void) {
  const fire = useEffectEvent(onExpire);
  useEffect(() => {
    if (!expiresAt || !active) return;
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms)) return;
    const id = setTimeout(() => fire(), Math.max(ms, 3000));
    return () => clearTimeout(id);
  }, [expiresAt, active]);
}

export function Spinner() {
  const t = useT();
  return (
    <span
      className="anim-spin block h-5 w-5 rounded-full border-[2.5px] border-current border-t-transparent"
      role="status"
      aria-label={t("c.loading")}
    />
  );
}

/** 완료 체크 애니메이션 */
export function CheckBurst() {
  return (
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
  );
}

/** 매수·매도 가격 차이 등을 알려 주는 조용한 한 줄 */
export function QuietNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[12px] leading-relaxed text-hint">{children}</p>;
}
