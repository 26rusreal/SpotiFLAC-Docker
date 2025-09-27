import { create } from "zustand";
import type { HistoryItem, JobModel } from "../types";

type QueueTab = "queue" | "history";

interface DashboardState {
  jobs: JobModel[];
  history: HistoryItem[];
  listView: QueueTab;
  setListView: (view: QueueTab) => void;
  setJobs: (jobs: JobModel[]) => void;
  upsertJob: (job: JobModel) => void;
  setHistory: (history: HistoryItem[]) => void;
}

function sortJobs(jobs: JobModel[]): JobModel[] {
  return [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function mergeJob(jobs: JobModel[], incoming: JobModel): JobModel[] {
  const index = jobs.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    const next = [...jobs];
    next[index] = incoming;
    return next;
  }
  return [...jobs, incoming];
}

export const useDashboardStore = create<DashboardState>((set) => ({
  jobs: [],
  history: [],
  listView: "queue",
  setListView: (view) => set({ listView: view }),
  setJobs: (jobs) => set({ jobs: sortJobs(jobs) }),
  upsertJob: (job) => set((state) => ({ jobs: sortJobs(mergeJob(state.jobs, job)) })),
  setHistory: (history) => set({ history })
}));
