import React from "react";
import type { UseFormReturn } from "react-hook-form";
import LoadingSpinner from "../common/LoadingSpinner";

export interface ProxyFormValues {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
}

interface ProxySettingsProps {
  form: UseFormReturn<ProxyFormValues>;
  busy: boolean;
  onSubmit: (values: ProxyFormValues) => void | Promise<void>;
}

const ProxySettings: React.FC<ProxySettingsProps> = ({ form, busy, onSubmit }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = form;

  const enabled = watch("enabled");

  return (
    <section className="panel panel--secondary">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Сеть и прокси</h2>
          <p className="panel__meta">
            Настройте соединение для загрузки, если требуется использовать
            промежуточный сервер.
          </p>
        </div>
      </div>

      <form className="panel__body" onSubmit={handleSubmit(onSubmit)}>
        <label className="switch-control">
          <input type="checkbox" {...register("enabled")} />
          <span>Использовать прокси</span>
        </label>

        <div className="field-grid field-grid--proxy">
          <label className={`field ${errors.host ? "is-invalid" : ""}`}>
            <span>Адрес {enabled && "*"}</span>
            <input
              {...register("host")}
              placeholder="127.0.0.1"
              autoComplete="off"
              disabled={!enabled}
            />
            {errors.host && <span className="field__error">{errors.host.message}</span>}
          </label>

          <label className={`field ${errors.port ? "is-invalid" : ""}`}>
            <span>Порт {enabled && "*"}</span>
            <input
              {...register("port")}
              placeholder="1080"
              inputMode="numeric"
              autoComplete="off"
              disabled={!enabled}
            />
            {errors.port && <span className="field__error">{errors.port.message}</span>}
          </label>

          <label className="field">
            <span>Логин</span>
            <input
              {...register("username")}
              placeholder="Необязательно"
              autoComplete="username"
              disabled={!enabled}
            />
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              {...register("password")}
              type="password"
              placeholder="Необязательно"
              autoComplete="current-password"
              disabled={!enabled}
            />
          </label>
        </div>

        <div className="form-toolbar form-toolbar--end">
          <button
            type="submit"
            className="button button--primary"
            disabled={busy}
          >
            {busy ? (
              <span className="button__loader">
                <LoadingSpinner size={16} /> Сохранение...
              </span>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export default ProxySettings;
