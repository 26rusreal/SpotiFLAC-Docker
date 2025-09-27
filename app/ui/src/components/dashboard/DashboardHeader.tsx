import React from "react";
import { StatsCard } from "./StatsCard";

interface DashboardHeaderProps {
  queueTotal: number;
  runningCount: number;
  pendingCount: number;
  completedCount: number;
  availableStores: number;
  lastHistoryUpdate: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  queueTotal,
  runningCount,
  pendingCount,
  completedCount,
  availableStores,
  lastHistoryUpdate
}) => {
  return (
    <header className="relative w-full overflow-hidden rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-600/30 via-slate-900/90 to-slate-950 shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_120%_30%,rgba(129,140,248,0.18),transparent_60%)]" />
      <div className="relative flex flex-col gap-8 px-8 py-10 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-950/60 px-4 py-1 text-xs uppercase tracking-[0.28em] text-indigo-100/90">
            SpotiFLAC
          </span>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-slate-50">Control Hub</h1>
            <span className="text-sm text-indigo-100/70">Всего задач: {queueTotal}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-indigo-100/80">
            <span>Активно: {runningCount}</span>
            <span>В ожидании: {pendingCount}</span>
            <span>Доступные магазины: {availableStores}</span>
            {lastHistoryUpdate ? <span>Последнее обновление: {lastHistoryUpdate}</span> : null}
          </div>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <StatsCard title="Активные" value={runningCount} accent="green" meta="Задачи в работе" />
          <StatsCard title="Ожидание" value={pendingCount} accent="amber" meta="В очереди" />
          <StatsCard title="История" value={completedCount} accent="blue" meta="Завершено" />
          <StatsCard title="Магазины" value={availableStores} accent="purple" meta="Всего источников" />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
