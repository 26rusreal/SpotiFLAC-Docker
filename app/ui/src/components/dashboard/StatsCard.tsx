import React from "react";
import { cn } from "../../utils/cn";

interface StatsCardProps {
  title: string;
  value: string | number;
  meta?: string;
  accent?: "green" | "blue" | "amber" | "purple";
}

const accentMap: Record<NonNullable<StatsCardProps["accent"]>, string> = {
  green: "border-emerald-400/40 text-emerald-200",
  blue: "border-sky-400/40 text-sky-200",
  amber: "border-amber-400/40 text-amber-200",
  purple: "border-fuchsia-400/40 text-fuchsia-200"
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, meta, accent }) => (
  <div className={cn("glass-card card-padding flex flex-col gap-2", accent ? accentMap[accent] : null)}>
    <span className="text-xs uppercase tracking-wide text-slate-400">{title}</span>
    <span className="text-2xl font-semibold text-slate-50">{value}</span>
    {meta ? <span className="text-sm text-slate-400">{meta}</span> : null}
  </div>
);
