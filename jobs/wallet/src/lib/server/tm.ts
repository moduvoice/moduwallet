// True Markets 연결(서버 전용). 키는 환경변수에서만 읽는다.
import "server-only";
import { createPrivateKey, sign, type JsonWebKey } from "node:crypto";
import type { HistoryPoint, Price, Range, Stock, TradeQuote } from "../types";
import { NAMES_KO } from "./names-ko";

const API = "https://api.truemarkets.co";

// ---------- 공통 ----------
async function tm<T>(path: string, init?: RequestInit & { token?: string; onBehalfOf?: string }): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.token) headers.authorization = `Bearer ${init.token}`;
  if (init?.onBehalfOf) headers["TM-On-Behalf-Of"] = init.onBehalfOf;
  const res = await fetch(API + path, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) }, cache: "no-store" });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as T };
}

function cached<T>(ttlMs: number, fn: () => Promise<T>) {
  let value: T | undefined;
  let at = 0;
  let pending: Promise<T> | undefined;
  return async () => {
    if (value !== undefined && Date.now() - at < ttlMs) return value;
    pending ??= fn()
      .then((v) => {
        value = v;
        at = Date.now();
        return v;
      })
      .finally(() => (pending = undefined));
    return pending;
  };
}

// ---------- 종목 ----------
type RawAsset = {
  id: string;
  economic_asset_id: string;
  symbol: string;
  name: string;
  chain: string | null;
  venue: string;
  asset_class: string;
  tradeable: boolean;
  status: string;
  icon?: string;
  image?: { small?: string };
};

/** 화면 종목 하나 = 같은 주식의 여러 토큰 중 거래에 쓸 대표 하나 */
export type Listing = Stock & { assetId: string; econId: string; chain: string };

const ETF = new Set(["SPY", "QQQ", "SOXX", "XLK", "SGOV", "SLV", "USO", "GLD", "SPMO", "EWY"]);
const CRYPTO = new Set(["BTC", "ETH", "SOL"]);
const CHAIN_RANK: Record<string, number> = { robinhood: 0, base: 1, solana: 2, "hypercore-spot": 3 };

function baseSymbol(a: RawAsset) {
  if (a.asset_class !== "stock") return a.symbol;
  if (a.chain === "solana" && a.symbol.endsWith("X")) return a.symbol.slice(0, -1); // xStocks
  if (a.chain === "base" && a.symbol.endsWith("C")) return a.symbol.slice(0, -1); // Coinbase
  return a.symbol;
}

export const listings = cached(10 * 60_000, async (): Promise<Listing[]> => {
  const { status, body } = await tm<{ data: RawAsset[] }>("/v1/gateway/assets?asset_class=crypto,stock");
  if (status !== 200) throw new Error(`assets ${status}`);
  const best = new Map<string, RawAsset>();
  for (const a of body.data) {
    if (a.venue !== "defi" || !a.tradeable || a.status !== "active" || !a.chain) continue;
    if (a.asset_class === "crypto" && !CRYPTO.has(a.symbol)) continue;
    const key = baseSymbol(a);
    const cur = best.get(key);
    if (!cur || (CHAIN_RANK[a.chain] ?? 9) < (CHAIN_RANK[cur.chain!] ?? 9)) best.set(key, a);
  }
  return [...best.entries()]
    .map(([symbol, a]) => ({
      symbol,
      name: a.name,
      nameKo: NAMES_KO[symbol],
      icon: a.image?.small || a.icon,
      kind: (a.asset_class === "crypto" ? "crypto" : ETF.has(symbol) ? "etf" : "stock") as Stock["kind"],
      assetId: a.id,
      econId: a.economic_asset_id,
      chain: a.chain!,
    }))
    .sort((x, y) => x.symbol.localeCompare(y.symbol));
});

export async function listing(symbol: string) {
  const l = (await listings()).find((s) => s.symbol === symbol.toUpperCase());
  if (!l) throw new HttpError(404, `unknown symbol ${symbol}`);
  return l;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- 시세 ----------
const RANGE: Record<Range, { window: string; resolution: string }> = {
  "1D": { window: "1d", resolution: "15m" },
  "1W": { window: "7d", resolution: "1h" },
  "1M": { window: "1M", resolution: "4h" },
  "3M": { window: "3M", resolution: "1d" },
  "1Y": { window: "12M", resolution: "1d" },
};

type Pt = { t: string; price: string };

export async function history(symbol: string, range: Range): Promise<HistoryPoint[]> {
  const l = await listing(symbol);
  const r = RANGE[range];
  const { status, body } = await tm<{ points?: Pt[] }>(
    `/v1/defi/market/prices/history?asset_id=${l.econId}&window=${r.window}&resolution=${r.resolution}`,
  );
  if (status !== 200) throw new HttpError(502, `history ${status}`);
  return (body.points ?? []).map((p) => ({ t: p.t, price: Number(p.price) })).filter((p) => p.price > 0);
}

// 현재가: 24시간 기록 묶음 조회 1번으로 여러 종목. 30초 캐시
const priceCache = new Map<string, { at: number; v: Price }>();

export async function prices(symbols: string[]): Promise<Price[]> {
  const all = await listings();
  const want = symbols.map((s) => all.find((l) => l.symbol === s.toUpperCase())).filter((l): l is Listing => !!l);
  const now = Date.now();
  const stale = want.filter((l) => !(priceCache.get(l.symbol) && now - priceCache.get(l.symbol)!.at < 30_000));
  for (let i = 0; i < stale.length; i += 40) {
    const chunk = stale.slice(i, i + 40);
    const { status, body } = await tm<{ results?: { asset_id?: string; points?: Pt[]; error?: string }[] }>(
      `/v1/defi/market/prices/history/batch?asset_ids=${chunk.map((l) => l.econId).join(",")}&window=1d&resolution=1h`,
    );
    if (status !== 200) throw new HttpError(502, `prices ${status}`);
    for (const r of body.results ?? []) {
      const l = chunk.find((c) => c.econId === r.asset_id);
      const pts = (r.points ?? []).map((p) => Number(p.price)).filter((p) => p > 0);
      if (!l || !pts.length) continue;
      const last = pts[pts.length - 1];
      priceCache.set(l.symbol, { at: now, v: { symbol: l.symbol, price: last, change24h: last / pts[0] - 1 } });
    }
  }
  return want.map((l) => priceCache.get(l.symbol)?.v).filter((p): p is Price => !!p);
}

// ---------- 인증 ----------
function env(name: string) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `missing env ${name}`);
  return v;
}

