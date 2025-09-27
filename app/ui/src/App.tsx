import React, { useState, useEffect } from "react";
import "./App.css";

interface Job {
  id: string;
  status: string;
  progress: number;
  source_url: string;
  store: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  total_tracks: number;
  completed_tracks: number;
  failed_tracks: number;
  message: string | null;
  error: string | null;
  downloaded_files: string[];
  collection_name: string | null;
  quality: string | null;
}

interface Settings {
  proxy: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
  };
  download: {
    mode: string;
    active_template: string;
    by_artist_template: string;
    single_folder_template: string;
  };
}

type Page = 'main' | 'settings';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newJobUrl, setNewJobUrl] = useState("");
  const [selectedStore, setSelectedStore] = useState("qobuz");

  // Настройки прокси
  const [proxySettings, setProxySettings] = useState({
    enabled: false,
    host: "",
    port: 1080,
    username: "",
    password: ""
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Загрузка данных
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsRes, settingsRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/settings")
      ]);
      
      if (!jobsRes.ok || !settingsRes.ok) {
        throw new Error("Failed to load data");
      }
      
      const jobsData = await jobsRes.json();
      const settingsData = await settingsRes.json();
      
      // Сортируем задачи от новых к старым
      const sortedJobs = (jobsData.jobs || []).sort((a: Job, b: Job) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setJobs(sortedJobs);
      setSettings(settingsData);
      setProxySettings(settingsData.proxy);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobUrl.trim()) return;

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "spotify",
          store: selectedStore,
          url: newJobUrl.trim(),
          path_template: settings?.download.active_template || "{artist}/{album}/{track:02d} - {title}.{ext}"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create job");
      }

      setNewJobUrl("");
      loadData(); // Перезагружаем список
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to cancel job");
      }

      loadData(); // Перезагружаем список
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    }
  };

  const saveProxySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxy: proxySettings
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      // Обновляем локальные настройки
      setSettings(prev => prev ? { ...prev, proxy: proxySettings } : null);
      
      // Показываем уведомление об успехе
      alert("Настройки прокси сохранены!");
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#10b981";
      case "running": return "#3b82f6";
      case "failed": return "#ef4444";
      case "pending": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Завершено";
      case "running": return "Выполняется";
      case "failed": return "Ошибка";
      case "pending": return "Ожидает";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-controls">
          <div className="status">
            {settings && (
              <div className="status-item">
                <span className="label">Proxy:</span>
                <span className={`value ${settings.proxy.enabled ? 'enabled' : 'disabled'}`}>
                  {settings.proxy.enabled ? 'Включен' : 'Выключен'}
                </span>
              </div>
            )}
            <div className="status-item">
              <span className="label">Задач:</span>
              <span className="value">{jobs.length}</span>
            </div>
          </div>
          <nav className="nav">
            <button 
              className={`nav-btn ${currentPage === 'main' ? 'active' : ''}`}
              onClick={() => setCurrentPage('main')}
            >
              Главная
            </button>
            <button 
              className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentPage('settings')}
            >
              Настройки
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error">
            <p>❌ {error}</p>
            <button onClick={loadData}>Повторить</button>
          </div>
        )}

        {currentPage === 'main' && (
          <>
            <div className="main-title-container">
              <h1 className="main-title">SpotiFLAC Control Panel</h1>
            </div>
            <section className="section">
              <h2>Создать задачу</h2>
              <form onSubmit={createJob} className="form">
                <div className="form-group">
                  <label htmlFor="url">URL Spotify:</label>
                  <input
                    id="url"
                    type="url"
                    value={newJobUrl}
                    onChange={(e) => setNewJobUrl(e.target.value)}
                    placeholder="https://open.spotify.com/album/..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="store">Магазин:</label>
                  <select
                    id="store"
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                  >
                    <option value="qobuz">Qobuz</option>
                    <option value="deezer">Deezer</option>
                    <option value="bandcamp">Bandcamp</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">
                  Создать задачу
                </button>
              </form>
            </section>

            <section className="section">
              <div className="section-header">
                <h2>Активные задачи</h2>
                <button onClick={loadData} className="btn btn-secondary">
                  Обновить
                </button>
              </div>
              
              {jobs.length === 0 ? (
                <div className="empty">
                  <p>Нет активных задач</p>
                </div>
              ) : (
            <div className="jobs-list">
              {jobs.map((job) => (
                <div key={job.id} className={job.status === "running" ? "job-card" : "job-card-compact"}>
                  {job.status === "running" ? (
                    <>
                      <div className="job-info">
                        <div className="job-header">
                          <div className="job-title">
                            {job.collection_name || job.source_url}
                          </div>
                          <div className="job-url">{job.source_url}</div>
                        </div>
                        <div className="job-meta">
                          <span className="job-store">{job.store.toUpperCase()}</span>
                          {job.quality && (
                            <span className="job-quality">{job.quality}</span>
                          )}
                          <span className="job-date">
                            {new Date(job.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="job-progress-info">
                          <div className="progress-stats">
                            <span className="tracks-count">
                              {job.completed_tracks} / {job.total_tracks} треков
                            </span>
                            <span className="progress-percentage">
                              {Math.round(job.progress * 100)}%
                            </span>
                          </div>
                          <div className="progress">
                            <div 
                              className="progress-bar"
                              style={{ width: `${Math.round(job.progress * 100)}%` }}
                            ></div>
                          </div>
                          <div className="progress-details">
                            {job.completed_tracks > 0 && (
                              <span className="estimated-time">
                                {(() => {
                                  const startTime = new Date(job.created_at).getTime();
                                  const currentTime = new Date(job.updated_at).getTime();
                                  const elapsedTime = currentTime - startTime;
                                  const avgTimePerTrack = elapsedTime / job.completed_tracks;
                                  const remainingTracks = job.total_tracks - job.completed_tracks;
                                  const estimatedRemainingTime = avgTimePerTrack * remainingTracks;
                                  
                                  const formatTime = (ms: number) => {
                                    const minutes = Math.floor(ms / 60000);
                                    const hours = Math.floor(minutes / 60);
                                    if (hours > 0) {
                                      return `${hours}ч ${minutes % 60}м`;
                                    }
                                    return `${minutes}м`;
                                  };
                                  
                                  return `~${formatTime(estimatedRemainingTime)} осталось`;
                                })()}
                              </span>
                            )}
                            {job.message && (
                              <span className="current-track">
                                Сейчас: {job.message}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="job-status">
                        <div 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(job.status) }}
                        >
                          {getStatusText(job.status)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="job-title-compact">
                        {job.collection_name || job.source_url}
                      </div>
                      <div className="job-status-compact">
                        <div 
                          className="status-badge-compact"
                          style={{ backgroundColor: getStatusColor(job.status) }}
                        >
                          {getStatusText(job.status)}
                        </div>
                        {job.status === "completed" && (
                          <div className="tracks-count-compact">
                            {job.completed_tracks} / {job.total_tracks} треков
                          </div>
                        )}
                        {job.status === "failed" && (
                          <div className="error-compact">
                            Ошибка
                          </div>
                        )}
                        {job.status === "pending" && (
                          <button 
                            onClick={() => cancelJob(job.id)}
                            className="btn-cancel-compact"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
              )}
            </section>
          </>
        )}

        {currentPage === 'settings' && (
          <>
            <div className="main-title-container">
              <h1 className="main-title">SpotiFLAC Control Panel</h1>
            </div>
            <section className="section">
              <h2>Настройки прокси</h2>
            <form onSubmit={saveProxySettings} className="form">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={proxySettings.enabled}
                    onChange={(e) => setProxySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>Включить прокси</span>
                </label>
              </div>

              {proxySettings.enabled && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="proxy-host">Хост:</label>
                      <input
                        id="proxy-host"
                        type="text"
                        value={proxySettings.host}
                        onChange={(e) => setProxySettings(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="proxy.example.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="proxy-port">Порт:</label>
                      <input
                        id="proxy-port"
                        type="number"
                        value={proxySettings.port}
                        onChange={(e) => setProxySettings(prev => ({ ...prev, port: parseInt(e.target.value) || 1080 }))}
                        min="1"
                        max="65535"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="proxy-username">Имя пользователя:</label>
                      <input
                        id="proxy-username"
                        type="text"
                        value={proxySettings.username}
                        onChange={(e) => setProxySettings(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="username"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="proxy-password">Пароль:</label>
                      <input
                        id="proxy-password"
                        type="password"
                        value={proxySettings.password}
                        onChange={(e) => setProxySettings(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="password"
                      />
                    </div>
      </div>

                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={savingSettings}
                    >
                      {savingSettings ? 'Сохранение...' : 'Сохранить настройки'}
                    </button>
                  </div>
                </>
              )}

              {!proxySettings.enabled && (
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={savingSettings}
                  >
                    {savingSettings ? 'Сохранение...' : 'Сохранить настройки'}
                  </button>
                </div>
              )}
            </form>

            {settings && (
              <div className="settings-info">
                <h3>Текущие настройки загрузки</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Режим:</span>
                    <span className="value">{settings.download.mode}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Шаблон:</span>
                    <span className="value">{settings.download.active_template}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
          </>
        )}
      </main>
    </div>
  );
};

export default App;