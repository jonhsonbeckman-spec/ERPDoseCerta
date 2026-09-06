import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { initials } from "../lib/utils";
import type { DueStatus } from "../lib/utils";
import { IcAlert, IcCheck, IcInfo, IcX } from "./icons";

/* ---------- Toasts ---------- */
type ToastTone = "success" | "error" | "info";
interface Toast { id: number; tone: ToastTone; msg: string }
const ToastCtx = createContext<{ push: (tone: ToastTone, msg: string) => void } | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast fora do ToastProvider");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = (tone: ToastTone, msg: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, tone, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[90] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-semibold shadow-[var(--shadow-pop)] ${
              t.tone === "success" ? "border-leaf-200 bg-leaf-50 text-leaf-700"
              : t.tone === "error" ? "border-coral-100 bg-coral-50 text-coral-700"
              : "border-line bg-paper text-ink"
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {t.tone === "success" ? <IcCheck size={15} /> : t.tone === "error" ? <IcAlert size={15} /> : <IcInfo size={15} />}
            </span>
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal (folha no iPhone, centralizado no desktop) ---------- */
export function Modal({ open, onClose, title, subtitle, children, wide }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <div className="anim-fade absolute inset-0 bg-pine-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true"
        className={`modal-panel relative w-full rounded-t-3xl border-t border-line bg-paper shadow-[var(--shadow-pop)] sm:rounded-2xl sm:border ${wide ? "sm:max-w-xl" : "sm:max-w-md"} max-h-[92dvh] overflow-y-auto`}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-press rounded-lg border border-line bg-mist p-1.5 text-ink-soft hover:text-ink" aria-label="Fechar">
            <IcX size={15} />
          </button>
        </div>
        <div className="safe-bottom px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Confirmação ---------- */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirmar", danger, onClose, onConfirm }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-[13.5px] leading-relaxed text-ink-soft">{message}</div>
      <div className="mt-5 flex gap-2">
        <button onClick={onClose} className="btn-press flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-bold text-ink-soft hover:text-ink">
          Cancelar
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={`btn-press flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${danger ? "bg-coral-600 hover:bg-coral-700" : "bg-leaf-600 hover:bg-leaf-700"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Primitivos ---------- */
type BadgeTone = "leaf" | "coral" | "amber" | "neutral" | "pine";
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    leaf: "bg-leaf-100 text-leaf-700 border-leaf-200",
    coral: "bg-coral-50 text-coral-700 border-coral-100",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    neutral: "bg-mist text-ink-soft border-line",
    pine: "bg-pine-900 text-lime-400 border-pine-800",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status, days }: { status: DueStatus; days: number }) {
  if (status === "atrasado") return <Badge tone="coral">atrasada {days}d</Badge>;
  if (status === "hoje") return <Badge tone="leaf"><span className="dot-live inline-block h-1.5 w-1.5 rounded-full bg-leaf-600" /> hoje</Badge>;
  if (status === "proximo") return <Badge tone="amber">em {days}d</Badge>;
  return <Badge tone="neutral">em {days}d</Badge>;
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-mist/70 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`btn-press flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
            value === o.value ? "bg-pine-900 text-white shadow-sm" : "text-ink-soft hover:bg-paper"
          }`}>
          {o.label}
          {o.count !== undefined && <span className={`num rounded-full px-1.5 text-[10.5px] ${value === o.value ? "bg-pine-800 text-lime-400" : "bg-line-soft text-ink-faint"}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mist text-ink-faint">{icon}</span>
      <p className="font-display text-[15px] font-bold text-ink">{title}</p>
      {hint && <p className="max-w-[280px] text-[12.5px] leading-snug text-ink-faint">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

const AV_COLORS = ["bg-pine-800 text-lime-400", "bg-leaf-600 text-white", "bg-leaf-100 text-leaf-700", "bg-amber-100 text-amber-800"];
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const idx = name.length % AV_COLORS.length;
  const cls = size === "sm" ? "h-6 w-6 text-[9px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-9 w-9 text-[12px]";
  return <span className={`grid shrink-0 place-items-center rounded-full font-display font-bold ${cls} ${AV_COLORS[idx]}`}>{initials(name)}</span>;
}

export function CountUp({ value, format, className = "" }: { value: number; format: (n: number) => string; className?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 650;
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{format(v)}</span>;
}
