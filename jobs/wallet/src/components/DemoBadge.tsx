"use client";
// 머리말 오른쪽 도구: 지구본(언어) + "데모 모드" 배지.
// 배지를 누르면 데모가 무엇인지 솔직하게 설명하고, 언어 · 약관 · 지갑 되돌리기를 할 수 있다(작은 설정 메뉴).
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/i18n";
import { resetDemo } from "@/lib/client";
import { LangButton, LangList } from "./chrome";
import { IconChevron } from "./icons";
import { Sheet } from "./Sheet";
import { btnGray, btnPrimary } from "./ui";

export function HeaderTools() {
  return (
    <div className="-mr-2 flex shrink-0 items-center">
      <LangButton />
      <DemoBadge />
    </div>
  );
}

export function DemoBadge() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          setOpen(true);
        }}
        className="press flex h-11 items-center px-2"
        aria-label={t("menu.open")}
      >
        <span className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-2.5 text-[12px] font-semibold text-sub">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
          {t("demo.badge")}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label={t("demo.title")}>
        {(close) => (
          <div className="px-6 pt-6">
            <h2 className="text-[22px] font-bold leading-snug text-ink">{t("demo.title")}</h2>
            <ul className="mt-5 space-y-4 text-[15px] leading-relaxed text-sub">
              <li className="flex gap-3">
                <span className="mt-0.5 text-[18px] leading-none" aria-hidden="true">
                  📈
                </span>
                <span>
                  <b className="block font-semibold text-ink">{t("demo.real.title")}</b>
                  {t("demo.real.body")}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-[18px] leading-none" aria-hidden="true">
                  🧪
                </span>
                <span>
                  <b className="block font-semibold text-ink">{t("demo.fake.title")}</b>
                  {t("demo.fake.body")}
                </span>
              </li>
            </ul>

            {asking ? (
              <div className="mt-7">
                <p className="mb-3 text-center text-[14px] text-mute">{t("demo.reset.warn")}</p>
                <div className="flex gap-2">
                  <button type="button" className={btnGray} onClick={() => setAsking(false)}>
                    {t("c.cancel")}
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      resetDemo();
                      close();
                    }}
                  >
                    {t("demo.reset.do")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="mb-2 mt-6 text-[13px] font-semibold text-mute">{t("menu.language")}</h3>
                <LangList />

                <Link
                  href="/terms"
                  replace
                  className="row-press -mx-2 mt-3 flex min-h-[48px] items-center justify-between rounded-xl px-2 text-[15px] font-semibold text-ink"
                >
                  {t("menu.terms")}
                  <IconChevron size={18} className="text-faint" />
                </Link>

                <button type="button" className={`${btnPrimary} mt-3`} onClick={close}>
                  {t("c.ok")}
                </button>
                <button
                  type="button"
                  className="press flex min-h-12 w-full items-center justify-center px-2 text-center text-[15px] font-semibold text-mute"
                  onClick={() => setAsking(true)}
                >
                  {t("demo.reset")}
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
