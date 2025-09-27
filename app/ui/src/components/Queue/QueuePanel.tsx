import React from "react";
import type { FileItem, HistoryItem, JobModel } from "../../types";
import QueueTable from "./QueueTable";
import HistoryAccordion from "./HistoryAccordion";

interface QueuePanelProps {
  jobs: JobModel[];
  history: HistoryItem[];
  listView: "queue" | "history";
  onListViewChange: (view: "queue" | "history") => void;
  onRefreshQueue: () => void | Promise<void>;
  onRefreshHistory: () => void | Promise<void>;
  historyLoading: boolean;
  cancelBusy: Record<string, boolean>;
  onCancel: (job: JobModel, event: React.MouseEvent<HTMLButtonElement>) => void;
  historyFiles: Record<string, FileItem[]>;
  historyFilesLoading: string | null;
  expandedHistoryId: string | null;
  onToggleHistory: (id: string) => void;
  statusLabel: (status: string) => string;
  statusColor: (status: string) => string;
  formatDate: (date: string | null) => string;
}

const QueuePanel: React.FC<QueuePanelProps> = ({
  jobs,
  history,
  listView,
  onListViewChange,
  onRefreshQueue,
  onRefreshHistory,
  historyLoading,
  cancelBusy,
  onCancel,
  historyFiles,
  historyFilesLoading,
  expandedHistoryId,
  onToggleHistory,
  statusLabel,
  statusColor,
  formatDate
}) => (
  <section className="panel panel--stretch">
    <div className="panel__head panel__head--split">
      <div>
        <h2 className="panel__title">Мониторинг задач</h2>
        <p className="panel__meta">Следите за активной очередью и завершёнными процессами.</p>
      </div>
      <div className="chip-switch">
        <button
          type="button"
          className={`chip-switch__button${listView === "queue" ? " is-active" : ""}`}
          onClick={() => onListViewChange("queue")}
        >
          Очередь
        </button>
        <button
          type="button"
          className={`chip-switch__button${listView === "history" ? " is-active" : ""}`}
          onClick={() => onListViewChange("history")}
        >
          История
        </button>
      </div>
    </div>

    <div className="panel__body">
      <div className="panel-actions">
        <button
          type="button"
          className="button button--outline"
          onClick={() =>
            void (listView === "queue" ? onRefreshQueue() : onRefreshHistory())
          }
          disabled={listView === "history" && historyLoading}
        >
          {listView === "queue"
            ? "Обновить очередь"
            : historyLoading
              ? "Обновление..."
              : "Обновить историю"}
        </button>
      </div>

      {listView === "queue" ? (
        <QueueTable
          jobs={jobs}
          cancelBusy={cancelBusy}
          onCancel={onCancel}
          statusLabel={statusLabel}
          statusColor={statusColor}
          formatDate={formatDate}
        />
      ) : (
        <HistoryAccordion
          history={history}
          expandedHistoryId={expandedHistoryId}
          onToggle={onToggleHistory}
          historyFiles={historyFiles}
          historyFilesLoading={historyFilesLoading}
          statusLabel={statusLabel}
          formatDate={formatDate}
        />
      )}
    </div>
  </section>
);

export default QueuePanel;
