import { prices, HttpError } from "@/lib/server/tm";
import { perpPrices } from "@/lib/server/perp";
import { handle } from "@/lib/server/route";

// ?symbols=NVDA,TSLA  (레버리지 가격은 &perp=1)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const symbols = (q.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const perp = q.get("perp") === "1";
  return handle(async () => {
    if (!symbols.length || symbols.length > 200) throw new HttpError(400, "symbols required (max 200)");
    return perp ? perpPrices(symbols) : prices(symbols);
  }, 30);
}
