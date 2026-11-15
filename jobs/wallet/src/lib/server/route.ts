import "server-only";
import { HttpError } from "./tm";

/** 라우트 공통: 오류를 JSON 으로 바꾼다 */
export async function handle<T>(fn: () => Promise<T>, cacheSeconds = 0): Promise<Response> {
  try {
    const data = await fn();
    return Response.json(data, {
      headers: cacheSeconds ? { "cache-control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}` } : {},
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error("[api]", e);
    return Response.json({ error: e instanceof Error ? e.message : "error" }, { status });
  }
}
