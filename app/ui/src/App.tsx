import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  JobModel,
  ProvidersResponse
} from "./types";
import DashboardHeader from "./components/Layout/DashboardHeader";
import TaskForm, { TaskFormValues } from "./components/Forms/TaskForm";
import ProxySettings, { ProxyFormValues } from "./components/Forms/ProxySettings";
import QueuePanel from "./components/Queue/QueuePanel";
import { useDashboardStore } from "./stores/dashboardStore";
import { formatDate } from "./utils/format";

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
    return mode === "single_folder"
      ? source.single_folder_template
      : source.by_artist_template;
  }
  return mode === "single_folder" ? DEFAULT_SINGLE_TEMPLATE : DEFAULT_BY_ARTIST_TEMPLATE;
}

const spotifyUrlSchema = /^https:\/\/open\.spotify\.com\//i;

const taskSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Укажите ссылку на Spotify")
    .regex(spotifyUrlSchema, "Введите корректную ссылку Spotify"),
  provider: z.string().trim().min(1, "Выберите провайдера"),
  store: z.string().trim().min(1, "Выберите магазин"),
  quality: z
    .string()
    .max(120, "Слишком длинное значение")
    .optional()
    .or(z.literal(""))
    .transform((value) => value ?? ""),
  pathTemplate: z.string().trim().min(1, "Шаблон пути обязателен")
});

const proxySchema = z
  .object({
    enabled: z.boolean(),
    host: z.string().trim(),
    port: z.string().trim(),
    username: z.string().trim(),
    password: z.string()
  })
  .superRefine((data, ctx) => {
    if (data.enabled && data.host.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите адрес прокси",
        path: ["host"]
      });
    }
    if (data.port.length > 0) {
      if (Number.isNaN(Number(data.port))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Порт должен быть числом",
          path: ["port"]
        });
      }
    }
    if (data.enabled && data.port.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите порт прокси",
        path: ["port"]
      });
    }
  });

