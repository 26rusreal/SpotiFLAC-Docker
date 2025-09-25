import React, { useCallback, useEffect, useState } from "react";
import {
  cancelJob,
  createJob,
  fetchHistory,
  fetchJobFiles,
  fetchJobs,
  fetchProviders,
  fetchSettings,
  subscribeProgress,
  updateSettings
} from "./api";
import type {
  AppSettings,
  DownloadMode,
  DownloadSettings,
  FileItem,
  HistoryItem,
  JobModel,
  ProvidersResponse
} from "./types";

interface FormState {
  url: string;
  provider: string;
  store: string;
  quality: string;
  pathTemplate: string;
}

interface ProxyFormState {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
}

const DEFAULT_BY_ARTIST_TEMPLATE = "{artist}/{album}/{track:02d} - {title}.{ext}";
const DEFAULT_SINGLE_TEMPLATE = "{playlist}/{track:02d} - {artist} - {title}.{ext}";

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  pending: { label: "В очереди", color: "#60a5fa" },
  running: { label: "В работе", color: "#22d3ee" },
  completed: { label: "Готово", color: "#34d399" },
  failed: { label: "Ошибка", color: "#f87171" },
  cancelled: { label: "Отменено", color: "#cbd5f5" }
};

function templateForMode(mode: DownloadMode, settings?: DownloadSettings | null): string {
  const source = settings ?? null;
  if (source) {
    return mode === "single_folder" ? source.single_folder_template : source.by_artist_template;
  }
  return mode === "single_folder" ? DEFAULT_SINGLE_TEMPLATE : DEFAULT_BY_ARTIST_TEMPLATE;
}

function formatDate(date: string | null): string {
  if (!date) {
    return "—";
  }
  return new Date(date).toLocaleString("ru-RU");
}

