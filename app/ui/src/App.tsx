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
import type { AppSettings, FileItem, JobModel, ProvidersResponse } from "./types";

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

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  pending: { label: "В очереди", color: "#fbbf24" },
  running: { label: "В работе", color: "#38bdf8" },
  completed: { label: "Готово", color: "#34d399" },
  failed: { label: "Ошибка", color: "#f87171" },
  cancelled: { label: "Отменено", color: "#cbd5f5" }
};

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);
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
        setForm((prev) => ({ ...prev, store: prov.stores[0] ?? prev.store }));
        setProxyForm({
          enabled: settingsResponse.proxy.enabled,
          host: settingsResponse.proxy.host,
          port: settingsResponse.proxy.port ? String(settingsResponse.proxy.port) : "",
          username: settingsResponse.proxy.username,
          password: settingsResponse.proxy.password
        });
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
        }
      };
      const saved = await updateSettings(payload);
      setProxyForm({
        enabled: saved.proxy.enabled,
        host: saved.proxy.host,
        port: saved.proxy.port ? String(saved.proxy.port) : "",
        username: saved.proxy.username,
        password: saved.proxy.password
      });
      setMessage("Настройки сохранены");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProxyBusy(false);
    }
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
    <main>
      <header>
        <h1>SpotiFLAC Control Center</h1>
        <p style={{ color: "#94a3b8" }}>Очередь загрузок, токены и файлы в одном месте.</p>
      </header>

      {message && (
        <div className="alert">
          {message}
        </div>
      )}
      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <section>
        <header>
          <h2>Сетевые настройки</h2>
          <span style={{ color: "#64748b" }}>SOCKS5-прокси для запросов к Spotify</span>
        </header>
        <form onSubmit={handleSaveProxy}>
          <div className="checkbox-field">
            <input
              id="proxy-enabled"
              type="checkbox"
              checked={proxyForm.enabled}
              onChange={handleProxyToggle}
            />
            <label htmlFor="proxy-enabled">Использовать прокси</label>
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
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={proxyBusy}>
              {proxyBusy ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <header>
          <h2>Новая задача</h2>
          <span style={{ color: "#64748b" }}>Создайте загрузку из Spotify-ссылки</span>
        </header>
        <form onSubmit={handleCreateJob}>
          <div className="form-grid">
            <div>
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
              <select id="store" value={form.store} onChange={handleChange("store")}>
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
            <div>
              <label htmlFor="template">Шаблон пути</label>
              <input
                id="template"
                placeholder="{artist}/{album}/{track:02d} - {title}.{ext}"
                value={form.pathTemplate}
                onChange={handleChange("pathTemplate")}
              />
            </div>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={busy}>
              {busy ? "Создание..." : "Создать задачу"}
            </button>
          </div>
        </form>
      </section>


      <section>
        <header>
          <h2>Очередь</h2>
          <button type="button" onClick={refreshJobs} style={{ background: "transparent", color: "#38bdf8" }}>
            Обновить
          </button>
        </header>
        <div style={{ overflowX: "auto" }}>
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
                  <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{job.id.slice(0, 8)}</td>
                  <td>
                    <span className="status-badge" style={{ background: `${statusColor(job.status)}33`, color: statusColor(job.status) }}>
                      {statusLabel(job.status)}
                    </span>
                  </td>
                  <td style={{ width: "160px" }}>
                    <div className="progress-bar">
                      <span style={{ width: `${Math.round(job.progress * 100)}%` }} />
                    </div>
                  </td>
                  <td>
                    {job.completed_tracks}/{job.total_tracks}
                  </td>
                  <td>{job.store}</td>
                  <td>{formatDate(job.created_at)}</td>
                  <td>{job.message ?? job.error ?? ""}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                    Пока нет задач
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedJob && (
        <section>
          <header>
            <h2>Логи задачи {selectedJob.id.slice(0, 8)}</h2>
            <span style={{ color: statusColor(selectedJob.status) }}>{statusLabel(selectedJob.status)}</span>
          </header>
          <div className="logs-box">
            {logsLoading && <p>Загрузка логов...</p>}
            {!logsLoading && jobLogs.length === 0 && <p>Логи отсутствуют.</p>}
            {!logsLoading &&
              jobLogs.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
          </div>
        </section>
      )}

      <section>
        <header>
          <h2>Недавние файлы</h2>
          <span style={{ color: "#64748b" }}>Последние загрузки из каталога /downloads</span>
        </header>
        <div className="files-list">
          {files.map((file) => (
            <div className="file-card" key={file.path}>
              <strong>{file.path}</strong>
              <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.35rem" }}>
                {humanSize(file.size)} • {formatDate(file.modified_at)}
              </div>
            </div>
          ))}
          {files.length === 0 && <p style={{ color: "#64748b" }}>Файлы ещё не загружены.</p>}
        </div>
      </section>
    </main>
  );
};

export default App;
