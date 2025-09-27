import React from "react";
import type { FileItem, HistoryItem } from "../../types";
import { humanSize } from "../../utils/format";

interface HistoryAccordionProps {
  history: HistoryItem[];
  expandedHistoryId: string | null;
  onToggle: (id: string) => void;
  historyFiles: Record<string, FileItem[]>;
  historyFilesLoading: string | null;
  statusLabel: (status: string) => string;
  formatDate: (date: string | null) => string;
}

const HistoryAccordion: React.FC<HistoryAccordionProps> = ({
  history,
  expandedHistoryId,
  onToggle,
  historyFiles,
  historyFilesLoading,
  statusLabel,
  formatDate
}) => (
  <div className="history-accordion">
    {history.map((item) => (
      <div
        key={item.job_id}
        className={`history-entry${expandedHistoryId === item.job_id ? " is-open" : ""}`}
      >
        <button
          type="button"
          className="history-toggle"
          onClick={() => onToggle(item.job_id)}
        >
          <div className="history-toggle__info">
            <strong>{item.playlist}</strong>
            <span className="muted">
              {item.completed_tracks}/{item.total_tracks} треков
            </span>
          </div>
          <div className="history-toggle__meta">
            <span className={`status-tag status-tag--${item.status}`}>
              {statusLabel(item.status)}
            </span>
            <span className="muted">{formatDate(item.finished_at ?? item.created_at)}</span>
          </div>
        </button>
        {expandedHistoryId === item.job_id && (
          <div className="history-files">
            {historyFilesLoading === item.job_id && <p className="muted">Загрузка...</p>}
            {historyFilesLoading !== item.job_id &&
              (historyFiles[item.job_id]?.length ?? 0) === 0 && (
                <p className="muted">Нет файлов для показа</p>
              )}
            {historyFilesLoading !== item.job_id &&
              (historyFiles[item.job_id] ?? []).map((file) => (
                <div className="file-row" key={`${item.job_id}-${file.path}`}>
                  <strong>{file.path}</strong>
                  <span>{humanSize(file.size)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    ))}
    {history.length === 0 && <p className="muted empty-line">История пока пуста.</p>}
  </div>
);

export default HistoryAccordion;
