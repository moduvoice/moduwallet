import { quote, HttpError } from "@/lib/server/tm";
import { handle } from "@/lib/server/route";

export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json().catch(() => ({}))) as { symbol?: string; side?: string; usd?: number };
    const usd = Number(b.usd);
    if (!b.symbol || (b.side !== "buy" && b.side !== "sell") || !(usd >= 1 && usd <= 100_000)) {
      throw new HttpError(400, "symbol, side(buy|sell), usd(1~100000) required");
    }
    return quote(b.symbol, b.side, usd);
  });
}
