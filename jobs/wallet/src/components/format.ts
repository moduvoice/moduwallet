// 숫자·날짜를 화면용 글자로 바꾸는 함수 모음. 돈은 늘 달러($), 날짜는 지금 언어의 로캘을 따른다.
import { getLocale } from "@/i18n";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $1,234.56 */
export function fmtUsd(n: number): string {
  return usd.format(Number.isFinite(n) ? n : 0);
}

/** +$1.20 / -$1.20 / $0.00 */
export function fmtSignedUsd(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return usd.format(0);
  return (n > 0 ? "+" : "-") + usd.format(Math.abs(n));
}

/** 0.012 → +1.20% */
export function fmtPct(ratio: number): string {
  const v = Number.isFinite(ratio) ? ratio * 100 : 0;
  if (Math.abs(v) < 0.005) return "0.00%";
  return `${v > 0 ? "+" : "-"}${Math.abs(v).toFixed(2)}%`;
}

/** 주식 수: 작을수록 소수 자리를 더 보여 준다(최대 6자리) */
export function fmtQty(q: number): string {
  const abs = Math.abs(q);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(q);
}

export type Tone = "up" | "down" | "flat";

export function toneOf(n: number, eps = 0.00005): Tone {
  if (!Number.isFinite(n) || Math.abs(n) < eps) return "flat";
  return n > 0 ? "up" : "down";
}

/** 오르면 up 색, 내리면 down 색(색 자체는 언어별 테마가 정한다: 한국·중국은 빨강이 상승) */
export const toneText: Record<Tone, string> = {
  up: "text-up",
  down: "text-down",
  flat: "text-mute",
};

/** 차트 선 색(CSS 변수) */
export const toneVar: Record<Tone, string> = {
  up: "var(--color-up)",
  down: "var(--color-down)",
  flat: "var(--color-hint)",
};

export const toneArrow: Record<Tone, string> = { up: "▲", down: "▼", flat: "" };

const cache = new Map<string, Intl.DateTimeFormat>();

function dateText(iso: string, name: string, options: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = getLocale();
  const key = `${locale}:${name}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    cache.set(key, fmt);
  }
  return fmt.format(d);
}

/** 11월 15일 (토) / Sat, Nov 15 */
export const fmtDay = (iso: string) => dateText(iso, "day", { month: "long", day: "numeric", weekday: "short" });
/** 오후 3:24 / 3:24 PM */
export const fmtTime = (iso: string) => dateText(iso, "time", { hour: "numeric", minute: "2-digit" });
/** 2026년 11월 15일 */
export const fmtDate = (iso: string) => dateText(iso, "date", { year: "numeric", month: "long", day: "numeric" });
/** 11월 15일 오후 3:24 */
export const fmtDateTime = (iso: string) =>
  dateText(iso, "datetime", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

/** 종목 상세 주소 */
export const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
