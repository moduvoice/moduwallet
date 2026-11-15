import { perpListings } from "@/lib/server/perp";
import { handle } from "@/lib/server/route";
import type { PerpMarket } from "@/lib/types";

export async function GET() {
  return handle(
    async (): Promise<PerpMarket[]> =>
      (await perpListings()).map(({ symbol, name, nameKo, icon, group, maxLeverage, fundingRate }) => ({
        symbol,
        name,
        nameKo,
        icon,
        group,
        maxLeverage,
        fundingRate,
      })),
    300,
  );
}
