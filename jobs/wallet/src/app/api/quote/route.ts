import { quote, HttpError } from "@/lib/server/tm";
import { handle } from "@/lib/server/route";

// body: { symbol, side: "buy"|"sell", usd?: number, qty?: number } - usd 와 qty 중 하나
export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json().catch(() => ({}))) as { symbol?: string; side?: string; usd?: number; qty?: number };
    const usd = b.usd == null ? undefined : Number(b.usd);
    const qty = b.qty == null ? undefined : Number(b.qty);
    const okUsd = usd !== undefined && usd >= 1 && usd <= 100_000;
    const okQty = qty !== undefined && qty > 0 && qty <= 1_000_000;
    if (!b.symbol || (b.side !== "buy" && b.side !== "sell") || okUsd === okQty) {
      throw new HttpError(400, "symbol, side(buy|sell), and exactly one of usd(1~100000) or qty(>0)");
    }
    return quote(b.symbol, b.side, okUsd ? { usd } : { qty });
  });
}
