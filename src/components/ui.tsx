import { AnimatePresence, motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft } from "./Icons";
import { useT } from "@/i18n";
import { useBackHandler } from "@/lib/back";

type ButtonVariant = "primary" | "secondary" | "gray" | "danger" | "ghost";
type ButtonSize = "lg" | "md" | "sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-tint text-white",
  secondary: "bg-tint2 text-tint",
  gray: "bg-fill text-ink",
  danger: "bg-danger text-white",
  ghost: "bg-transparent text-tint",
};

const sizeClasses: Record<ButtonSize, string> = {
  lg: "h-14 rounded-[16px] px-6 text-[17px] font-semibold",
  md: "h-11 rounded-[13px] px-4 text-[15px] font-medium",
  sm: "h-9 rounded-[10px] px-3 text-[14px] font-medium",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "lg",
  full = false,
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${
        full ? "w-full" : ""
      } inline-flex items-center justify-center gap-2 transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] bg-card shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ${
        checked ? "bg-tint" : "bg-fill"
      }`}
    >
      <motion.span
        className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  layoutId: string;
}) {
  return (
    <div className="flex gap-[2px] rounded-[11px] bg-fill p-[2px]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="relative flex-1 rounded-[9px] px-3 py-[7px] text-[14px] font-medium"
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[9px] bg-card shadow-[0_1px_4px_rgba(0,0,0,0.14)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative z-10 ${active ? "text-ink" : "text-ink2"}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-[7px] text-[14px] font-medium transition-colors ${
        active ? "bg-tint text-white" : "bg-fill text-ink2"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={active ? "ml-1.5 opacity-80" : "ml-1.5 text-ink3"}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  display,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  label?: string;
  display?: string;
}) {
  return (
    <div>
      {(label || display) && (
        <div className="mb-2 flex items-center justify-between text-[14px]">
          <span className="text-ink2">{label}</span>
          {display && <span className="font-medium text-ink">{display}</span>}
        </div>
      )}
      <input
        type="range"
        className="ios-slider h-8 w-full cursor-pointer"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
      <motion.div
        className="h-full rounded-full bg-tint"
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 160, damping: 26 }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center px-8 py-14 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-fill text-ink2">
        {icon}
      </div>
      <h3 className="text-[19px] font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-[300px] text-[14px] leading-[1.45] text-ink2">
          {description}
        </p>
      )}
      {children && <div className="mt-6 w-full max-w-[300px]">{children}</div>}
    </motion.div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const t = useT();
  useBackHandler(open, () => {
    onClose();
    return true;
  });
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="safe-bottom fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[24px] bg-card2 no-scrollbar"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            <div className="sticky top-0 z-10 bg-card2 px-5 pt-2.5 pb-2">
              <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-ink3" />
              {title && (
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-semibold">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-[15px] font-medium text-tint"
                  >
                    {t("common.close")}
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 pb-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function NavBar({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="flex h-[52px] items-center gap-2 px-4">
        <div className="flex min-w-[64px] items-center">
          {onBack && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-tint active:bg-fill"
              aria-label="Geri"
            >
              <ChevronLeft size={26} strokeWidth={2.2} />
            </motion.button>
          )}
        </div>
        <div className="min-w-0 flex-1 text-center">
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="truncate text-[17px] font-semibold"
          >
            {title}
          </motion.h1>
          {subtitle && <p className="truncate text-[12px] text-ink2">{subtitle}</p>}
        </div>
        <div className="flex min-w-[64px] items-center justify-end">{right}</div>
      </div>
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
      {children}
    </h2>
  );
}
