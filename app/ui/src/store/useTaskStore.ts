import { create } from "zustand";
import { fetchHistory, fetchJobs, fetchSettings, updateSettings } from "../api";
import type { DownloadSettings, HistoryItem, JobModel, ProxySettings as ProxyState } from "../types";

function sortByCreatedAt(jobs: JobModel[]): JobModel[] {
  return [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

interface TaskStoreState {
  tasks: JobModel[];
  history: HistoryItem[];
  pathTemplate: string;
  proxy: ProxyState;
  download: DownloadSettings | null;
  fetchQueue: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateTaskProgress: (id: string, progress: number, patch?: Partial<JobModel>) => void;
  setPathTemplate: (value: string) => void;
  setDownloadSettings: (value: DownloadSettings) => void;
  toggleProxy: (value: boolean) => void;
  setProxy: (proxy: ProxyState) => void;
  saveProxy: () => Promise<void>;
}

const defaultProxy: ProxyState = {
  enabled: false,
  host: "",
  port: null,
  username: "",
  password: ""
};

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  history: [],
  pathTemplate: "",
  proxy: defaultProxy,
  download: null,
  async fetchQueue() {
    const response = await fetchJobs();
    set({ tasks: sortByCreatedAt(response.jobs) });
  },
  async fetchHistory() {
    const response = await fetchHistory();
    set({ history: response.history });
  },
  async fetchSettings() {
    const response = await fetchSettings();
    set({
      proxy: {
        enabled: response.proxy?.enabled ?? false,
        host: response.proxy?.host ?? "",
        port: response.proxy?.port ?? null,
        username: response.proxy?.username ?? "",
        password: response.proxy?.password ?? ""
      },
      download: response.download,
      pathTemplate: response.download.active_template
    });
  },
  updateTaskProgress(id, progress, patch) {
    set((state) => ({
      tasks: sortByCreatedAt(
        state.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                progress,
                ...patch
              }
            : task
        )
      )
    }));
  },
  setPathTemplate(value) {
    set((state) => ({
      pathTemplate: value,
      download: state.download
        ? { ...state.download, active_template: value }
        : state.download
    }));
  },
  setDownloadSettings(value) {
    set({ download: value, pathTemplate: value.active_template });
  },
  toggleProxy(value) {
    set((state) => ({ proxy: { ...state.proxy, enabled: value } }));
  },
  setProxy(proxy) {
    set({ proxy });
  },
  async saveProxy() {
    const state = get();
    if (!state.download) {
      throw new Error("Настройки загрузки ещё не загружены");
    }
    const saved = await updateSettings({
      proxy: state.proxy,
      download: state.download
    });
    set({ proxy: saved.proxy, download: saved.download, pathTemplate: saved.download.active_template });
  }
}));
