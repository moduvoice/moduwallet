import { visibleListings } from "@/lib/server/tm";
import { handle } from "@/lib/server/route";
import type { Stock } from "@/lib/types";

export async function GET() {
  return handle(async (): Promise<Stock[]> => (await visibleListings()).map(({ symbol, name, nameKo, icon, kind }) => ({ symbol, name, nameKo, icon, kind })), 600);
}
