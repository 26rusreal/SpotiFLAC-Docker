import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import TaskForm, { ProxyFormValues, TaskFormValues } from "./components/forms/TaskForm";
import { QueueMonitor } from "./components/queue/QueueMonitor";
import { Toaster } from "./components/notifications/Toaster";
import { useTaskStore } from "./store/useTaskStore";
import { cancelJob, createJob, subscribeProgress } from "./api";
import type { JobModel } from "./types";

const DEFAULT_TEMPLATE = "{artist}/{album}/{track:02d} - {title}.{ext}";

const taskSchema = z.object({
  url: z
    .string({ required_error: "Укажите ссылку" })
    .trim()
    .min(1, "Укажите ссылку")
    .url("Введите корректный URL"),
  store: z.enum(["qobuz", "bandcamp", "deezer"]),
  quality: z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined)),
  pathTemplate: z.string().trim().min(1, "Шаблон обязателен")
});

const proxySchema = z
  .object({
    enabled: z.boolean(),
    host: z.string().trim(),
    port: z.number().nullable(),
    username: z
      .string()
      .optional()
      .transform((value) => (value?.trim() ? value.trim() : "")),
    password: z
      .string()
      .optional()
      .transform((value) => (value?.trim() ? value.trim() : ""))
  })
  .superRefine((data, ctx) => {
    if (data.enabled && data.host.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите адрес",
        path: ["host"]
      });
    }
    if (data.enabled && (data.port === null || Number.isNaN(data.port))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите порт",
        path: ["port"]
      });
    }
    if (data.port !== null && !Number.isNaN(data.port) && data.port <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Порт должен быть положительным",
        path: ["port"]
      });
    }
  });

