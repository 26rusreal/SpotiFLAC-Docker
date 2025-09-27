import React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { DownloadMode, ProvidersResponse } from "../../types";
import LoadingSpinner from "../common/LoadingSpinner";

export interface TaskFormValues {
  url: string;
  provider: string;
  store: string;
  quality: string;
  pathTemplate: string;
}

interface TaskFormProps {
  providers: ProvidersResponse | null;
  busy: boolean;
  downloadBusy: boolean;
  onSubmit: (values: TaskFormValues) => void | Promise<void>;
  onSaveDownload: () => void | Promise<void>;
  onModeChange: (mode: DownloadMode) => void;
  onResetTemplate: () => void;
  autoTemplate: string;
  pathTemplateEdited: boolean;
  activeDownloadMode: DownloadMode;
  form: UseFormReturn<TaskFormValues>;
}

const TaskForm: React.FC<TaskFormProps> = ({
  providers,
  busy,
  downloadBusy,
  onSubmit,
  onSaveDownload,
  onModeChange,
  onResetTemplate,
  autoTemplate,
  pathTemplateEdited,
  activeDownloadMode,
  form
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = form;

  const stores = providers?.stores ?? [];
  const watchMode = activeDownloadMode;
  const watchTemplate = watch("pathTemplate");

  return (
    <section className="panel panel--primary">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Новая задача</h2>
          <p className="panel__meta">
            Укажите ссылку Spotify, выберите магазин и при необходимости уточните
            шаблон сохранения.
          </p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={onResetTemplate}
          title="Вернуть рекомендованный шаблон"
        >
          Сбросить шаблон
        </button>
      </div>

      <form className="panel__body" onSubmit={handleSubmit(onSubmit)}>
        <div className="field-grid">
          <label className={`field ${errors.url ? "is-invalid" : ""}`}>
            <span>Ссылка на Spotify*</span>
            <input
              {...register("url")}
              placeholder="https://open.spotify.com/playlist/..."
              autoComplete="off"
              data-hint="Поддерживаются плейлисты, альбомы и треки"
            />
            {errors.url && <span className="field__error">{errors.url.message}</span>}
          </label>

          <label className="field">
            <span>Провайдер</span>
            <select {...register("provider")}>
              <option value="spotify">Spotify</option>
            </select>
          </label>

          <label className="field">
            <span>Магазин</span>
            <select {...register("store")}>
              {stores.length === 0 && (
                <option value="" disabled>
                  Нет доступных магазинов
                </option>
              )}
              {stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Качество (необязательно)</span>
            <input
              {...register("quality")}
              placeholder="Например, FLAC"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="divider" />

        <fieldset className="mode-switch">
          <legend>Шаблон выгрузки</legend>
          <div className="mode-switch__buttons">
            <button
              type="button"
              className={`mode-switch__button${watchMode === "by_artist" ? " is-active" : ""}`}
              onClick={() => onModeChange("by_artist")}
            >
              По артисту
            </button>
            <button
              type="button"
              className={`mode-switch__button${watchMode === "single_folder" ? " is-active" : ""}`}
              onClick={() => onModeChange("single_folder")}
            >
              Одна папка
            </button>
          </div>
          <p className="mode-switch__hint">
            {pathTemplateEdited
              ? "Используется пользовательский шаблон"
              : `Авто: ${autoTemplate}`}
          </p>
        </fieldset>

        <label className={`field field--wide ${errors.pathTemplate ? "is-invalid" : ""}`}>
          <span>Шаблон пути*</span>
          <textarea
            {...register("pathTemplate")}
            rows={2}
            placeholder="{artist}/{album}/{track:02d} - {title}.{ext}"
            data-hint="Доступные переменные: {artist}, {album}, {track}, {title}, {ext}"
          />
          {errors.pathTemplate && (
            <span className="field__error">{errors.pathTemplate.message}</span>
          )}
          <span className="field__info">
            Текущий шаблон: <code>{watchTemplate}</code>
          </span>
        </label>

        <div className="form-toolbar">
          <button
            type="button"
            className="button button--outline"
            onClick={() => void onSaveDownload()}
            disabled={downloadBusy}
          >
            {downloadBusy ? (
              <span className="button__loader">
                <LoadingSpinner size={16} /> Сохранение...
              </span>
            ) : (
              "Сохранить как по умолчанию"
            )}
          </button>

          <button
            type="submit"
            className="button button--primary"
            disabled={busy}
          >
            {busy ? (
              <span className="button__loader">
                <LoadingSpinner size={18} /> Создание...
              </span>
            ) : (
              "Создать задачу"
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export default TaskForm;
