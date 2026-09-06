import { useEffect, useState } from "react";
import { brl, type FlowPoint } from "../lib/utils";

export function FlowChart({ data }: { data: FlowPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const max = Math.max(1, ...data.map((d) => Math.max(d.rec, d.des))) * 1.08;

  const bar = (v: number, color: string, delay: number) => (
    <div
      className={`w-full max-w-[24px] rounded-t-[5px] ${color} transition-[height] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]`}
      style={{ height: mounted ? `${Math.max(2.5, (v / max) * 100)}%` : "0%", transitionDelay: `${delay}ms` }}
    />
  );

  return (
    <div>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {data.map((d, i) => (
          <div key={d.key} className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="anim-fade pointer-events-none absolute -top-1 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg bg-pine-900 px-3 py-2 text-[11px] leading-relaxed text-white shadow-[var(--shadow-pop)]">
                <p className="font-semibold capitalize">{d.label}</p>
                <p className="num text-leaf-200">▲ {brl(d.rec, 0)}</p>
                <p className="num text-coral-100">▼ {brl(d.des, 0)}</p>
              </div>
            )}
            <div className={`flex h-full items-end justify-center gap-1 rounded-lg px-1 transition-colors ${hover === i ? "bg-leaf-50" : ""}`}>
              {bar(d.rec, "bg-leaf-500", i * 55)}
              {bar(d.des, "bg-coral-600/85", i * 55 + 90)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center text-[11px] font-semibold capitalize text-ink-faint">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function GaugeArc({ pct }: { pct: number }) {
  const [drawn, setDrawn] = useState(0);
  const clamped = Math.min(100, Math.max(0, pct));
  useEffect(() => {
    const r = requestAnimationFrame(() => setDrawn(clamped));
    return () => cancelAnimationFrame(r);
  }, [clamped]);
  const C = Math.PI * 90;
  const tone = clamped >= 85 ? "#c94f42" : clamped >= 60 ? "#c98a1b" : "#1d9e71";
  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <svg viewBox="0 0 220 122" className="w-full">
        <path d="M20 110 A 90 90 0 0 1 200 110" fill="none" stroke="#e3eadf" strokeWidth="15" strokeLinecap="round" />
        <path d="M20 110 A 90 90 0 0 1 200 110" fill="none" stroke={tone} strokeWidth="15" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - drawn / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1), stroke .4s" }} />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
        <p className="num font-display text-3xl font-bold leading-none text-ink">{Math.round(drawn)}<span className="text-lg">%</span></p>
        <p className="mt-1 text-[11px] font-medium text-ink-faint">do teto anual usado</p>
      </div>
    </div>
  );
}
