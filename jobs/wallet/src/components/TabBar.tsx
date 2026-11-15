import Link from "next/link";
import { IconChart, IconReceipt, IconWallet } from "./icons";

const TABS = [
  { key: "home", href: "/", label: "홈", Icon: IconWallet },
  { key: "stocks", href: "/stocks", label: "주식", Icon: IconChart },
  { key: "history", href: "/history", label: "내역", Icon: IconReceipt },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** 아래 탭 3개(홈 / 주식 / 내역) */
export function TabBar({ active }: { active: TabKey }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] rounded-t-[20px] border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="flex" style={{ height: "var(--tabbar-h)" }}>
        {TABS.map(({ key, href, label, Icon }) => {
          const on = key === active;
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`press flex h-full flex-col items-center justify-center gap-0.5 ${on ? "text-ink" : "text-faint"}`}
              >
                <Icon size={24} strokeWidth={on ? 2.4 : 2} />
                <span className={`text-[11px] ${on ? "font-bold text-ink" : "font-medium text-mute"}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
