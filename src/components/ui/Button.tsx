import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ============================================================
   Button — botão padronizado do DoseCerta.
   Variantes alinhadas à paleta (pine/leaf/coral) com feedback
   tátil (btn-press), foco visível e estado de carregamento.
   ============================================================ */

export type ButtonVariant =
  | "primary" // ação principal (verde folha)
  | "dark" // ação forte secundária (pine escuro)
  | "outline" // ação neutra com contorno
  | "ghost" // ação discreta, sem contorno
  | "danger" // ação destrutiva sólida
  | "dangerSoft" // ação destrutiva suave
  | "warningSoft"; // ação de atenção (quarentena/pendência)

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Exibe um spinner e desabilita o botão enquanto verdadeiro */
  loading?: boolean;
  /** Ocupa toda a largura disponível */
  fullWidth?: boolean;
  /** Ícone à esquerda do rótulo (oculto durante loading) */
  iconLeft?: ReactNode;
  /** Ícone à direita do rótulo */
  iconRight?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-leaf-600 text-white hover:bg-leaf-700 shadow-[0_10px_24px_-10px_rgba(23,128,91,0.55)]",
  dark: "bg-pine-900 text-white hover:bg-pine-800",
  outline:
    "border border-line bg-paper text-ink-soft hover:border-leaf-200 hover:bg-leaf-50 hover:text-leaf-700",
  ghost: "text-ink-soft hover:bg-mist hover:text-ink",
  danger: "bg-coral-600 text-white hover:bg-coral-700 shadow-[0_10px_24px_-10px_rgba(201,79,66,0.5)]",
  dangerSoft:
    "border border-coral-100 bg-coral-50 text-coral-600 hover:bg-coral-100",
  warningSoft:
    "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "gap-1.5 rounded-lg px-3 py-1.5 text-[12px]",
  md: "gap-2 rounded-xl px-4 py-2.5 text-sm",
  lg: "gap-2 rounded-2xl px-5 text-[16px] min-h-[54px]",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 18 };

function Spinner({ size }: { size: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" fill="currentColor" className="opacity-90" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    iconLeft,
    iconRight,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        "btn-press inline-flex select-none items-center justify-center font-bold",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-mist",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Spinner size={ICON_SIZE[size]} />
      ) : (
        iconLeft && <span className="shrink-0">{iconLeft}</span>
      )}
      {children}
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
});

export default Button;
