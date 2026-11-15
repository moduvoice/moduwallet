import "server-only";
import { HttpError } from "./tm";

// 아주 단순한 호출 제한(서버 인스턴스 메모리 기준). IP 하나당 1분에 limit 번
const hits = new Map<string, { start: number; n: number }>();

export function rateLimit(req: Request, limit = 60) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > 60_000) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 5000) hits.clear();
    return;
  }
  if (++h.n > limit) throw new HttpError(429, "잠시 후 다시 시도해 주세요");
}
