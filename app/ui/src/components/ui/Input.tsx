import React from "react";
import { cn } from "../../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border bg-slate-900/70 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400",
        hasError
          ? "border-red-400/60 focus:ring-red-400/80"
          : "border-slate-700/40 focus:border-indigo-400/60",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