const App: React.FC = () => {
  const tasks = useTaskStore((state) => state.tasks);
  const history = useTaskStore((state) => state.history);
  const fetchQueue = useTaskStore((state) => state.fetchQueue);
  const fetchHistory = useTaskStore((state) => state.fetchHistory);
  const fetchSettings = useTaskStore((state) => state.fetchSettings);
  const updateTaskProgress = useTaskStore((state) => state.updateTaskProgress);
  const pathTemplate = useTaskStore((state) => state.pathTemplate);
  const setPathTemplate = useTaskStore((state) => state.setPathTemplate);
  const proxyState = useTaskStore((state) => state.proxy);
  const setProxy = useTaskStore((state) => state.setProxy);
  const toggleProxy = useTaskStore((state) => state.toggleProxy);
  const saveProxy = useTaskStore((state) => state.saveProxy);

  const [initialTemplate, setInitialTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [initializing, setInitializing] = useState(true);
  const [creating, setCreating] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState<Record<string, boolean>>({});
  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      url: "",
      store: "qobuz",
      quality: "",
      pathTemplate: pathTemplate || DEFAULT_TEMPLATE
    }
  });

  const proxyForm = useForm<ProxyFormValues>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      enabled: proxyState.enabled,
      host: proxyState.host,
      port: proxyState.port,
      username: proxyState.username,
      password: proxyState.password
    }
  });

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchSettings(), fetchQueue(), fetchHistory()]);
        const state = useTaskStore.getState();
        const template = state.pathTemplate || DEFAULT_TEMPLATE;
        setInitialTemplate(template);
        taskForm.reset({
          url: "",
          store: "qobuz",
          quality: "",
          pathTemplate: template
        });
        proxyForm.reset({
          enabled: state.proxy.enabled,
          host: state.proxy.host,
          port: state.proxy.port,
          username: state.proxy.username,
          password: state.proxy.password
        });
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setInitializing(false);
      }
    })();
  }, [fetchHistory, fetchQueue, fetchSettings, proxyForm, taskForm]);

  useEffect(() => {
    if (!pathTemplate) {
      return;
    }
    const fieldState = taskForm.getFieldState("pathTemplate");
    const currentValue = taskForm.getValues("pathTemplate");
    if (!fieldState.isDirty && currentValue !== pathTemplate) {
      taskForm.setValue("pathTemplate", pathTemplate, { shouldDirty: false });
    }
  }, [pathTemplate, taskForm]);

  useEffect(() => {
    proxyForm.reset({
      enabled: proxyState.enabled,
      host: proxyState.host,
      port: proxyState.port,
      username: proxyState.username,
      password: proxyState.password
    });
  }, [proxyForm, proxyState]);

  useEffect(() => {
    const subscription = proxyForm.watch((value, info) => {
      if (info.name === "enabled") {
        toggleProxy(Boolean(value.enabled));
      }
    });
    return () => subscription.unsubscribe();
  }, [proxyForm, toggleProxy]);

  useEffect(() => {
    const unsubscribe = subscribeProgress((job) => {
      updateTaskProgress(job.id, job.progress, job);
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        void fetchQueue();
        void fetchHistory();
      }
    });
    return unsubscribe;
  }, [fetchHistory, fetchQueue, updateTaskProgress]);

  const handleCreateTask = async (values: TaskFormValues) => {
    setCreating(true);
    try {
      const payload = {
        store: values.store,
        url: values.url.trim(),
        quality: values.quality?.trim() || undefined,
        path_template: values.pathTemplate.trim()
      };
      await createJob(payload);
      setPathTemplate(values.pathTemplate.trim());
      toast.success("Задача создана");
      taskForm.reset({
        url: "",
        store: values.store,
        quality: values.quality ?? "",
        pathTemplate: values.pathTemplate
      });
      await fetchQueue();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleResetTemplate = () => {
    const template = initialTemplate || DEFAULT_TEMPLATE;
    setPathTemplate(template);
    taskForm.setValue("pathTemplate", template, { shouldDirty: false });
  };

  const handleProxySubmit = async (values: ProxyFormValues) => {
    setProxyBusy(true);
    try {
      const normalized = {
        enabled: values.enabled,
        host: values.host.trim(),
        port: values.port ?? null,
        username: values.username.trim(),
        password: values.password.trim()
      };
      setProxy(normalized);
      await saveProxy();
      toast.success("Proxy updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProxyBusy(false);
    }
  };

  const handleCancelJob = async (job: JobModel) => {
    setCancelBusy((prev) => ({ ...prev, [job.id]: true }));
    try {
      await cancelJob(job.id);
      toast.success("Задача остановлена");
      await Promise.all([fetchQueue(), fetchHistory()]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCancelBusy((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
    }
  };

  const runningCount = useMemo(
    () => tasks.filter((job) => job.status === "running").length,
    [tasks]
  );
  const pendingCount = useMemo(
    () => tasks.filter((job) => job.status === "pending").length,
    [tasks]
  );
  const completedCount = useMemo(
    () => history.filter((item) => item.status === "completed").length,
    [history]
  );
  const queueTotal = tasks.length;
  const lastHistoryUpdate = useMemo(() => {
    const last = history[0];
    if (!last) {
      return null;
    }
    const timestamp = last.finished_at || last.created_at;
    return timestamp ? new Date(timestamp).toLocaleString() : null;
  }, [history]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <DashboardHeader
        queueTotal={queueTotal}
        runningCount={runningCount}
        pendingCount={pendingCount}
        completedCount={completedCount}
        availableStores={3}
        lastHistoryUpdate={lastHistoryUpdate}
      />

      <main className="space-y-6">
        <TaskForm
          form={taskForm}
          proxyForm={proxyForm}
          proxyBusy={proxyBusy}
          onProxySubmit={handleProxySubmit}
          busy={creating}
          onSubmit={handleCreateTask}
          onResetTemplate={handleResetTemplate}
          onPathTemplateChange={(value) => setPathTemplate(value.trim())}
        />

        <QueueMonitor
          jobs={tasks}
          history={history}
          onRefreshQueue={fetchQueue}
          onRefreshHistory={fetchHistory}
          onCancelJob={handleCancelJob}
          cancelBusy={cancelBusy}
        />
      </main>

      {initializing ? <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" /> : null}
      <Toaster />
    </div>
  );
};

export default App;
