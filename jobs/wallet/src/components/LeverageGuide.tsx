"use client";
// "레버리지가 뭐예요?" 설명 시트: 카드 3장(배수 / 오르는 쪽·내리는 쪽 / 모두 잃는 선)
import { useState } from "react";
import { Sheet } from "./Sheet";
import { btnPrimary } from "./ui";

const CARDS = [
  {
    emoji: "✖️",
    title: "배수",
    body: "넣은 돈의 몇 배로 움직일지예요. $100을 5배로 하면 $500어치를 가진 것처럼 벌고 잃어요.",
    example: "가격이 1% 오르면 내 돈은 5% 늘어요",
  },
  {
    emoji: "↕️",
    title: "오르는 쪽 · 내리는 쪽",
    body: "오를 것 같으면 오르는 쪽(롱), 내릴 것 같으면 내리는 쪽(숏)을 골라요. 맞히면 벌고, 틀리면 잃어요.",
    example: "내리는 쪽을 고르면 가격이 내릴 때 벌어요",
  },
  {
    emoji: "🚨",
    title: "모두 잃는 선 (청산)",
    body: "가격이 반대로 이 선까지 가면 자동으로 닫히고, 넣은 돈을 모두 잃어요. 배수가 높을수록 이 선이 가까워요.",
    example: "5배는 약 17% 반대로 가면, 20배는 약 2.5%만 가도 닫혀요",
  },
];

export function LeverageGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="레버리지 설명">
      {(close) => <GuideBody close={close} />}
    </Sheet>
  );
}

function GuideBody({ close }: { close: () => void }) {
  const [more, setMore] = useState(false);
  return (
    <div className="px-5 pt-6">
      <h2 className="px-1 text-[22px] font-bold leading-snug text-ink">
        레버리지는
        <br />
        적은 돈으로 크게 움직이는 거예요
      </h2>
      <ol className="mt-5 space-y-2.5">
        {CARDS.map((c, i) => (
          <li key={c.title} className="rounded-[18px] bg-fill px-4 py-4">
            <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white" aria-hidden="true">
                {i + 1}
              </span>
              {c.title}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-sub">{c.body}</p>
            <p className="mt-2 text-[13px] font-semibold text-primary">예) {c.example}</p>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="mt-1 flex h-11 w-full items-center justify-center text-[14px] font-semibold text-mute underline underline-offset-2"
      >
        {more ? "접기" : "자세히"}
      </button>
      {more && (
        <ul className="anim-rise mb-2 list-disc space-y-1.5 pl-6 pr-1 text-[13px] leading-relaxed text-mute">
          <li>
            오래 들고 있으면 1시간마다 작은 비용(펀딩비)을 내거나 받을 수 있어요. 데모에서는 이 비용을 계산하지 않아요.
          </li>
          <li>&lsquo;무기한 선물&rsquo;이라는 상품이라서, 실제 주식이나 코인을 갖는 건 아니에요.</li>
          <li>가격은 주식 현재가와 조금 다를 수 있어요.</li>
          <li>넣은 돈보다 더 잃지는 않아요. 다만 넣은 돈 전부를 아주 빨리 잃을 수 있어요.</li>
        </ul>
      )}

      <button type="button" className={`${btnPrimary} mt-2`} onClick={close}>
        알겠어요
      </button>
    </div>
  );
}
