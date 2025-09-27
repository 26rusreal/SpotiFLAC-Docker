import React from "react";
import type { JobModel } from "../../types";

interface QueueTableProps {
  jobs: JobModel[];
  cancelBusy: Record<string, boolean>;
  onCancel: (job: JobModel, event: React.MouseEvent<HTMLButtonElement>) => void;
  statusLabel: (status: string) => string;
  statusColor: (status: string) => string;
  formatDate: (date: string | null) => string;
}

const QueueTable: React.FC<QueueTableProps> = ({
  jobs,
  cancelBusy,
  onCancel,
  statusLabel,
  statusColor,
  formatDate
}) => (
  <div className="table-card">
    <table className="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Статус</th>
          <th>Прогресс</th>
          <th>Треки</th>
          <th>Магазин</th>
          <th>Создана</th>
          <th>Сообщение</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td className="mono">{job.id.slice(0, 8)}</td>
            <td>
              <span
                className="status-chip"
                style={{ color: statusColor(job.status) }}
              >
                <span
                  className="status-chip__dot"
                  style={{ background: statusColor(job.status) }}
                />
                {statusLabel(job.status)}
              </span>
            </td>
            <td>
              <div className="progress" aria-hidden="true">
                <span
                  style={{ width: `${Math.round(job.progress * 100)}%` }}
                  className="progress__bar"
                />
              </div>
            </td>
            <td>
              {job.completed_tracks}/{job.total_tracks}
            </td>
            <td>{job.store}</td>
            <td>{formatDate(job.created_at)}</td>
            <td>{job.message ?? job.error ?? ""}</td>
            <td>
              {job.status === "pending" || job.status === "running" ? (
                <button
                  type="button"
                  className="button button--danger button--small"
                  onClick={(event) => onCancel(job, event)}
                  disabled={cancelBusy[job.id]}
                >
                  {cancelBusy[job.id] ? "Остановка..." : "Остановить"}
                </button>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
          </tr>
        ))}
        {jobs.length === 0 && (
          <tr>
            <td colSpan={8} className="empty-cell">
              Пока нет задач
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default QueueTable;
