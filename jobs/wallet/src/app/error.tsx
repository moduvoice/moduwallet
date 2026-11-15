"use client"; // 오류 화면은 클라이언트 컴포넌트여야 한다

import { useEffect } from "react";
import { useT } from "@/i18n";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center bg-page px-6 text-center">
      <span className="text-[44px] leading-none" aria-hidden="true">
        😵
      </span>
      <h1 className="mt-4 text-[22px] font-bold text-ink">{t("err.page.title")}</h1>
      <p className="mt-2 text-[15px] text-mute">{t("err.page.body")}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="press mt-7 flex h-14 w-full max-w-[280px] items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white"
      >
        {t("c.retry")}
      </button>
    </div>
  );
}
