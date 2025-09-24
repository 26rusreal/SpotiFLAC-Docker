export interface ProvidersResponse {
  playlists: string[];
  stores: string[];
}

export interface JobModel {
  id: string;
  provider: string;
  store: string;
  source_url: string;
  quality: string | null;
  path_template: string;
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
  logs: string[];
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
