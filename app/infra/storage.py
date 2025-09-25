"""Управление каталогами конфигурации и загрузок."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from app.core.models import DownloadJob, DownloadMode, FileEntry, TrackMetadata
from app.core.utils import render_path, sanitize_component


class StorageManager:
    """Работает с файловой системой контейнера."""

    def __init__(self, download_dir: Path, config_dir: Path, default_template: str) -> None:
        self.download_dir = download_dir
        self.config_dir = config_dir
        self.default_template = default_template
        self.providers_dir = self.config_dir / "providers"

    def ensure_directories(self) -> None:
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.providers_dir.mkdir(parents=True, exist_ok=True)

    def build_track_path(self, job: DownloadJob, track: TrackMetadata) -> Path:
        template = job.path_template or self.default_template
        context = track.as_context()
        playlist_name = job.collection_name or job.message or "Playlist"
        if "{playlist" in template or job.mode == DownloadMode.SINGLE_FOLDER:
            context["playlist"] = playlist_name
        relative = render_path(template, context)
        if playlist_name and "{playlist" not in template:
            relative = Path(sanitize_component(str(playlist_name))) / relative
        return self.download_dir / relative

    def list_downloads(self) -> List[FileEntry]:
        entries: List[FileEntry] = []
        if not self.download_dir.exists():
            return entries
        for file in self.download_dir.rglob("*"):
            if not file.is_file():
                continue
            stat = file.stat()
            entries.append(
                FileEntry(
                    path=file.relative_to(self.download_dir),
                    size_bytes=stat.st_size,
                    modified_at=datetime.utcfromtimestamp(stat.st_mtime),
                )
            )
        entries.sort(key=lambda item: item.modified_at, reverse=True)
        return entries

    def save_tokens(self, provider: str, payload: Dict[str, object]) -> Path:
        self.ensure_directories()
        path = self.providers_dir / f"{provider}.json"
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        return path

    def load_tokens(self, provider: str) -> Optional[Dict[str, object]]:
        path = self.providers_dir / f"{provider}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text())
