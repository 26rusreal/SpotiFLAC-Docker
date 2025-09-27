import React, { useEffect, useMemo, useState } from "react";
import type { HistoryItem, JobModel } from "../../types";
import { Tabs } from "../ui/Tabs";
import { Button } from "../ui/Button";
import { QueueRow } from "./QueueRow";

interface QueueMonitorProps {
  jobs: JobModel[];
  history: HistoryItem[];
  onRefreshQueue: () => Promise<void> | void;
  onRefreshHistory: () => Promise<void> | void;
  onCancelJob?: (job: JobModel) => void;
  cancelBusy?: Record<string, boolean>;
}

const TABS = [
  { value: "queue", label: "Очередь" },
  { value: "history", label: "История" }
];

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  jobs,
  history,
  onRefreshQueue,
  onRefreshHistory,
  onCancelJob,
  cancelBusy
}) => {
  const [tab, setTab] = useState<string>("queue");

  useEffect(() => {
    const interval = window.setInterval(() => {
      void onRefreshQueue();
      void onRefreshHistory();
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [onRefreshQueue, onRefreshHistory]);

  const queueContent = useMemo(() => {
    if (jobs.length === 0) {
      return <p className="rounded-xl border border-dashed border-slate-700/40 px-4 py-12 text-center text-sm text-slate-400">Очередь пуста</p>;
    }
    return (
      <div className="space-y-3">
        {jobs.map((job) => (
          <QueueRow
            key={job.id}
            job={job}
            onCancel={onCancelJob}
            cancelling={cancelBusy?.[job.id] ?? false}
          />
        ))}
      </div>
    );
  }, [cancelBusy, jobs, onCancelJob]);

  const historyContent = useMemo(() => {
    if (history.length === 0) {
      return <p className="rounded-xl border border-dashed border-slate-700/40 px-4 py-12 text-center text-sm text-slate-400">История пуста</p>;
    }
    return (
      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.job_id}
            className="grid grid-cols-1 items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 md:grid-cols-[minmax(0,1fr)_120px_120px]"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-slate-50">{item.playlist}</span>
              <span className="text-xs text-slate-400">Всего треков: {item.total_tracks}</span>
            </div>
            <span className="text-xs text-indigo-200">{item.status === "completed" ? "Завершено" : "Ошибка"}</span>
            <span className="text-xs text-slate-300">
              Выполнено: {item.completed_tracks} · Ошибок: {item.failed_tracks}
            </span>
          </div>
        ))}
      </div>
    );
  }, [history]);

  return (
    <section className="glass-card card-padding space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Монитор очереди</h2>
          <p className="text-sm text-slate-400">Отслеживайте активные задачи и историю загрузок.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-[0]"
            onClick={() => {
              if (tab === "queue") {
                void onRefreshQueue();
              } else {
                void onRefreshHistory();
              }
            }}
          >
            Обновить
          </Button>
        </div>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List>
          {TABS.map((tabItem) => (
            <Tabs.Trigger key={tabItem.value} value={tabItem.value}>
              {tabItem.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="queue">{queueContent}</Tabs.Content>
        <Tabs.Content value="history">{historyContent}</Tabs.Content>
      </Tabs.Root>
    </section>
  );
};
