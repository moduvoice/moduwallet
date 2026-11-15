"use client";
import Link from "next/link";
import { useT, type Key } from "@/i18n";
import { IconBolt, IconChart, IconReceipt, IconWallet } from "./icons";

const TABS = [
  { key: "home", href: "/", label: "tab.home", Icon: IconWallet },
  { key: "stocks", href: "/stocks", label: "tab.stocks", Icon: IconChart },
  { key: "leverage", href: "/leverage", label: "tab.leverage", Icon: IconBolt },
  { key: "history", href: "/history", label: "tab.history", Icon: IconReceipt },
] as const satisfies readonly { key: string; href: string; label: Key; Icon: typeof IconWallet }[];

export type TabKey = (typeof TABS)[number]["key"];

/** 아래 탭 4개(홈 / 주식 / 레버리지 / 내역) */
export function TabBar({ active }: { active: TabKey }) {
  const t = useT();
  return (
    <nav
      aria-label={t("tab.aria")}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] rounded-t-[20px] border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="flex" style={{ height: "var(--tabbar-h)" }}>
        {TABS.map(({ key, href, label, Icon }) => {
          const on = key === active;
          return (
            <li key={key} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`press flex h-full flex-col items-center justify-center gap-0.5 px-1 ${on ? "text-ink" : "text-faint"}`}
              >
                <Icon size={24} strokeWidth={on ? 2.4 : 2} />
                <span className={`max-w-full truncate text-[11px] ${on ? "font-bold text-ink" : "font-medium text-mute"}`}>
                  {t(label)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
