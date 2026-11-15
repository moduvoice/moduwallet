"use client";
// "데모 모드" 배지. 누르면 데모가 무엇인지 솔직하게 설명하고, 지갑을 처음으로 되돌릴 수 있다.
import { useState } from "react";
import { resetDemo } from "@/lib/client";
import { Sheet } from "./Sheet";
import { btnGray, btnPrimary } from "./ui";

export function DemoBadge() {
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
        className="press -mr-2 flex h-11 items-center px-2"
        aria-label="데모 모드 안내 열기"
      >
        <span className="flex h-7 items-center gap-1.5 rounded-full bg-card px-2.5 text-[12px] font-semibold text-sub">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
          데모 모드
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="데모 모드 안내">
        {(close) => (
          <div className="px-6 pt-6">
            <h2 className="text-[22px] font-bold leading-snug text-ink">
              지금은 데모 모드예요
            </h2>
            <ul className="mt-5 space-y-4 text-[15px] leading-relaxed text-sub">
              <li className="flex gap-3">
                <span className="mt-0.5 text-[18px] leading-none" aria-hidden="true">📈</span>
                <span>
                  <b className="font-semibold text-ink">시세와 견적은 진짜예요.</b>
                  <br />
                  True Markets 에서 실시간으로 받아 와요.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-[18px] leading-none" aria-hidden="true">🧪</span>
                <span>
                  <b className="font-semibold text-ink">돈은 연습용이에요.</b>
                  <br />
                  1,000 USDC 로 시작하고, 거래는 이 기기 안에서만 기록돼요. 실제 돈은 움직이지 않아요.
                </span>
              </li>
            </ul>

            {asking ? (
              <div className="mt-7">
                <p className="mb-3 text-center text-[14px] text-mute">보유 주식과 거래 내역이 모두 지워져요.</p>
                <div className="flex gap-2">
                  <button type="button" className={btnGray} onClick={() => setAsking(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      resetDemo();
                      close();
                    }}
                  >
                    되돌리기
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-7 space-y-2">
                <button type="button" className={btnPrimary} onClick={close}>
                  확인
                </button>
                <button
                  type="button"
                  className="press flex h-12 w-full items-center justify-center text-[15px] font-semibold text-mute"
                  onClick={() => setAsking(true)}
                >
                  지갑을 처음으로 되돌리기
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