const orgToken = cached(50 * 60_000, async () => {
  const keyId = env("TRUEMARKETS_KEY_ID");
  const jwk = JSON.parse(env("TRUEMARKETS_PRIVATE_JWK")) as JsonWebKey;
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign("sha256", Buffer.from(`${keyId}.${timestamp}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  const { status, body } = await tm<{ access_token?: string; message?: string }>("/v1/auth/api-key/token", {
    method: "POST",
    body: JSON.stringify({ key_id: keyId, timestamp, signature }),
  });
  if (status !== 200 || !body.access_token) throw new HttpError(502, `token ${status} ${body.message ?? ""}`);
  const claims = JSON.parse(Buffer.from(body.access_token.split(".")[1], "base64url").toString());
  return { token: body.access_token, orgId: claims.tm.organization_id as string };
});

/** 데모 사용자(지갑 비어 있음). 같은 external_ref_id 면 같은 사용자를 돌려준다 */
const demoUser = cached(24 * 3600_000, async () => {
  const { token, orgId } = await orgToken();
  for (let i = 0; i < 5; i++) {
    const { status, body } = await tm<{ user_id?: string }>(`/v1/account/organizations/${orgId}/users`, {
      method: "POST",
      token,
      body: JSON.stringify({ external_ref_id: "demo_user_1", signer_public_key: env("TRUEMARKETS_DEMO_SIGNER_PUB") }),
    });
    if ((status === 200 || status === 201) && body.user_id) return body.user_id;
    if (status !== 503) throw new HttpError(502, `user ${status}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new HttpError(502, "user not ready");
});

// ---------- 견적 ----------
type OrderResp = {
  order_id?: string;
  quote?: { qty?: string; qty_out?: string; fee?: string; issues?: string[] };
  message?: string;
};

/**
 * 실제 견적. 데모 사용자는 잔고가 0이라 주문은 만들어지지 않고(issues: Insufficient balance) 견적 값만 온다.
 * 실행(execute)은 부르지 않으므로 돈이 움직이지 않는다.
 */
export async function quote(symbol: string, side: "buy" | "sell", usd: number): Promise<TradeQuote> {
  const l = await listing(symbol);
  const expiresAt = new Date(Date.now() + 110_000).toISOString();
  const [p] = await prices([l.symbol]);
  const fallback = (): TradeQuote => {
    if (!p) throw new HttpError(502, "no price");
    const fee = usd * 0.002;
    return side === "buy"
      ? { symbol: l.symbol, side, usd, qty: (usd - fee) / p.price, price: p.price, fee, expiresAt, source: "estimate" }
      : { symbol: l.symbol, side, usd: usd - fee, qty: usd / p.price, price: p.price, fee, expiresAt, source: "estimate" };
  };
  // 팔기는 True Markets 가 보유 수량을 먼저 검사해서(422 insufficient_balance) 빈 데모 지갑으로는 견적이 안 나온다.
  // 팔 때는 현재가 기준 예상값을 쓴다(실거래 모드에서는 실제 보유분으로 견적을 받는다).
  if (side === "sell") return fallback();
  try {
    const { token } = await orgToken();
    const userId = await demoUser();
    // 살 때: USDC 금액(quote 단위)
    const body = { asset_id: l.assetId, qty: usd.toFixed(2), qty_unit: "quote", side, type: "market" };
    const { status, body: o } = await tm<OrderResp>("/v1/gateway/orders", {
      method: "POST",
      token,
      onBehalfOf: userId,
      body: JSON.stringify(body),
    });
    const q = o.quote;
    if (status >= 300 || !q?.qty_out) return fallback();
    const fee = Number(q.fee ?? 0);
    const qty = Number(q.qty_out);
    return { symbol: l.symbol, side, usd, qty, price: (usd - fee) / qty, fee, expiresAt, source: "truemarkets" };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) throw e;
    return fallback();
  }
}