function humanSize(size: number): string {
  if (size < 1024) {
    return `${size} Б`;
  }
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function sortJobs(jobs: JobModel[]): JobModel[] {
  return [...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

const DEFAULT_FORM: FormState = {
  url: "",
  provider: "spotify",
  store: "",
  quality: "",
  pathTemplate: ""
};

const DEFAULT_PROXY_FORM: ProxyFormState = {
  enabled: false,
  host: "",
  port: "",
  username: "",
  password: ""
};

const App: React.FC = () => {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [jobs, setJobs] = useState<JobModel[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyFiles, setHistoryFiles] = useState<Record<string, FileItem[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilesLoading, setHistoryFilesLoading] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [proxyForm, setProxyForm] = useState<ProxyFormState>(DEFAULT_PROXY_FORM);
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings | null>(null);
  const [autoTemplate, setAutoTemplate] = useState<string>(DEFAULT_SINGLE_TEMPLATE);
  const [pathTemplateEdited, setPathTemplateEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [listView, setListView] = useState<"queue" | "history">("queue");
  const [cancelBusy, setCancelBusy] = useState<Record<string, boolean>>({});

  const updateJobList = useCallback((current: JobModel[], incoming: JobModel): JobModel[] => {
    const index = current.findIndex((item) => item.id === incoming.id);
    if (index >= 0) {
      const updated = [...current];
      updated[index] = incoming;
      return updated;
    }
    return [...current, incoming];
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetchHistory();
      const ids = new Set(response.history.map((item) => item.job_id));
      setHistory(response.history);
      setHistoryFiles((prev) => {
        const next: Record<string, FileItem[]> = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (ids.has(key)) {
            next[key] = value;
          }
        });
        return next;
      });
      setExpandedHistoryId((prev) => (prev && ids.has(prev) ? prev : null));
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const response = await fetchJobs();
      setJobs(sortJobs(response.jobs));
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, []);

  const loadHistoryFiles = useCallback(
    async (jobId: string) => {
      setHistoryFilesLoading(jobId);
      try {
        const response = await fetchJobFiles(jobId);
        setHistoryFiles((prev) => ({ ...prev, [jobId]: response.files }));
      } catch (err) {
        console.error(err);
        setError((err as Error).message);
      } finally {
        setHistoryFilesLoading(null);
      }
    },
    []
  );

  const applyTemplate = useCallback((template: string, force = false) => {
    setAutoTemplate(template);
    if (force || !pathTemplateEdited) {
      setForm((prev) => ({ ...prev, pathTemplate: template }));
      setPathTemplateEdited(false);
    }
  }, [pathTemplateEdited]);

  const handleToggleHistory = useCallback(
    (jobId: string) => {
      if (expandedHistoryId !== jobId && !historyFiles[jobId]) {
        void loadHistoryFiles(jobId);
      }
      setExpandedHistoryId((prev) => (prev === jobId ? null : jobId));
    },
    [expandedHistoryId, historyFiles, loadHistoryFiles]
  );

  useEffect(() => {
    (async () => {
      try {
        const [prov, jobsResponse, historyResponse, settingsResponse] = await Promise.all([
          fetchProviders(),
          fetchJobs(),
          fetchHistory(),
          fetchSettings()
        ]);
        setProviders(prov);
        setJobs(sortJobs(jobsResponse.jobs));
        setHistory(historyResponse.history);
        setHistoryFiles({});
        setExpandedHistoryId(null);
        const activeTemplate = templateForMode(
          settingsResponse.download.mode,
          settingsResponse.download
        );
        setForm((prev) => ({
          ...prev,
          store: prov.stores[0] ?? prev.store,
          pathTemplate: prev.pathTemplate || activeTemplate
        }));
        setAutoTemplate(activeTemplate);
        setPathTemplateEdited(false);
        setProxyForm({
          enabled: settingsResponse.proxy.enabled,
          host: settingsResponse.proxy.host,
          port: settingsResponse.proxy.port ? String(settingsResponse.proxy.port) : "",
          username: settingsResponse.proxy.username,
          password: settingsResponse.proxy.password
        });
        setDownloadSettings(settingsResponse.download);
      } catch (err) {
        console.error(err);
        setError((err as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeProgress((job) => {
      setJobs((prev) => sortJobs(updateJobList(prev, job)));
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        void refreshHistory();
        if (expandedHistoryId === job.id) {
          void loadHistoryFiles(job.id);
        }
      }
    });
    return unsubscribe;
  }, [expandedHistoryId, loadHistoryFiles, refreshHistory, updateJobList]);

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    if (field === "pathTemplate") {
      setPathTemplateEdited(value !== autoTemplate);
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProxyField = (field: keyof ProxyFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setProxyForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProxyToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setProxyForm((prev) => ({ ...prev, enabled: checked }));
  };

  const buildDownloadPayload = useCallback(
    (source?: DownloadSettings | null): DownloadSettings => {
      const base = source ?? downloadSettings ?? {
        mode: "by_artist",
        active_template: DEFAULT_BY_ARTIST_TEMPLATE,
        by_artist_template: DEFAULT_BY_ARTIST_TEMPLATE,
        single_folder_template: DEFAULT_SINGLE_TEMPLATE
      };
      const active = templateForMode(base.mode, base);
      return {
        ...base,
        active_template: active
      };
    },
    [downloadSettings]
  );

  const handleSaveProxy = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const trimmedHost = proxyForm.host.trim();
    const trimmedPort = proxyForm.port.trim();

    if (proxyForm.enabled) {
      if (!trimmedHost) {
        setError("Укажите адрес прокси");
        return;
      }
      if (!trimmedPort) {
        setError("Укажите порт прокси");
        return;
      }
    }

    if (trimmedPort && Number.isNaN(Number(trimmedPort))) {
      setError("Порт должен быть числом");
      return;
    }

    const parsedPort = trimmedPort ? Number(trimmedPort) : null;

    setProxyBusy(true);
    setError(null);
    try {
      const payload: AppSettings = {
        proxy: {
          enabled: proxyForm.enabled,
          host: trimmedHost,
          port: parsedPort,
          username: proxyForm.username,
          password: proxyForm.password
        },
        download: buildDownloadPayload()
      };
      const saved = await updateSettings(payload);
      setProxyForm({
        enabled: saved.proxy.enabled,
        host: saved.proxy.host,
        port: saved.proxy.port ? String(saved.proxy.port) : "",
        username: saved.proxy.username,
        password: saved.proxy.password
      });
      setDownloadSettings(saved.download);
      applyTemplate(saved.download.active_template, true);
      setMessage("Настройки сохранены");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProxyBusy(false);
    }
  };

  const handleSaveDownload = async () => {
    if (!downloadSettings) {
      setError("Настройки ещё загружаются, повторите позже");
      return;
    }
    const trimmedPort = proxyForm.port.trim();
    if (trimmedPort && Number.isNaN(Number(trimmedPort))) {
      setError("Порт должен быть числом");
      return;
    }
    const parsedPort = trimmedPort ? Number(trimmedPort) : null;
    setDownloadBusy(true);
    setError(null);
    try {
      const payload: AppSettings = {
        proxy: {
          enabled: proxyForm.enabled,
          host: proxyForm.host.trim(),
          port: parsedPort,
          username: proxyForm.username,
          password: proxyForm.password
        },
        download: buildDownloadPayload(downloadSettings)
      };
      const saved = await updateSettings(payload);
      setDownloadSettings(saved.download);
      applyTemplate(saved.download.active_template, true);
      setMessage("Настройки сохранены");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadBusy(false);
    }
  };

  const handleDownloadModeChange = (mode: DownloadMode) => {
    setDownloadSettings((prev) => {
      const next: DownloadSettings = prev
        ? {
            ...prev,
            mode,
            active_template: templateForMode(mode, prev)
          }
        : {
            mode,
            active_template: templateForMode(mode),
            by_artist_template: DEFAULT_BY_ARTIST_TEMPLATE,
            single_folder_template: DEFAULT_SINGLE_TEMPLATE
          };
      setAutoTemplate(next.active_template);
      if (!pathTemplateEdited) {
        setForm((prevForm) => ({ ...prevForm, pathTemplate: next.active_template }));
      }
      return next;
    });
  };

  const handleResetTemplate = () => {
    setDownloadSettings((prev) => {
      const next = buildDownloadPayload(prev);
      setAutoTemplate(next.active_template);
      setForm((prevForm) => ({ ...prevForm, pathTemplate: next.active_template }));
      setPathTemplateEdited(false);
      return next;
    });
  };

  const handleCreateJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.url) {
      setError("Укажите ссылку на источник Spotify");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await createJob({
        provider: form.provider,
        store: form.store,
        url: form.url,
        quality: form.quality || null,
        path_template: form.pathTemplate || null
      });
      setJobs((prev) => sortJobs(updateJobList(prev, response.job)));
      setMessage("Задача создана");
      setForm((prev) => ({ ...prev, url: "" }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelJob = useCallback(
    async (job: JobModel, event: React.MouseEvent) => {
      event.stopPropagation();
      if (job.status !== "running" && job.status !== "pending") {
        return;
      }
      setCancelBusy((prev) => ({ ...prev, [job.id]: true }));
      setError(null);
      try {
        await cancelJob(job.id);
        setMessage("Остановка запрошена");
        await refreshJobs();
        await refreshHistory();
        if (expandedHistoryId === job.id) {
          await loadHistoryFiles(job.id);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setCancelBusy((prev) => ({ ...prev, [job.id]: false }));
      }
    },
    [expandedHistoryId, loadHistoryFiles, refreshHistory, refreshJobs]
  );

  const statusLabel = (status: string) => STATUS_STYLE[status]?.label ?? status;
  const statusColor = (status: string) => STATUS_STYLE[status]?.color ?? "#cbd5f5";
  const activeDownloadMode: DownloadMode = downloadSettings?.mode ?? "single_folder";
  const currentTemplate = downloadSettings?.active_template ?? autoTemplate;

  const runningJobsCount = jobs.filter((job) => job.status === "running").length;
  const pendingJobsCount = jobs.filter((job) => job.status === "pending").length;
  const completedJobsCount = history.filter((item) => item.status === "completed").length;
  const queueTotal = jobs.length;
  const availableStores = providers?.stores.length ?? 0;
  const lastHistoryUpdate = history[0]
    ? formatDate(history[0].finished_at ?? history[0].created_at)
    : null;

  return (
    <div className="ui-canvas">
      <header className="ui-masthead">
        <div className="ui-masthead__inner">
          <div className="ui-masthead__text">
            <span className="masthead-badge">Центр загрузок</span>
            <h1>SpotiFLAC Control Hub</h1>
            <p>
              Обновлённый интерфейс объединяет создание задач, контроль очереди и
              сетевые настройки в единую композицию. Всё расположено логично и не
              перекрывается даже на небольших экранах.
            </p>
            <div className="masthead-meta">
              <span>
                Очередь: {queueTotal > 0 ? `${queueTotal} задач` : "нет активных задач"}
              </span>
              <span>
                {lastHistoryUpdate
                  ? `Последнее завершение: ${lastHistoryUpdate}`
                  : "История ещё не формировалась"}
              </span>
            </div>
          </div>
          <div className="overview-grid">
            <article className="overview-card">
              <span className="overview-card__label">Активные задачи</span>
              <strong>{runningJobsCount}</strong>
              <span className="overview-card__meta">сейчас выполняются</span>
            </article>
            <article className="overview-card">
              <span className="overview-card__label">В ожидании</span>
              <strong>{pendingJobsCount}</strong>
              <span className="overview-card__meta">стоят в очереди</span>
            </article>
            <article className="overview-card">
              <span className="overview-card__label">Завершено</span>
              <strong>{completedJobsCount}</strong>
              <span className="overview-card__meta">успешно обработано</span>
            </article>
            <article className="overview-card">
              <span className="overview-card__label">Источники</span>
              <strong>{availableStores}</strong>
              <span className="overview-card__meta">доступных магазина</span>
            </article>
          </div>
        </div>
      </header>

      <main className="ui-stage">
        {(message || error) && (
          <div className="alert-stack">
            {message && <div className="alert alert--success">{message}</div>}
            {error && <div className="alert alert--error">{error}</div>}
          </div>
        )}

        <div className="ui-grid">
          <div className="ui-grid__primary">
            <section className="surface surface--form">
              <div className="surface__header">
                <div>
                  <h2 className="surface__title">Новая задача</h2>
                  <p className="surface__meta">
                    Вставьте ссылку Spotify и настройте структуру каталогов перед запуском.
                  </p>
                </div>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-control__option${
                      activeDownloadMode === "by_artist" ? " is-active" : ""
                    }`}
                    onClick={() => handleDownloadModeChange("by_artist")}
                  >
                    По артистам
                  </button>
                  <button
                    type="button"
                    className={`segmented-control__option${
                      activeDownloadMode === "single_folder" ? " is-active" : ""
                    }`}
                    onClick={() => handleDownloadModeChange("single_folder")}
                  >
                    В одну папку
                  </button>
                </div>
              </div>
              <form onSubmit={handleCreateJob} className="form-grid">
                <label className="form-field form-field--wide" htmlFor="url">
                  <span>Spotify URL</span>
                  <input
                    id="url"
                    placeholder="https://open.spotify.com/..."
                    value={form.url}
                    onChange={handleChange("url")}
                  />
                </label>
                <label className="form-field" htmlFor="store">
                  <span>Магазин</span>
                  <div className="select-with-logo">
                    <select id="store" value={form.store} onChange={handleChange("store")}>
                      {(providers?.stores ?? []).map((storeOption) => (
                        <option key={storeOption} value={storeOption}>
                          {storeOption}
                        </option>
                      ))}
                    </select>
                    {form.store && (
                      <img
                        src={`/assets/${form.store}.png`}
                        alt={`${form.store} логотип`}
                        className="select-with-logo__image"
                      />
                    )}
                  </div>
                </label>
                <label className="form-field" htmlFor="quality">
                  <span>Качество</span>
                  <input
                    id="quality"
                    placeholder="LOSSLESS / 24-bit / ..."
                    value={form.quality}
                    onChange={handleChange("quality")}
                  />
                </label>
                <label className="form-field form-field--wide" htmlFor="template">
                  <span>Шаблон пути</span>
                  <input
                    id="template"
                    placeholder="{artist}/{album}/{track:02d} - {title}.{ext}"
                    value={form.pathTemplate}
                    onChange={handleChange("pathTemplate")}
                  />
                  <small className="form-hint">
                    Активный шаблон: {currentTemplate}. Оставьте поле пустым, чтобы применить его автоматически.
                  </small>
                </label>
                <div className="form-actions form-actions--split">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={handleResetTemplate}
                  >
                    Сбросить шаблон
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={handleSaveDownload}
                    disabled={downloadBusy}
                  >
                    {downloadBusy ? "Сохранение..." : "Сохранить структуру"}
                  </button>
                </div>
                <div className="form-actions form-actions--column">
                  <button
                    type="submit"
                    className="button button--accent button--large"
                    disabled={busy}
                  >
                    {busy ? "Создание..." : "Создать задачу"}
                  </button>
                </div>
              </form>
            </section>

            <section className="surface surface--list">
              <div className="surface__header">
                <div>
                  <h2 className="surface__title">
                    {listView === "queue" ? "Очередь" : "История загрузок"}
                  </h2>
                  <p className="surface__meta">
                    {listView === "queue"
                      ? "Следите за текущими задачами и при необходимости останавливайте их."
                      : "Разворачивайте записи, чтобы увидеть файлы и детали завершённых загрузок."}
                  </p>
                </div>
                <div className="surface__actions">
                  <div className="segmented-control segmented-control--compact">
                    <button
                      type="button"
                      className={`segmented-control__option${
                        listView === "queue" ? " is-active" : ""
                      }`}
                      onClick={() => setListView("queue")}
                    >
                      Очередь
                    </button>
                    <button
                      type="button"
                      className={`segmented-control__option${
                        listView === "history" ? " is-active" : ""
                      }`}
                      onClick={() => setListView("history")}
                    >
                      История
                    </button>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      if (listView === "queue") {
                        void refreshJobs();
                      } else {
                        void refreshHistory();
                      }
                    }}
                    disabled={listView === "history" && historyLoading}
                  >
                    {listView === "queue"
                      ? "Обновить очередь"
                      : historyLoading
                        ? "Обновление..."
                        : "Обновить историю"}
                  </button>
                </div>
              </div>

              {listView === "queue" ? (
                <div className="table-wrap">
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
                            <span className="status-chip" style={{ color: statusColor(job.status) }}>
                              <span className="status-chip__dot" style={{ background: statusColor(job.status) }} />
                              {statusLabel(job.status)}
                            </span>
                          </td>
                          <td>
                            <div className="progress">
                              <span style={{ width: `${Math.round(job.progress * 100)}%` }} />
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
                                onClick={(event) => handleCancelJob(job, event)}
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
              ) : (
                <div className="history-accordion">
                  {historyLoading && history.length === 0 && (
                    <p className="muted">Загрузка истории...</p>
                  )}
                  {history.map((item) => (
                    <div
                      key={item.job_id}
                      className={`history-entry${expandedHistoryId === item.job_id ? " is-open" : ""}`}
                    >
                      <button
                        type="button"
                        className="history-toggle"
                        onClick={() => handleToggleHistory(item.job_id)}
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
                  {history.length === 0 && !historyLoading && (
                    <p className="muted empty-line">История пока пуста.</p>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="ui-grid__secondary">
            <section className="surface surface--settings">
              <div className="surface__header">
                <div>
                  <h2 className="surface__title">Сеть и прокси</h2>
                  <p className="surface__meta">Настройте подключение, если для доступа требуется прокси.</p>
                </div>
              </div>
              <form onSubmit={handleSaveProxy} className="stack">
                <div className="form-actions form-actions--space">
                  <label className="switch-control" htmlFor="proxy-enabled">
                    <input
                      id="proxy-enabled"
                      type="checkbox"
                      checked={proxyForm.enabled}
                      onChange={handleProxyToggle}
                    />
                    <span>Использовать прокси</span>
                  </label>
                  <button type="submit" className="button button--primary button--small" disabled={proxyBusy}>
                    {proxyBusy ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
                <div className="proxy-grid">
                  <label className="form-field" htmlFor="proxy-host">
                    <span>Адрес</span>
                    <input
                      id="proxy-host"
                      placeholder="127.0.0.1"
                      value={proxyForm.host}
                      onChange={handleProxyField("host")}
                    />
                  </label>
                  <label className="form-field" htmlFor="proxy-port">
                    <span>Порт</span>
                    <input
                      id="proxy-port"
                      placeholder="1080"
                      value={proxyForm.port}
                      inputMode="numeric"
                      onChange={handleProxyField("port")}
                    />
                  </label>
                  <label className="form-field" htmlFor="proxy-username">
                    <span>Логин</span>
                    <input
                      id="proxy-username"
                      placeholder="Необязательно"
                      value={proxyForm.username}
                      onChange={handleProxyField("username")}
                      autoComplete="username"
                    />
                  </label>
                  <label className="form-field" htmlFor="proxy-password">
                    <span>Пароль</span>
                    <input
                      id="proxy-password"
                      type="password"
                      placeholder="Необязательно"
                      value={proxyForm.password}
                      onChange={handleProxyField("password")}
                      autoComplete="current-password"
                    />
                  </label>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
