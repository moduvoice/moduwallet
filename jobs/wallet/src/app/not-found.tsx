import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center bg-page px-6 text-center">
      <span className="text-[44px] leading-none" aria-hidden="true">
        🧭
      </span>
      <h1 className="mt-4 text-[22px] font-bold text-ink">없는 화면이에요</h1>
      <p className="mt-2 text-[15px] text-mute">주소가 바뀌었거나 사라졌어요.</p>
      <Link
        href="/"
        className="press mt-7 flex h-14 w-full max-w-[280px] items-center justify-center rounded-btn bg-primary text-[17px] font-bold text-white"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
