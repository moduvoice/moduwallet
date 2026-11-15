// moduwallet 로고: 파란 둥근 네모 안에 'm'(두 개의 언덕 = 오르는 그래프)과 동전 점 하나.

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#3182F6" />
      <path
        d="M146 362V262a55 55 0 0 1 110 0v100M256 262a55 55 0 0 1 110 0v100"
        fill="none"
        stroke="#fff"
        strokeWidth="56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="366" cy="150" r="30" fill="#BFDBFF" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2" aria-label="moduwallet">
      <LogoMark size={28} />
      <span className="text-[19px] font-extrabold tracking-[-0.03em] text-ink" aria-hidden="true">
        modu<span className="text-primary">wallet</span>
      </span>
    </span>
  );
}
