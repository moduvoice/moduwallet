"use client";
// 아래에서 올라오는 바텀 시트. 바깥을 누르거나 Esc, 그리고 브라우저·폰의 '뒤로'로 닫는다.
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string; // 화면 낭독기용 이름
  children: ReactNode | ((close: () => void) => ReactNode);
};

export function Sheet(props: Props) {
  if (!props.open) return null;
  return <SheetInner {...props} />;
}

let seq = 0; // 시트마다 번호(나중에 열린 시트가 더 큰 번호)
const sheetIdOf = (state: unknown) => (state as { __sheet?: number } | null)?.__sheet ?? 0;

function SheetInner({ onClose, label, children }: Props) {
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const poppedRef = useRef(false); // '뒤로'로 닫히는 중인가
  const close = () => setClosing(true);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    // 열릴 때 기록을 하나 쌓아 둔다 → '뒤로'를 누르면 화면이 넘어가지 않고 시트만 닫힌다
    if (!idRef.current) {
      idRef.current = ++seq;
      window.history.pushState({ ...(window.history.state ?? {}), __sheet: idRef.current }, "");
    }
    const id = idRef.current;
    const onPop = (e: PopStateEvent) => {
      // 내 기록보다 아래로 내려갔을 때만 닫는다(위에 겹친 시트가 닫힌 것은 무시)
      if (sheetIdOf(e.state) < id) {
        poppedRef.current = true;
        setClosing(true);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosing(true);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 bg-black/45 ${closing ? "anim-fade-out" : "anim-fade-in"}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`sheet-panel relative w-full max-w-[480px] overflow-y-auto overflow-x-hidden rounded-t-sheet bg-card outline-none ${
          closing ? "anim-sheet-out" : "anim-sheet-in"
        }`}
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
        onAnimationEnd={(e) => {
          if (!closing || e.target !== e.currentTarget) return;
          // 버튼으로 닫았으면 쌓아 둔 기록을 되돌린다(다른 화면으로 이미 넘어갔으면 건드리지 않는다)
          if (!poppedRef.current && sheetIdOf(window.history.state) === idRef.current) window.history.back();
          onClose();
        }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
}
