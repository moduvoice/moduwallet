import { history, HttpError } from "@/lib/server/tm";
import { perpHistory } from "@/lib/server/perp";
import { handle } from "@/lib/server/route";
import type { Range } from "@/lib/types";

const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y"];

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const symbol = q.get("symbol") ?? "";
  const range = (q.get("range") ?? "1M") as Range;
  return handle(async () => {
    if (!symbol || !RANGES.includes(range)) throw new HttpError(400, "symbol and range(1D|1W|1M|3M|1Y) required");
    return q.get("perp") === "1" ? perpHistory(symbol, range) : history(symbol, range);
  }, range === "1D" ? 60 : 600);
}
