import { cached, HttpError } from "@/lib/server/tm";
import { handle } from "@/lib/server/route";

// 1달러가 각 통화로 얼마인지(참고용). 무료 공개 환율(open.er-api.com), 1시간 캐시
const CURRENCIES = ["KRW", "VND", "THB", "CNY", "RUB", "JPY", "EUR"] as const;

const rates = cached(60 * 60_000, async () => {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000), cache: "no-store" });
  const d = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  if (d.result !== "success" || !d.rates) throw new HttpError(502, "fx");
  const out: Record<string, number> = {};
  for (const c of CURRENCIES) if (d.rates[c]) out[c] = d.rates[c];
  return {
    rates: out,
    usdKrw: out.KRW, // 옛 화면 호환
    updatedAt: d.time_last_update_utc ? new Date(d.time_last_update_utc).toISOString() : new Date().toISOString(),
  };
});

export async function GET() {
  return handle(() => rates(), 3600);
}
