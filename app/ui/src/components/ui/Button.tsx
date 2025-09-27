import React from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

type ButtonSize = "default" | "sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300",
  secondary:
    "bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500",
  outline:
    "border border-slate-600 text-slate-100 hover:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-slate-500",
  ghost: "text-slate-300 hover:bg-slate-800/60"
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-10 px-4",
  sm: "h-9 px-3"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
          variantStyles[variant],
          sizeStyles[size],
          loading ? "animate-pulse" : null,
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="absolute left-4 inline-flex h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
        )}
        <span className={loading ? "opacity-90" : undefined}>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
