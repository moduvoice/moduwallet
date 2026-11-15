"use client";
// 아래에서 올라오는 바텀 시트. 바깥을 누르거나 Esc 로 닫는다.
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

function SheetInner({ onClose, label, children }: Props) {
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setClosing(true);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
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
        className={`relative max-h-[94dvh] w-full max-w-[480px] overflow-y-auto rounded-t-sheet bg-card outline-none ${
          closing ? "anim-sheet-out" : "anim-sheet-in"
        }`}
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) onClose();
        }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
}
