"use client";
// 모든 화면에 걸쳐 쓰는 것: 언어 적용, 청산 감시·알림, 오프라인 띠, 시세 신선도, 장 상태, 현지 통화 환산, 언어 고르기
import { useEffect, useState } from "react";
import { applyHtml, displayName, LANGS, setLang, useLang, useT } from "@/i18n";
import { getFx, useAsync, useOnline, usMarketStatus } from "@/lib/client";
import { LiquidationWatcher } from "@/lib/liquidation";
import type { Position } from "@/lib/types";
import { fmtUsd } from "./format";
import { IconClose, IconGlobe } from "./icons";
import { usePerps } from "./perp";
import { Sheet } from "./Sheet";

/** layout 에 한 번: 언어를 <html> 에 반영하고, 청산 감시·알림과 오프라인 띠를 띄운다 */
export function AppChrome() {
  const lang = useLang();
  useEffect(() => {
    applyHtml(lang);
  }, [lang]);
  return (
    <>
      <LiquidationWatcher />
      <LiquidationToast />
      <OfflineBanner />
    </>
  );
}

// ---------- 지금 시각(화면이 뜬 뒤에만 값이 있다) ----------
export function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [everyMs]);
  return now;
}

/** 시세가 2분 넘게 오래됐으면 "N분 전 시세" */
export function StaleNote({ at, className = "" }: { at?: string; className?: string }) {
  const t = useT();
  const now = useNow();
  if (!at || !now) return null;
  const mins = Math.floor((now - Date.parse(at)) / 60_000);
  if (!Number.isFinite(mins) || mins < 2) return null;
  return <span className={`text-[12px] font-medium text-warn ${className}`}>{t("stale.mins", { n: mins })}</span>;
}

/** 미국 장 상태. 화면이 뜨기 전에는 null */
export function useMarket(): { open: boolean; weekend: boolean } | null {
  const now = useNow(60_000);
  if (!now) return null;
  const d = new Date(now);
  const s = usMarketStatus(d);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(d);
  return { open: s.open, weekend: day === "Sat" || day === "Sun" };
}

export function MarketChip() {
  const t = useT();
  const m = useMarket();
  if (!m) return null;
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold ${
        m.open ? "bg-ok-soft text-ok" : "bg-fill-strong text-sub"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.open ? "bg-ok" : "bg-hint"}`} aria-hidden="true" />
      {t(m.open ? "market.open" : m.weekend ? "market.weekend" : "market.closed")}
    </span>
  );
}

// ---------- 오프라인 ----------
function OfflineBanner() {
  const t = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-[480px] justify-center px-4"
      style={{ top: "calc(var(--safe-top) + 8px)" }}
      role="status"
    >
      <p className="anim-rise rounded-full bg-ink px-4 py-2 text-center text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.2)]">
        {t("offline.banner")}
      </p>
    </div>
  );
}

// ---------- 청산 알림(어느 화면에서든) ----------
function LiquidationToast() {
  const t = useT();
  const lang = useLang();
  const perps = usePerps();
  const [dead, setDead] = useState<Position[]>([]);

  useEffect(() => {
    const onLiq = (e: Event) => {
      const list = (e as CustomEvent<Position[]>).detail;
      if (Array.isArray(list) && list.length) setDead((d) => [...d, ...list]);
    };
    window.addEventListener("moduwallet:liquidated", onLiq);
    return () => window.removeEventListener("moduwallet:liquidated", onLiq);
  }, []);

  useEffect(() => {
    if (!dead.length) return;
    const id = setTimeout(() => setDead([]), 9000);
    return () => clearTimeout(id);
  }, [dead]);

  if (!dead.length) return null;
  const first = dead[0];
  const lost = dead.reduce((sum, p) => sum + p.margin, 0);
  const name = displayName(lang, perps.data?.find((m) => m.symbol === first.symbol), first.symbol);
  return (
    <div className="fixed inset-x-0 z-[60] mx-auto w-full max-w-[480px] px-4" style={{ top: "calc(var(--safe-top) + 10px)" }} role="alert">
      <div className="anim-rise flex items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <span className="text-[22px] leading-none" aria-hidden="true">
          🚨
        </span>
        <p className="min-w-0 flex-1 text-[14px] leading-snug">
          <b className="font-bold">
            {dead.length > 1
              ? t("liq.toast.many", { name, n: first.leverage, more: dead.length - 1 })
              : t("liq.toast.one", { name, n: first.leverage })}
          </b>
          <span className="block text-white/75">{t("liq.toast.body", { v: fmtUsd(lost) })}</span>
        </p>
        <button
          type="button"
          onClick={() => setDead([])}
          aria-label={t("liq.toast.close")}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <IconClose size={20} />
        </button>
      </div>
    </div>
  );
}

// ---------- 현지 통화 환산(참고용) ----------
let fxOnce: ReturnType<typeof getFx> | undefined;
function loadFx() {
  if (!fxOnce) {
    fxOnce = getFx().catch((e) => {
      fxOnce = undefined;
      throw e;
    });
  }
  return fxOnce;
}

/** 달러 금액을 지금 언어의 통화로 어림한 글자("≈ 1,336,000원"). 영어이거나 환율을 못 받았으면 빈 글자 */
export function useLocalMoney(): (usd: number) => string {
  const lang = useLang();
  const fx = useAsync(loadFx, []);
  const info = LANGS.find((l) => l.code === lang);
  const rate = info?.fx ? fx.data?.rates?.[info.fx] : undefined;
  return (usd: number) => {
    if (!info?.fx || !rate || !Number.isFinite(usd) || Math.abs(usd) < 0.005) return "";
    const v = usd * rate;
    const digits = { maximumSignificantDigits: 4, maximumFractionDigits: 0 } as const;
    if (lang === "ko") return `≈ ${new Intl.NumberFormat("ko-KR", digits).format(v)}원`;
    return `≈ ${new Intl.NumberFormat(info.locale, { style: "currency", currency: info.fx, ...digits }).format(v)}`;
  };
}

/** 회색 작은 글씨로 현지 통화 환산 */
export function LocalHint({ usd, className = "" }: { usd: number; className?: string }) {
  const money = useLocalMoney();
  const text = money(usd);
  if (!text) return null;
  return <span className={`block text-[13px] font-medium tabular-nums text-hint ${className}`}>{text}</span>;
}

// ---------- 언어 고르기 ----------
export function LangList({ onPick }: { onPick?: () => void }) {
  const lang = useLang();
  return (
    <ul className="grid grid-cols-2 gap-2">
      {LANGS.map((l) => {
        const on = l.code === lang;
        return (
          <li key={l.code}>
            <button
              type="button"
              lang={l.html}
              aria-pressed={on}
              onClick={() => {
                setLang(l.code);
                onPick?.();
              }}
              className={`press flex h-12 w-full items-center justify-center rounded-btn text-[15px] font-semibold ${
                on ? "bg-ink text-white" : "bg-fill text-sub active:bg-fill-strong"
              }`}
            >
              {l.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** 머리말의 지구본 버튼 → 언어 시트 */
export function LangButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("lang.aria")}
        className="press flex h-11 w-11 items-center justify-center rounded-full text-sub"
      >
        <IconGlobe size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={t("lang.title")}>
        {(close) => (
          <div className="px-5 pt-6">
            <h2 className="px-1 text-[20px] font-bold text-ink">{t("lang.title")}</h2>
            <div className="mt-4">
              <LangList onPick={close} />
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