const App: React.FC = () => {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [historyFiles, setHistoryFiles] = useState<Record<string, FileItem[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilesLoading, setHistoryFilesLoading] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings | null>(null);
  const [autoTemplate, setAutoTemplate] = useState<string>(DEFAULT_SINGLE_TEMPLATE);
  const [pathTemplateEdited, setPathTemplateEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState<Record<string, boolean>>({});

  const { jobs, history, listView, setJobs, upsertJob, setHistory, setListView } = useDashboardStore();

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      url: "",
      provider: "spotify",
      store: "",
      quality: "",
      pathTemplate: DEFAULT_SINGLE_TEMPLATE
    }
  });

  const proxyForm = useForm<ProxyFormValues>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      enabled: false,
      host: "",
      port: "",
      username: "",
      password: ""
    }
  });

  const activeDownloadMode: DownloadMode = downloadSettings?.mode ?? "single_folder";

  const applyTemplate = useCallback(
    (template: string, force = false) => {
      setAutoTemplate(template);
      if (force || !pathTemplateEdited) {
        taskForm.setValue("pathTemplate", template, { shouldDirty: false });
        setPathTemplateEdited(false);
      }
    },
    [pathTemplateEdited, taskForm]
  );

  const buildDownloadPayload = useCallback(
    (source?: DownloadSettings | null, modeOverride?: DownloadMode, templateOverride?: string) => {
      const fallback: DownloadSettings = {
        mode: "by_artist",
        active_template: DEFAULT_BY_ARTIST_TEMPLATE,
        by_artist_template: DEFAULT_BY_ARTIST_TEMPLATE,
        single_folder_template: DEFAULT_SINGLE_TEMPLATE
      };
      const base = source ?? downloadSettings ?? fallback;
      const mode = modeOverride ?? base.mode;
      const template = templateOverride
        ? templateOverride
        : mode === "single_folder"
          ? base.single_folder_template
          : base.by_artist_template;

      return {
        ...base,
        mode,
        active_template: template,
        by_artist_template: mode === "by_artist" ? template : base.by_artist_template,
        single_folder_template: mode === "single_folder" ? template : base.single_folder_template
      };
    },
    [downloadSettings]
  );

  const handleDownloadModeChange = useCallback(
    (mode: DownloadMode) => {
      setDownloadSettings((prev) => {
        const next = buildDownloadPayload(prev, mode);
        setAutoTemplate(next.active_template);
        if (!pathTemplateEdited) {
          taskForm.setValue("pathTemplate", next.active_template, { shouldDirty: false });
          setPathTemplateEdited(false);
        }
        return next;
      });
    },
    [buildDownloadPayload, pathTemplateEdited, taskForm]
  );

  const handleResetTemplate = useCallback(() => {
    setDownloadSettings((prev) => {
      const defaults = templateForMode(activeDownloadMode);
      const next = buildDownloadPayload(prev, activeDownloadMode, defaults);
      taskForm.setValue("pathTemplate", defaults, { shouldDirty: false });
      setAutoTemplate(defaults);
      setPathTemplateEdited(false);
      return next;
    });
  }, [activeDownloadMode, buildDownloadPayload, taskForm]);

  useEffect(() => {
    const subscription = taskForm.watch((values, info) => {
      if (info.name === "pathTemplate" && values.pathTemplate !== undefined) {
        setPathTemplateEdited(values.pathTemplate.trim() !== autoTemplate.trim());
      }
    });
    return () => subscription.unsubscribe();
  }, [taskForm, autoTemplate]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timeout = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }
    const timeout = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timeout);
  }, [error]);

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
        setJobs(jobsResponse.jobs);
        setHistory(historyResponse.history);
        setHistoryFiles({});
        setExpandedHistoryId(null);
        const activeTemplate = templateForMode(
          settingsResponse.download.mode,
          settingsResponse.download
        );
        setAutoTemplate(activeTemplate);
        taskForm.reset({
          url: "",
          provider: "spotify",
          store: prov.stores[0] ?? "",
          quality: "",
          pathTemplate: activeTemplate
        });
        setPathTemplateEdited(false);
        proxyForm.reset({
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
  }, [proxyForm, setHistory, setJobs, taskForm]);

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
  }, [setHistory]);

  const refreshJobs = useCallback(async () => {
    try {
      const response = await fetchJobs();
      setJobs(response.jobs);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, [setJobs]);

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
    const unsubscribe = subscribeProgress((job) => {
      upsertJob(job);
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        void refreshHistory();
        if (expandedHistoryId === job.id) {
          void loadHistoryFiles(job.id);
        }
      }
    });
    return unsubscribe;
  }, [expandedHistoryId, loadHistoryFiles, refreshHistory, upsertJob]);

  const handleCreateJob = useCallback(
    async (values: TaskFormValues) => {
      setBusy(true);
      setError(null);
      try {
        const response = await createJob({
          provider: values.provider,
          store: values.store,
          url: values.url.trim(),
          quality: values.quality ? values.quality.trim() : null,
          path_template: values.pathTemplate.trim() || null
        });
        upsertJob(response.job);
        setMessage("Задача создана");
        taskForm.reset({
          url: "",
          provider: values.provider,
          store: values.store,
          quality: values.quality ?? "",
          pathTemplate: values.pathTemplate
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [taskForm, upsertJob]
  );

  const handleSaveProxy = useCallback(
    async (values: ProxyFormValues) => {
      setMessage(null);
      setProxyBusy(true);
      setError(null);
      const trimmedPort = values.port.trim();
      const parsedPort = trimmedPort ? Number(trimmedPort) : null;
      const templateValue = taskForm.getValues("pathTemplate").trim();
      try {
        const payload: AppSettings = {
          proxy: {
            enabled: values.enabled,
            host: values.host.trim(),
            port: parsedPort,
            username: values.username.trim(),
            password: values.password
          },
          download: buildDownloadPayload(downloadSettings, activeDownloadMode, templateValue)
        };
        const saved = await updateSettings(payload);
        proxyForm.reset({
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
    },
    [
      activeDownloadMode,
      applyTemplate,
      buildDownloadPayload,
      downloadSettings,
      proxyForm,
      taskForm
    ]
  );

  const handleSaveDownload = useCallback(async () => {
    if (!downloadSettings) {
      setError("Настройки ещё загружаются, повторите позже");
      return;
    }
    const isProxyValid = await proxyForm.trigger();
    if (!isProxyValid) {
      setError("Проверьте данные прокси перед сохранением");
      return;
    }
    setDownloadBusy(true);
    setError(null);
    try {
      const proxyValues = proxyForm.getValues();
      const trimmedPort = proxyValues.port.trim();
      const parsedPort = trimmedPort ? Number(trimmedPort) : null;
      const templateValue = taskForm.getValues("pathTemplate").trim();
      const nextSettings = buildDownloadPayload(downloadSettings, activeDownloadMode, templateValue);
      const payload: AppSettings = {
        proxy: {
          enabled: proxyValues.enabled,
          host: proxyValues.host.trim(),
          port: parsedPort,
          username: proxyValues.username.trim(),
          password: proxyValues.password
        },
        download: nextSettings
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
  }, [
    activeDownloadMode,
    applyTemplate,
    buildDownloadPayload,
    downloadSettings,
    proxyForm,
    taskForm
  ]);

  const handleCancelJob = useCallback(
    async (job: JobModel, event: React.MouseEvent<HTMLButtonElement>) => {
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

  const statusLabel = useCallback(
    (status: string) => STATUS_STYLE[status]?.label ?? status,
    []
  );
  const statusColor = useCallback(
    (status: string) => STATUS_STYLE[status]?.color ?? "#cbd5f5",
    []
  );

  const runningJobsCount = useMemo(
    () => jobs.filter((job) => job.status === "running").length,
    [jobs]
  );
  const pendingJobsCount = useMemo(
    () => jobs.filter((job) => job.status === "pending").length,
    [jobs]
  );
  const completedJobsCount = useMemo(
    () => history.filter((item) => item.status === "completed").length,
    [history]
  );
  const queueTotal = jobs.length;
  const availableStores = providers?.stores.length ?? 0;
  const lastHistoryUpdate = history[0]
    ? formatDate(history[0].finished_at ?? history[0].created_at)
    : null;

  return (
    <div className="dashboard-canvas">
      <DashboardHeader
        runningCount={runningJobsCount}
        pendingCount={pendingJobsCount}
        completedCount={completedJobsCount}
        availableStores={availableStores}
        queueTotal={queueTotal}
        lastHistoryUpdate={lastHistoryUpdate}
      />

      <main className="dashboard-stage">
        {(message || error) && (
          <div className="toast-stack">
            {message && <div className="toast toast--success">{message}</div>}
            {error && <div className="toast toast--error">{error}</div>}
          </div>
        )}

        <div className="stage-grid">
          <div className="stage-grid__main">
            <TaskForm
              providers={providers}
              busy={busy}
              downloadBusy={downloadBusy}
              onSubmit={handleCreateJob}
              onSaveDownload={handleSaveDownload}
              onModeChange={handleDownloadModeChange}
              onResetTemplate={handleResetTemplate}
              autoTemplate={autoTemplate}
              pathTemplateEdited={pathTemplateEdited}
              activeDownloadMode={activeDownloadMode}
              form={taskForm}
            />

            <QueuePanel
              jobs={jobs}
              history={history}
              listView={listView}
              onListViewChange={setListView}
              onRefreshQueue={refreshJobs}
              onRefreshHistory={refreshHistory}
              historyLoading={historyLoading}
              cancelBusy={cancelBusy}
              onCancel={handleCancelJob}
              historyFiles={historyFiles}
              historyFilesLoading={historyFilesLoading}
              expandedHistoryId={expandedHistoryId}
              onToggleHistory={handleToggleHistory}
              statusLabel={statusLabel}
              statusColor={statusColor}
              formatDate={formatDate}
            />
          </div>

          <aside className="stage-grid__sidebar">
            <ProxySettings form={proxyForm} busy={proxyBusy} onSubmit={handleSaveProxy} />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
