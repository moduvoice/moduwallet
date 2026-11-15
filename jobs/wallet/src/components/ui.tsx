"use client";
// 여러 화면이 같이 쓰는 작은 부품: 화면 틀, 뼈대, 빈 상태, 오류 상태, 등락 표시, 종목 로고·줄
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Price, Stock } from "@/lib/types";
import { fmtPct, fmtUsd, stockHref, toneArrow, toneOf, toneText } from "./format";
import { IconRefresh } from "./icons";

/** 가운데 정렬된 폰 폭 화면 틀 */
export function Screen({ children, tabbar = false }: { children: ReactNode; tabbar?: boolean }) {
  return (
    <div
      className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page"
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: tabbar ? "calc(var(--tabbar-h) + var(--safe-bottom) + 20px)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-card ${className}`}>{children}</section>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />;
}

/** 목록 줄 뼈대 */
export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-11 w-11 !rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="ml-auto h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "불러오지 못했어요",
  message = "잠시 후 다시 시도해 주세요.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role="alert">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-fill text-[22px]" aria-hidden="true">
        !
      </span>
      <p className="text-[16px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-[14px] text-mute">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="press mt-4 flex h-11 items-center gap-1.5 rounded-full bg-fill px-5 text-[14px] font-semibold text-sub"
        >
          <IconRefresh size={16} />
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  message,
  action,
}: {
  emoji: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 text-[40px] leading-none" aria-hidden="true">
        {emoji}
      </span>
      <p className="text-[17px] font-bold text-ink">{title}</p>
      {message && <p className="mt-1.5 text-[14px] leading-relaxed text-mute">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** 등락률(색 + 화살표). 색만으로 구분하지 않도록 화살표를 같이 쓴다 */
export function Change({ ratio, className = "" }: { ratio: number; className?: string }) {
  const tone = toneOf(ratio);
  return (
    <span className={`tabular-nums ${toneText[tone]} ${className}`}>
      {toneArrow[tone] && (
        <span className="mr-0.5 text-[0.7em]" aria-hidden="true">
          {toneArrow[tone]}
        </span>
      )}
      {fmtPct(ratio)}
    </span>
  );
}

const AVATAR_COLORS = ["#3182F6", "#F04452", "#03B26C", "#8B5CF6", "#FF9500", "#00B8D9", "#F0619A", "#4E5968"];

function colorOf(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** 종목 로고. 그림이 없거나 못 받으면 첫 글자 동그라미 */
export function StockLogo({ symbol, icon, size = 44 }: { symbol: string; icon?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!icon || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{ width: size, height: size, background: colorOf(symbol), fontSize: size * 0.4 }}
        aria-hidden="true"
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }
  return (
    // 로고는 외부 주소라 next/image 대신 img 를 쓴다
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-fill object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/** USDC(디지털 달러) 아이콘 */
export function DollarLogo({ size = 44 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      $
    </span>
  );
}

/** 종목 한 줄(로고 · 이름 · 현재가 · 등락) */
export function StockRow({ stock, price, loading }: { stock: Stock; price?: Price; loading?: boolean }) {
  return (
    <Link href={stockHref(stock.symbol)} className="row-press flex min-h-[68px] items-center gap-3 px-5 py-3">
      <StockLogo symbol={stock.symbol} icon={stock.icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink">{(stock.nameKo ?? stock.name)}</span>
        <span className="block text-[13px] text-mute">{stock.symbol}</span>
      </span>
      <span className="shrink-0 text-right">
        {price ? (
          <>
            <span className="block text-[16px] font-semibold tabular-nums text-ink">{fmtUsd(price.price)}</span>
            <Change ratio={price.change24h} className="block text-[13px] font-medium" />
          </>
        ) : loading ? (
          <>
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="ml-auto mt-2 h-3 w-10" />
          </>
        ) : (
          <span className="text-[13px] text-hint">시세 없음</span>
        )}
      </span>
    </Link>
  );
}

/** 주식은 '주', 코인은 '개' */
export function unitOf(kind?: Stock["kind"]): string {
  return kind === "crypto" ? "개" : "주";
}

export const btnPrimary =
  "press flex h-14 w-full items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white active:bg-primary-press disabled:bg-fill-strong disabled:text-faint";
export const btnGray =
  "press flex h-14 w-full items-center justify-center rounded-btn bg-fill text-[17px] font-bold text-sub active:bg-fill-strong";
