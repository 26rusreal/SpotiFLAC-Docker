import { motion } from "framer-motion";
import React from "react";
import type { JobModel } from "../../types";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";

interface QueueRowProps {
  job: JobModel;
  onCancel?: (job: JobModel) => void;
  cancelling?: boolean;
}

function progressLabel(job: JobModel): string {
  if (job.status === "pending") {
    return "Ожидание";
  }
  if (job.status === "completed") {
    return "100%";
  }
  return `${Math.round(job.progress)}%`;
}

function etaLabel(job: JobModel): string {
  if (job.total_tracks === 0) {
    return "—";
  }
  const remaining = Math.max(job.total_tracks - job.completed_tracks, 0);
  if (remaining === 0) {
    return "Готово";
  }
  return `≈ ${remaining} треков`;
}

export const QueueRow: React.FC<QueueRowProps> = ({ job, onCancel, cancelling = false }) => {
  const isActionable = job.status === "running" || job.status === "pending";
  const statusText = job.status === "running" ? "В работе" : job.status === "pending" ? "В ожидании" : "Завершено";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 md:grid-cols-[minmax(0,1fr)_120px_30%_120px_80px]"
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium text-slate-50">{job.collection_name ?? job.source_url}</span>
        <span className="text-xs text-slate-400">
          {job.store.toUpperCase()} · {job.quality ?? "качество не указано"}
        </span>
      </div>
      <div className="text-xs font-medium text-indigo-200">{statusText}</div>
      <div className="w-full">
        <ProgressBar value={job.progress} className="w-full" />
        <span className="mt-1 block text-xs text-slate-400">{progressLabel(job)}</span>
      </div>
      <div className="text-xs text-slate-300">{etaLabel(job)}</div>
      <div className="flex items-center justify-end gap-2">
        {job.message ? (
          <span
            className="text-lg"
            role="img"
            aria-label="Комментарий"
            title={job.message}
          >
            💬
          </span>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-[0]"
            onClick={() => onCancel(job)}
            loading={cancelling}
            disabled={!isActionable}
          >
            Отмена
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
};
