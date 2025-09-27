import React, { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export interface TaskFormValues {
  url: string;
  store: "qobuz" | "bandcamp" | "deezer";
  quality?: string | null;
  pathTemplate: string;
}

export interface ProxyFormValues {
  enabled: boolean;
  host: string;
  port: number | null;
  username: string;
  password: string;
}

interface TaskFormProps {
  form: UseFormReturn<TaskFormValues>;
  proxyForm: UseFormReturn<ProxyFormValues>;
  busy?: boolean;
  proxyBusy?: boolean;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
  onResetTemplate: () => void;
  onPathTemplateChange?: (value: string) => void;
  onProxySubmit: (values: ProxyFormValues) => Promise<void> | void;
}

const STORE_OPTIONS = [
  { value: "qobuz", label: "Qobuz" },
  { value: "bandcamp", label: "Bandcamp" },
  { value: "deezer", label: "Deezer" }
];

const TaskForm: React.FC<TaskFormProps> = ({
  form,
  proxyForm,
  busy = false,
  proxyBusy = false,
  onSubmit,
  onResetTemplate,
  onPathTemplateChange,
  onProxySubmit
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setFocus
  } = form;

  const {
    ref: urlFieldRef,
    ...urlField
  } = register("url");

  const urlRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (urlRef.current) {
      urlRef.current.focus();
    } else {
      setFocus("url");
    }
  }, [setFocus]);

  const pathTemplate = watch("pathTemplate");

  useEffect(() => {
    if (onPathTemplateChange) {
      onPathTemplateChange(pathTemplate ?? "");
    }
  }, [onPathTemplateChange, pathTemplate]);

  const {
    register: registerProxy,
    handleSubmit: handleProxySubmit,
    formState: { errors: proxyErrors },
    watch: watchProxy
  } = proxyForm;

  const proxyEnabled = watchProxy("enabled");

  return (
    <section className="glass-card card-padding space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Новая задача</h2>
          <p className="text-sm text-slate-400">Укажите ссылку Spotify и параметры выгрузки.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onResetTemplate}>
          Сбросить шаблон
        </Button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="form-label" htmlFor="task-url">
              Ссылка на Spotify*
            </label>
            <Input
              id="task-url"
              placeholder="https://open.spotify.com/playlist/..."
              hasError={Boolean(errors.url)}
              {...urlField}
              ref={(element) => {
                urlFieldRef(element);
                urlRef.current = element;
              }}
            />
            {errors.url ? <p className="form-error">{errors.url.message as string}</p> : null}
            <p className="form-hint">Поддерживаются плейлисты, альбомы и треки.</p>
          </div>
          <div className="space-y-2">
            <label className="form-label" htmlFor="task-store">
              Магазин
            </label>
            <select
              id="task-store"
              className="h-9 w-full rounded-lg border border-slate-700/40 bg-slate-900/70 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              {...register("store")}
            >
              {STORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="form-label" htmlFor="task-quality">
              Качество (необязательно)
            </label>
            <Input
              id="task-quality"
              placeholder="Например, FLAC, 320kbps"
              hasError={Boolean(errors.quality)}
              {...register("quality")}
            />
            {errors.quality ? <p className="form-error">{errors.quality.message as string}</p> : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="form-label" htmlFor="task-template">
              Шаблон пути*
            </label>
            <textarea
              id="task-template"
              className="h-20 w-full rounded-lg border border-slate-700/40 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              {...register("pathTemplate")}
            />
            {errors.pathTemplate ? <p className="form-error">{errors.pathTemplate.message as string}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="submit" loading={busy}>
            Создать задачу
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <form
          className="space-y-4"
          onSubmit={handleProxySubmit((values) => {
            const normalizedPort =
              typeof values.port === "number" && Number.isNaN(values.port)
                ? null
                : values.port;
            void onProxySubmit({
              ...values,
              port: normalizedPort
            });
          })}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-400"
                {...registerProxy("enabled")}
              />
              Использовать прокси
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">
                Статус: {proxyEnabled ? <span className="text-emerald-400">✅ Активен</span> : <span className="text-amber-300">⚠️ Отключён</span>}
              </span>
              <Button type="submit" size="sm" loading={proxyBusy}>
                Сохранить прокси
              </Button>
            </div>
          </div>

          {proxyEnabled ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1">
                <label className="form-label" htmlFor="proxy-host">
                  IP / хост*
                </label>
                <Input
                  id="proxy-host"
                  placeholder="127.0.0.1"
                  hasError={Boolean(proxyErrors.host)}
                  disabled={!proxyEnabled}
                  {...registerProxy("host")}
                />
                {proxyErrors.host ? <p className="form-error">{proxyErrors.host.message as string}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="form-label" htmlFor="proxy-port">
                  Порт*
                </label>
                <Input
                  id="proxy-port"
                  type="number"
                  inputMode="numeric"
                  placeholder="1080"
                  hasError={Boolean(proxyErrors.port)}
                  disabled={!proxyEnabled}
                  {...registerProxy("port", { valueAsNumber: true })}
                />
                {proxyErrors.port ? <p className="form-error">{proxyErrors.port.message as string}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="form-label" htmlFor="proxy-username">
                  Логин
                </label>
                <Input
                  id="proxy-username"
                  placeholder="proxy-user"
                  hasError={Boolean(proxyErrors.username)}
                  disabled={!proxyEnabled}
                  {...registerProxy("username")}
                />
                {proxyErrors.username ? <p className="form-error">{proxyErrors.username.message as string}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="form-label" htmlFor="proxy-password">
                  Пароль
                </label>
                <Input
                  id="proxy-password"
                  type="password"
                  placeholder="••••••"
                  hasError={Boolean(proxyErrors.password)}
                  disabled={!proxyEnabled}
                  {...registerProxy("password")}
                />
                {proxyErrors.password ? <p className="form-error">{proxyErrors.password.message as string}</p> : null}
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
};

export default TaskForm;
