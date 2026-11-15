"use client";
// "레버리지가 뭐예요?" 설명 시트: 카드 3장(배수 / 오르는 쪽·내리는 쪽 / 모두 잃는 선)
import Link from "next/link";
import { useState } from "react";
import { useT, type Key } from "@/i18n";
import { Sheet } from "./Sheet";
import { btnPrimary } from "./ui";

const CARDS: { title: Key; body: Key; example: Key }[] = [
  { title: "guide.1.title", body: "guide.1.body", example: "guide.1.ex" },
  { title: "guide.2.title", body: "guide.2.body", example: "guide.2.ex" },
  { title: "guide.3.title", body: "guide.3.body", example: "guide.3.ex" },
];
const MORE: Key[] = ["guide.more.1", "guide.more.2", "guide.more.3", "guide.more.4"];

export function LeverageGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} label={t("guide.aria")}>
      {(close) => <GuideBody close={close} />}
    </Sheet>
  );
}

function GuideBody({ close }: { close: () => void }) {
  const t = useT();
  const [more, setMore] = useState(false);
  return (
    <div className="px-5 pt-6">
      <h2 className="px-1 text-[22px] font-bold leading-snug text-ink">{t("guide.title")}</h2>
      <ol className="mt-5 space-y-2.5">
        {CARDS.map((c, i) => (
          <li key={c.title} className="rounded-[18px] bg-fill px-4 py-4">
            <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {t(c.title)}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-sub">{t(c.body)}</p>
            <p className="mt-2 text-[13px] font-semibold text-primary">{t(c.example)}</p>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="mt-1 flex h-11 w-full items-center justify-center text-[14px] font-semibold text-mute underline underline-offset-2"
      >
        {t(more ? "c.less" : "c.more")}
      </button>
      {more && (
        <div className="anim-rise mb-2">
          <ul className="list-disc space-y-1.5 pl-6 pr-1 text-[13px] leading-relaxed text-mute">
            {MORE.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
          <Link
            href="/terms"
            replace
            className="ml-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-primary underline underline-offset-2"
          >
            {t("risk.terms")}
          </Link>
        </div>
      )}

      <button type="button" className={`${btnPrimary} mt-2`} onClick={close}>
        {t("guide.ok")}
      </button>
    </div>
  );
}
