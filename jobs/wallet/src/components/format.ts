// 숫자·날짜를 화면용 글자로 바꾸는 함수 모음

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

/** 한국식: 오르면 빨강, 내리면 파랑 */
export const toneText: Record<Tone, string> = {
  up: "text-up",
  down: "text-down",
  flat: "text-mute",
};

export const toneArrow: Record<Tone, string> = { up: "▲", down: "▼", flat: "" };

const dayFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function safe(fmt: Intl.DateTimeFormat, iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmt.format(d);
}

/** 11월 15일 (토) */
export const fmtDay = (iso: string) => safe(dayFmt, iso);
/** 오후 3:24 */
export const fmtTime = (iso: string) => safe(timeFmt, iso);
/** 2026년 11월 15일 */
export const fmtDate = (iso: string) => safe(dateFmt, iso);
/** 11월 15일 오후 3:24 */
export const fmtDateTime = (iso: string) => safe(dateTimeFmt, iso);

/** 종목 상세 주소 */
export const stockHref = (symbol: string) => `/stocks/${encodeURIComponent(symbol)}`;
