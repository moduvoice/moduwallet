// 레버리지(무기한 선물, Hyperliquid 를 True Markets 로 거래) - 서버 전용
import "server-only";
import type { PerpCloseQuote, PerpGroup, PerpMarket, PerpQuote, Price, Range } from "../types";
import { cached, demoUser, HttpError, orgToken, quotesApi, tm } from "./tm";

/** 보여 줄 종목만 고른다(밈코인·이름이 불분명한 것은 뺌). 순서 = 화면 순서 */
const PICK: { symbol: string; nameKo: string; group: PerpGroup }[] = [
  { symbol: "NVDA", nameKo: "엔비디아", group: "stock" },
  { symbol: "TSLA", nameKo: "테슬라", group: "stock" },
  { symbol: "AAPL", nameKo: "애플", group: "stock" },
  { symbol: "SKHX", nameKo: "SK하이닉스", group: "stock" },
  { symbol: "MU", nameKo: "마이크론", group: "stock" },
  { symbol: "INTC", nameKo: "인텔", group: "stock" },
  { symbol: "SNDK", nameKo: "샌디스크", group: "stock" },
  { symbol: "CRCL", nameKo: "서클", group: "stock" },
  { symbol: "SPCX", nameKo: "스페이스X", group: "stock" },
  { symbol: "MRNA", nameKo: "모더나", group: "stock" },
  { symbol: "SP500", nameKo: "S&P 500", group: "index" },
  { symbol: "CL", nameKo: "원유(WTI)", group: "commodity" },
  { symbol: "BRENTOIL", nameKo: "브렌트유", group: "commodity" },
  { symbol: "SILVER", nameKo: "은", group: "commodity" },
  { symbol: "BTC", nameKo: "비트코인", group: "crypto" },
  { symbol: "ETH", nameKo: "이더리움", group: "crypto" },
  { symbol: "SOL", nameKo: "솔라나", group: "crypto" },
  { symbol: "XRP", nameKo: "리플", group: "crypto" },
];

type RawPerp = {
  id: string;
  economic_asset_id: string;
  symbol: string;
  name: string;
  icon?: string;
  image?: { small?: string };
  tradeable: boolean;
  status: string;
  perp: { max_leverage: number; funding_rate: string };
};

export type PerpListing = PerpMarket & { assetId: string; econId: string };

export const perpListings = cached(10 * 60_000, async (): Promise<PerpListing[]> => {
  const { status, body } = await tm<{ data: RawPerp[] }>("/v1/gateway/assets?product_type=perp");
  if (status !== 200) throw new HttpError(502, `perp assets ${status}`);
  const by = new Map(body.data.filter((a) => a.tradeable && a.status === "active").map((a) => [a.symbol, a]));
  return PICK.flatMap((p) => {
    const a = by.get(p.symbol);
    if (!a) return [];
    return [
      {
        symbol: p.symbol,
        name: a.name,
        nameKo: p.nameKo,
        icon: a.image?.small || a.icon,
        group: p.group,
        maxLeverage: a.perp.max_leverage,
        fundingRate: Number(a.perp.funding_rate),
        assetId: a.id,
        econId: a.economic_asset_id,
      },
    ];
  });
});

export async function perpListing(symbol: string) {
  const l = (await perpListings()).find((s) => s.symbol === symbol.toUpperCase());
  if (!l) throw new HttpError(404, `unknown perp ${symbol}`);
  return l;
}

// ---------- 시세(선물 가격) ----------
type Pt = { t: string; price: string };
const RANGE: Record<Range, { window: string; resolution: string }> = {
  "1D": { window: "1d", resolution: "15m" },
  "1W": { window: "7d", resolution: "1h" },
  "1M": { window: "1M", resolution: "4h" },
  "3M": { window: "3M", resolution: "1d" },
  "1Y": { window: "12M", resolution: "1d" },
};

async function perpSeries(econId: string, window: string, resolution: string) {
  const { status, body } = await tm<{ points?: Pt[] }>(
    `/v1/defi/market/prices/history?asset_id=${econId}&asset_class=perp&window=${window}&resolution=${resolution}`,
  );
  if (status !== 200) throw new HttpError(502, `perp history ${status}`);
  return (body.points ?? []).map((p) => ({ t: p.t, price: Number(p.price) })).filter((p) => p.price > 0);
}

export async function perpHistory(symbol: string, range: Range) {
  const l = await perpListing(symbol);
  return perpSeries(l.econId, RANGE[range].window, RANGE[range].resolution);
}

const priceCache = new Map<string, { at: number; v: Price }>();

