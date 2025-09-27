import React from "react";
import { cn } from "../../utils/cn";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, className }) => {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-800/80", className)}>
      <div
        className="h-full bg-indigo-400 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
