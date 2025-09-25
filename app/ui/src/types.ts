export interface ProvidersResponse {
  playlists: string[];
  stores: string[];
}

export interface ProxySettings {
  enabled: boolean;
  host: string;
  port: number | null;
  username: string;
  password: string;
}

export type DownloadMode = "by_artist" | "single_folder";

export interface DownloadSettings {
  mode: DownloadMode;
  active_template: string;
  by_artist_template: string;
  single_folder_template: string;
}

export interface AppSettings {
  proxy: ProxySettings;
  download: DownloadSettings;
}

export interface JobModel {
  id: string;
  provider: string;
  store: string;
  source_url: string;
  quality: string | null;
  path_template: string;
  mode: DownloadMode;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  status: string;
  progress: number;
  total_tracks: number;
  completed_tracks: number;
  failed_tracks: number;
  message: string | null;
  error: string | null;
  output_dir: string;
  downloaded_files: string[];
  collection_name: string | null;
}

export interface JobResponse {
  job: JobModel;
}

export interface JobsListResponse {
  jobs: JobModel[];
}

export interface FileItem {
  path: string;
  size: number;
  modified_at: string;
}

export interface FilesResponse {
  files: FileItem[];
}

export interface HistoryItem {
  job_id: string;
  playlist: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  total_tracks: number;
  completed_tracks: number;
  failed_tracks: number;
}

export interface HistoryResponse {
  history: HistoryItem[];
}
