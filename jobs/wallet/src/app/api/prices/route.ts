import { prices, HttpError } from "@/lib/server/tm";
import { handle } from "@/lib/server/route";

export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return handle(async () => {
    if (!symbols.length || symbols.length > 200) throw new HttpError(400, "symbols required (max 200)");
    return prices(symbols);
  }, 30);
}
