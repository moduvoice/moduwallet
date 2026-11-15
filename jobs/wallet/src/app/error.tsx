"use client"; // 오류 화면은 클라이언트 컴포넌트여야 한다

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center bg-page px-6 text-center">
      <span className="text-[44px] leading-none" aria-hidden="true">
        😵
      </span>
      <h1 className="mt-4 text-[22px] font-bold text-ink">잠깐 문제가 생겼어요</h1>
      <p className="mt-2 text-[15px] text-mute">지갑에 든 건 그대로예요. 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="press mt-7 flex h-14 w-full max-w-[280px] items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
