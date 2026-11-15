// 직접 그린 선 아이콘(24px 기준). 외부 아이콘 묶음을 쓰지 않는다.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconWallet = (p: P) => (
  <Base {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a2 2 0 0 1 2 2v1" />
    <rect x="4" y="8" width="16" height="11" rx="2.5" />
    <path d="M15.5 13.5h.01" strokeWidth={2.6} />
  </Base>
);

export const IconChart = (p: P) => (
  <Base {...p}>
    <path d="M4 16.5l4.5-5 3.5 3 6-7.5" />
    <path d="M14.5 7H18v3.5" />
    <path d="M4 20h16" />
  </Base>
);

export const IconReceipt = (p: P) => (
  <Base {...p}>
    <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z" />
    <path d="M9.5 9h5M9.5 13h5" />
  </Base>
);

export const IconPlus = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconSend = (p: P) => (
  <Base {...p}>
    <path d="M7 17L17 7" />
    <path d="M9 7h8v8" />
  </Base>
);

export const IconBag = (p: P) => (
  <Base {...p}>
    <path d="M5.5 8.5h13l-.9 10a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8z" />
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
  </Base>
);

export const IconBack = (p: P) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const IconChevron = (p: P) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);

export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Base>
);

export const IconDelete = (p: P) => (
  <Base {...p}>
    <path d="M9 5.5h9.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9L3.5 12z" />
    <path d="M12 9.5l5 5M17 9.5l-5 5" />
  </Base>
);

export const IconInfo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <path d="M12 7.8h.01" strokeWidth={2.6} />
  </Base>
);

export const IconRefresh = (p: P) => (
  <Base {...p}>
    <path d="M19 12a7 7 0 1 1-2.2-5.1" />
    <path d="M19 4.5V8h-3.5" />
  </Base>
);
