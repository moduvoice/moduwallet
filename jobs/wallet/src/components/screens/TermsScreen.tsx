"use client";
// 약관 · 위험 고지, 그리고 없는 화면(둘 다 글만 있는 단순한 화면)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, type Key } from "@/i18n";
import { HeaderTools } from "../DemoBadge";
import { IconBack } from "../icons";
import { Card, Screen } from "../ui";

const SECTIONS: { emoji: string; title: Key; body: Key }[] = [
  { emoji: "🧪", title: "terms.1.title", body: "terms.1.body" },
  { emoji: "📄", title: "terms.2.title", body: "terms.2.body" },
  { emoji: "🚨", title: "terms.3.title", body: "terms.3.body" },
  { emoji: "📈", title: "terms.4.title", body: "terms.4.body" },
  { emoji: "💬", title: "terms.5.title", body: "terms.5.body" },
  { emoji: "🌎", title: "terms.6.title", body: "terms.6.body" },
  { emoji: "🔒", title: "terms.7.title", body: "terms.7.body" },
];

export function TermsScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen>
      <header className="flex h-14 items-center justify-between pl-2 pr-5">
        <button
          type="button"
          aria-label={t("c.back")}
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          className="press flex h-11 w-11 items-center justify-center rounded-full text-ink"
        >
          <IconBack size={26} />
        </button>
        <HeaderTools />
      </header>

      <main className="flex flex-col gap-3 px-4 pb-10">
        <div className="px-1 pb-1">
          <h1 className="text-[24px] font-bold leading-snug text-ink">{t("terms.title")}</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-mute">{t("terms.intro")}</p>
        </div>
        {SECTIONS.map((s, i) => (
          <Card key={s.title} className="px-5 py-5">
            <h2 className="flex items-start gap-2.5 text-[16px] font-bold leading-snug text-ink">
              <span className="text-[18px] leading-snug" aria-hidden="true">
                {s.emoji}
              </span>
              <span>
                {i + 1}. {t(s.title)}
              </span>
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-sub">{t(s.body)}</p>
          </Card>
        ))}
        <Link
          href="/"
          className="press mt-2 flex h-14 w-full items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white active:bg-primary-press"
        >
          {t("c.ok")}
        </Link>
      </main>
    </Screen>
  );
}

export function NotFoundScreen() {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center bg-page px-6 text-center">
      <span className="text-[44px] leading-none" aria-hidden="true">
        🧭
      </span>
      <h1 className="mt-4 text-[22px] font-bold text-ink">{t("nf.title")}</h1>
      <p className="mt-2 text-[15px] text-mute">{t("nf.body")}</p>
      <Link
        href="/"
        className="press mt-7 flex h-14 w-full max-w-[280px] items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white"
      >
        {t("nf.cta")}
      </Link>
    </div>
  );
}
