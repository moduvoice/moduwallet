"use client";
// 주식 찾기: 검색 + 종류 칩 + 목록(서버가 준 인기순 그대로)
import { useMemo, useState } from "react";
import { useT, type Key } from "@/i18n";
import type { Stock } from "@/lib/types";
import { HeaderTools } from "../DemoBadge";
import { IconClose, IconSearch } from "../icons";
import { usePrices, useStocks } from "../market";
import { TabBar } from "../TabBar";
import { Card, EmptyState, ErrorState, RowSkeleton, Screen, StockRow } from "../ui";

type Filter = "all" | Stock["kind"];
const LABEL: Record<Filter, Key> = { all: "filter.all", stock: "filter.stock", etf: "filter.etf", crypto: "filter.crypto" };
const ORDER: Filter[] = ["all", "stock", "etf", "crypto"];

export function StocksScreen() {
  const t = useT();
  const stocks = useStocks();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const all = stocks.data;
  const symbols = useMemo(() => (all ?? []).map((s) => s.symbol), [all]);
  const { prices, loading: pricesLoading, error: pricesError, reload: reloadPrices } = usePrices(symbols);

  // 실제로 있는 종류만 칩으로 보여 준다
  const filters = useMemo(() => ORDER.filter((f) => f === "all" || (all ?? []).some((s) => s.kind === f)), [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all ?? []).filter(
      (s) =>
        (filter === "all" || s.kind === filter) &&
        (!q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || (s.nameKo ?? "").includes(q)),
    );
  }, [all, query, filter]);

  return (
    <Screen tabbar>
      <header
        className="sticky top-0 z-20 bg-page/95 px-5 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(var(--safe-top) + 6px)", marginTop: "calc(var(--safe-top) * -1)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-[24px] font-bold text-ink">{t("stocks.title")}</h1>
          <HeaderTools />
        </div>
        <div className="relative mt-2">
          <IconSearch size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-hint" />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("stocks.search.ph")}
            aria-label={t("stocks.search.aria")}
            className="h-12 w-full appearance-none rounded-btn bg-card pl-11 pr-12 text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-hint focus:ring-2 focus:ring-primary [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("stocks.search.clear")}
              className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center text-hint"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-faint text-white">
                <IconClose size={12} strokeWidth={3} />
              </span>
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5" role="group" aria-label={t("filter.aria")}>
          {filters.map((f) => {
            const on = f === filter;
            return (
              <button key={f} type="button" aria-pressed={on} onClick={() => setFilter(f)} className="press flex h-11 shrink-0 items-center">
                <span
                  className={`flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-semibold ${
                    on ? "bg-ink text-white" : "bg-card text-sub"
                  }`}
                >
                  {t(LABEL[f])}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4">
        <Card className="py-2">
          {stocks.loading && !all ? (
            <RowSkeleton rows={8} />
          ) : stocks.error && !all ? (
            <ErrorState title={t("home.stocksFail")} onRetry={stocks.reload} />
          ) : list.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title={t("stocks.empty.title")}
              message={query ? t("stocks.empty.query", { q: query.trim() }) : t("stocks.empty.kind")}
              action={
                (query || filter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                    className="press min-h-11 rounded-full bg-fill px-5 text-[14px] font-semibold text-sub"
                  >
                    {t("c.viewAll")}
                  </button>
                )
              }
            />
          ) : (
            <>
              {pricesError && (
                <p
                  className="mx-4 mb-1 mt-2 flex items-center justify-between gap-2 rounded-xl bg-fill px-3 py-1 text-[13px] text-sub"
                  role="alert"
                >
                  {t("price.fail")}
                  <button type="button" onClick={reloadPrices} className="min-h-11 shrink-0 pl-2 font-semibold text-primary">
                    {t("c.retry")}
                  </button>
                </p>
              )}
              <ul>
                {list.map((s) => (
                  <li key={s.symbol}>
                    <StockRow stock={s} price={prices[s.symbol]} loading={pricesLoading} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        {all && list.length > 0 && (
          <p className="px-2 pt-3 text-center text-[12px] text-hint">{t("stocks.count", { n: list.length })}</p>
        )}
      </main>

      <TabBar active="stocks" />
    </Screen>
  );
}
