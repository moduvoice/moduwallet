"use client";
// 직접 그린 선 차트(SVG). 손가락으로 문지르면 그 시점 가격을 알려 준다.
import { useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/types";

const W = 100;
const H = 100;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

type Props = {
  points: HistoryPoint[];
  color: string; // 선 색(오르면 빨강, 내리면 파랑)
  onScrub?: (p: HistoryPoint | null) => void;
  label: string;
};

export function Chart({ points, color, onScrub, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const n = points.length;
    const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p.price).toFixed(2)}`).join("");
    const area = `${line}L${W} ${H}L0 ${H}Z`;
    return { x, y, line, area, baseY: y(points[0].price) };
  }, [points]);

  const pick = (clientX: number) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const i = Math.round(ratio * (points.length - 1));
    setActive(i);
    onScrub?.(points[i]);
  };

  const leave = () => {
    setActive(null);
    onScrub?.(null);
  };

  const gid = `fill-${color.replace("#", "")}`;
  const ax = active === null ? null : geo.x(active);
  const ay = active === null ? null : geo.y(points[active].price);
  const last = points.length - 1;

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className="relative h-[200px] w-full cursor-crosshair touch-pan-y select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" || e.buttons > 0 || e.pressure > 0) pick(e.clientX);
      }}
      onPointerUp={leave}
      onPointerCancel={leave}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") leave();
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${gid})`} />
        <line
          x1="0"
          x2={W}
          y1={geo.baseY}
          y2={geo.baseY}
          stroke="#B0B8C1"
          strokeWidth="1"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={geo.line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* 끝점(지금) 또는 문지르는 지점 */}
      {ax === null || ay === null ? (
        <span
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white"
          style={{ left: `${geo.x(last)}%`, top: `${geo.y(points[last].price)}%`, background: color }}
        />
      ) : (
        <>
          <span className="pointer-events-none absolute inset-y-0 w-px bg-faint" style={{ left: `${ax}%` }} />
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white"
            style={{ left: `${ax}%`, top: `${ay}%`, background: color }}
          />
        </>
      )}
    </div>
  );
}
