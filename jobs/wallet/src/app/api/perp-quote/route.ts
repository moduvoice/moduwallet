import { perpCloseQuote, perpOpenQuote } from "@/lib/server/perp";
import { HttpError } from "@/lib/server/tm";
import { handle } from "@/lib/server/route";
import { rateLimit } from "@/lib/server/limit";

// 열기: { action: "open", symbol, side: "long"|"short", margin, leverage }
// 닫기: { action: "close", symbol, side: "long"|"short"(포지션 방향), qty, leverage }
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(req, 60);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const symbol = String(b.symbol ?? "");
    const side = b.side;
    const leverage = Number(b.leverage);
    if (!symbol || (side !== "long" && side !== "short") || !(leverage >= 1)) {
      throw new HttpError(400, "symbol, side(long|short), leverage required");
    }
    if (b.action === "close") {
      const qty = Number(b.qty);
      if (!(qty > 0)) throw new HttpError(400, "qty required");
      return perpCloseQuote(symbol, side, qty, leverage);
    }
    const margin = Number(b.margin);
    if (!(margin >= 1 && margin <= 100_000)) throw new HttpError(400, "margin 1~100000");
    return perpOpenQuote(symbol, side, margin, Math.round(leverage));
  });
}