/** 선물 현재가와 24시간 등락. 30초 캐시 */
export async function perpPrices(symbols: string[]): Promise<Price[]> {
  const all = await perpListings();
  const want = symbols.map((s) => all.find((l) => l.symbol === s.toUpperCase())).filter((l): l is PerpListing => !!l);
  const now = Date.now();
  await Promise.all(
    want
      .filter((l) => !(priceCache.get(l.symbol) && now - priceCache.get(l.symbol)!.at < 30_000))
      .map(async (l) => {
        try {
          const pts = await perpSeries(l.econId, "1d", "1h");
          if (!pts.length) return;
          const last = pts[pts.length - 1].price;
          priceCache.set(l.symbol, { at: now, v: { symbol: l.symbol, price: last, change24h: last / pts[0].price - 1 } });
        } catch {
          // 한 종목 실패는 건너뛴다
        }
      }),
  );
  return want.map((l) => priceCache.get(l.symbol)?.v).filter((p): p is Price => !!p);
}

// ---------- 견적 ----------
/**
 * 예상 청산가(격리 마진). 유지 증거금률 = 1 / (2 × 최대 배율) 로 근사(Hyperliquid 방식).
 * 롱: 진입가 × (1 - 1/배율 + 유지율), 숏: 진입가 × (1 + 1/배율 - 유지율)
 */
export function liqPrice(entry: number, leverage: number, maxLeverage: number, side: "long" | "short") {
  const mmr = 1 / (2 * maxLeverage);
  const move = 1 / leverage - mmr;
  return side === "long" ? entry * (1 - move) : entry * (1 + move);
}

const expires = () => new Date(Date.now() + 110_000).toISOString();

/** 열기 견적: margin(내 돈) × leverage 만큼 포지션 */
export async function perpOpenQuote(symbol: string, side: "long" | "short", margin: number, leverage: number): Promise<PerpQuote> {
  const l = await perpListing(symbol);
  if (!(leverage >= 1 && leverage <= l.maxLeverage)) throw new HttpError(400, `leverage 1~${l.maxLeverage}`);
  const fallback = async (): Promise<PerpQuote> => {
    const [p] = await perpPrices([l.symbol]);
    if (!p) throw new HttpError(502, "no price");
    const notional = margin * leverage;
    return {
      symbol: l.symbol,
      side,
      leverage,
      margin,
      qty: notional / p.price,
      price: p.price,
      notional,
      fee: notional * 0.0003,
      liqPrice: liqPrice(p.price, leverage, l.maxLeverage, side),
      expiresAt: expires(),
      source: "estimate",
    };
  };
  try {
    const { token } = await orgToken();
    const { status, body: q } = await quotesApi(token, await demoUser(), {
      asset_id: l.assetId,
      qty: margin.toFixed(2),
      qty_unit: "quote",
      side: side === "long" ? "buy" : "sell",
      leverage,
    });
    if (status !== 200 || !q.qty || !q.price) return fallback();
    const price = Number(q.price);
    const qty = Number(q.qty);
    return {
      symbol: l.symbol,
      side,
      leverage,
      margin,
      qty,
      price,
      notional: Number(q.notional ?? qty * price),
      fee: Number(q.fee ?? 0),
      liqPrice: liqPrice(price, leverage, l.maxLeverage, side),
      expiresAt: expires(),
      source: "truemarkets",
    };
  } catch (e) {
    if (e instanceof HttpError && e.status < 500) throw e;
    return fallback();
  }
}

/** 닫기 견적: 반대 방향으로 같은 수량 */
export async function perpCloseQuote(symbol: string, side: "long" | "short", qty: number, leverage: number): Promise<PerpCloseQuote> {
  const l = await perpListing(symbol);
  const fallback = async (): Promise<PerpCloseQuote> => {
    const [p] = await perpPrices([l.symbol]);
    if (!p) throw new HttpError(502, "no price");
    return { symbol: l.symbol, qty, price: p.price, fee: qty * p.price * 0.0003, expiresAt: expires(), source: "estimate" };
  };
  try {
    const { token } = await orgToken();
    const { status, body: q } = await quotesApi(token, await demoUser(), {
      asset_id: l.assetId,
      qty: qty.toFixed(6),
      qty_unit: "base",
      side: side === "long" ? "sell" : "buy",
      leverage: Math.min(Math.max(1, Math.round(leverage)), l.maxLeverage),
    });
    if (status !== 200 || !q.price) return fallback();
    return { symbol: l.symbol, qty, price: Number(q.price), fee: Number(q.fee ?? 0), expiresAt: expires(), source: "truemarkets" };
  } catch (e) {
    if (e instanceof HttpError && e.status < 500) throw e;
    return fallback();
  }
}
