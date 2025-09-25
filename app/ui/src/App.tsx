import React, { useCallback, useEffect, useState } from "react";
import {
  createJob,
  fetchFiles,
  fetchJobLogs,
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
const DEFAULT_SINGLE_TEMPLATE = "{artist} - {album} - {track:02d} - {title}.{ext}";

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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [proxyForm, setProxyForm] = useState<ProxyFormState>(DEFAULT_PROXY_FORM);
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings | null>(null);
  const [autoTemplate, setAutoTemplate] = useState<string>(DEFAULT_BY_ARTIST_TEMPLATE);
  const [pathTemplateEdited, setPathTemplateEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobModel | null>(null);
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const updateJobList = useCallback((current: JobModel[], incoming: JobModel): JobModel[] => {
    const index = current.findIndex((item) => item.id === incoming.id);
    if (index >= 0) {
      const updated = [...current];
      updated[index] = incoming;
      return updated;
    }
    return [...current, incoming];
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const response = await fetchFiles();
      setFiles(response.files);
    } catch (err) {
      console.error(err);
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

  const applyTemplate = useCallback((template: string, force = false) => {
    setAutoTemplate(template);
    if (force || !pathTemplateEdited) {
      setForm((prev) => ({ ...prev, pathTemplate: template }));
      setPathTemplateEdited(false);
    }
  }, [pathTemplateEdited]);

  useEffect(() => {
    (async () => {
      try {
        const [prov, jobsResponse, filesResponse, settingsResponse] = await Promise.all([
          fetchProviders(),
          fetchJobs(),
          fetchFiles(),
          fetchSettings()
        ]);
        setProviders(prov);
        setJobs(sortJobs(jobsResponse.jobs));
        setFiles(filesResponse.files);
        setForm((prev) => ({
          ...prev,
          store: prov.stores[0] ?? prev.store,
          pathTemplate: prev.pathTemplate || settingsResponse.download.active_template
        }));
        setAutoTemplate(settingsResponse.download.active_template);
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
      let shouldSyncLogs = false;
      setSelectedJob((prev) => {
        if (prev && prev.id === job.id) {
          shouldSyncLogs = true;
          return job;
        }
        return prev;
      });
      if (shouldSyncLogs) {
        setJobLogs(job.logs);
      }
      if (job.status === "completed") {
        refreshFiles();
      }
    });
    return unsubscribe;
  }, [refreshFiles, updateJobList]);

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

  const handleSelectJob = async (job: JobModel) => {
    setSelectedJob(job);
    setJobLogs(job.logs);
    setLogsLoading(true);
    try {
      const logs = await fetchJobLogs(job.id);
      setJobLogs(logs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogsLoading(false);
    }
  };

  const statusLabel = (status: string) => STATUS_STYLE[status]?.label ?? status;
  const statusColor = (status: string) => STATUS_STYLE[status]?.color ?? "#cbd5f5";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>SpotiFLAC Control Center</h1>
          <p className="muted">Управляйте загрузками, сетевыми настройками и структурой файлов из одного окна.</p>
        </div>
        <div className="header-actions">
          <span className="chip">API v1</span>
        </div>
      </header>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Сетевые настройки</h2>
              <p className="muted">SOCKS5-прокси для обращения к Spotify</p>
            </div>
          </div>
          <form onSubmit={handleSaveProxy} className="panel-form">
            <div className="toggle-line">
              <label className="switch">
                <input
                  id="proxy-enabled"
                  type="checkbox"
                  checked={proxyForm.enabled}
                  onChange={handleProxyToggle}
                />
                <span>Использовать прокси</span>
              </label>
            </div>
            <div className="form-grid">
              <div>
                <label htmlFor="proxy-host">Адрес</label>
                <input
                  id="proxy-host"
                  placeholder="127.0.0.1"
                  value={proxyForm.host}
                  onChange={handleProxyField("host")}
                />
              </div>
              <div>
                <label htmlFor="proxy-port">Порт</label>
                <input
                  id="proxy-port"
                  placeholder="1080"
                  value={proxyForm.port}
                  inputMode="numeric"
                  onChange={handleProxyField("port")}
                />
              </div>
              <div>
                <label htmlFor="proxy-username">Логин</label>
                <input
                  id="proxy-username"
                  placeholder="Необязательно"
                  value={proxyForm.username}
                  onChange={handleProxyField("username")}
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="proxy-password">Пароль</label>
                <input
                  id="proxy-password"
                  type="password"
                  placeholder="Необязательно"
                  value={proxyForm.password}
                  onChange={handleProxyField("password")}
                  autoComplete="current-password"
                />
              </div>
            </div>
            <div className="panel-actions">
              <button type="submit" disabled={proxyBusy}>
                {proxyBusy ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel panel--highlight">
          <div className="panel-header">
            <div>
              <h2>Структура файлов</h2>
              <p className="muted">Выберите, как организовать загруженные треки</p>
            </div>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={downloadSettings?.mode === "by_artist" ? "active" : ""}
              onClick={() => handleDownloadModeChange("by_artist")}
            >
              По артистам
            </button>
            <button
              type="button"
              className={downloadSettings?.mode === "single_folder" ? "active" : ""}
              onClick={() => handleDownloadModeChange("single_folder")}
            >
              В одну папку
            </button>
          </div>
          <div className="template-preview">
            <span className="muted">Текущий шаблон</span>
            <code>{downloadSettings?.active_template ?? autoTemplate}</code>
            <p className="muted">Шаблон применяется ко всем новым задачам. Вы можете вручную переопределить путь при создании загрузки.</p>
          </div>
          <div className="panel-actions">
            <button type="button" className="ghost-button" onClick={handleResetTemplate}>
              Сбросить шаблон
            </button>
            <button type="button" onClick={handleSaveDownload} disabled={downloadBusy}>
              {downloadBusy ? "Сохранение..." : "Сохранить режим"}
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Новая задача</h2>
              <p className="muted">Создайте загрузку из ссылки Spotify</p>
            </div>
          </div>
          <form onSubmit={handleCreateJob} className="panel-form">
            <div className="form-grid">
              <div className="span-2">
                <label htmlFor="url">Spotify URL</label>
                <input
                  id="url"
                  placeholder="https://open.spotify.com/..."
                  value={form.url}
                  onChange={handleChange("url")}
                />
              </div>
              <div>
                <label htmlFor="store">Магазин загрузки</label>
                <select id="store" value={form.store} onChange={handleChange("store") }>
                  {(providers?.stores ?? []).map((storeOption) => (
                    <option key={storeOption} value={storeOption}>
                      {storeOption}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="quality">Качество</label>
                <input
                  id="quality"
                  placeholder="LOSSLESS / 24-bit / ..."
                  value={form.quality}
                  onChange={handleChange("quality")}
                />
              </div>
              <div className="span-2">
                <label htmlFor="template">Шаблон пути</label>
                <input
                  id="template"
                  placeholder="{artist}/{album}/{track:02d} - {title}.{ext}"
                  value={form.pathTemplate}
                  onChange={handleChange("pathTemplate")}
                />
                <p className="hint muted">Необязательно. Если оставить пустым, будет использован выбранный выше режим.</p>
              </div>
            </div>
            <div className="panel-actions">
              <button type="submit" disabled={busy}>
                {busy ? "Создание..." : "Создать задачу"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Недавние файлы</h2>
              <p className="muted">Последние результаты из каталога /downloads</p>
            </div>
          </div>
          <div className="files-list">
            {files.map((file) => (
              <div className="file-card" key={file.path}>
                <strong>{file.path}</strong>
                <span>{humanSize(file.size)} · {formatDate(file.modified_at)}</span>
              </div>
            ))}
            {files.length === 0 && <p className="muted">Файлы ещё не загружены.</p>}
          </div>
        </section>
      </div>

      <div className="grid grid--main">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Очередь</h2>
              <p className="muted">Активные и завершённые задачи</p>
            </div>
            <button type="button" className="ghost-button" onClick={refreshJobs}>
              Обновить
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Прогресс</th>
                  <th>Треки</th>
                  <th>Магазин</th>
                  <th>Создана</th>
                  <th>Сообщение</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} onClick={() => handleSelectJob(job)}>
                    <td className="mono">{job.id.slice(0, 8)}</td>
                    <td>
                      <span className="status-badge" style={{ color: statusColor(job.status) }}>
                        <span className="dot" style={{ background: statusColor(job.status) }} />
                        {statusLabel(job.status)}
                      </span>
                    </td>
                    <td>
                      <div className="progress-bar">
                        <span style={{ width: `${Math.round(job.progress * 100)}%` }} />
                      </div>
                    </td>
                    <td>{job.completed_tracks}/{job.total_tracks}</td>
                    <td>{job.store}</td>
                    <td>{formatDate(job.created_at)}</td>
                    <td>{job.message ?? job.error ?? ""}</td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-cell">Пока нет задач</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Логи</h2>
              <p className="muted">Выберите задачу, чтобы увидеть историю событий</p>
            </div>
            {selectedJob && (
              <span className="status-badge" style={{ color: statusColor(selectedJob.status) }}>
                <span className="dot" style={{ background: statusColor(selectedJob.status) }} />
                {statusLabel(selectedJob.status)}
              </span>
            )}
          </div>
          <div className="logs-box">
            {logsLoading && <p>Загрузка логов...</p>}
            {!logsLoading && selectedJob === null && <p className="muted">Выберите задачу в таблице.</p>}
            {!logsLoading && selectedJob !== null && jobLogs.length === 0 && <p className="muted">Логи отсутствуют.</p>}
            {!logsLoading &&
              jobLogs.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default App;
