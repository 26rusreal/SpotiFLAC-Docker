"""Загрузка конфигурации из переменных окружения."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    download_dir: Path = Path(os.environ.get("DOWNLOAD_DIR", "/downloads"))
    config_dir: Path = Path(os.environ.get("CONFIG_DIR", "/config"))
    default_template: str = os.environ.get(
        "PATH_TEMPLATE",
        "{artist}/{album}/{track:02d} - {title}.{ext}",
    )
    worker_concurrency: int = int(os.environ.get("WORKER_CONCURRENCY", "1"))
    spotify_batch_delay: float = float(os.environ.get("SPOTIFY_BATCH_DELAY", "0.2"))
    log_level: str = os.environ.get("LOG_LEVEL", "INFO")

    def ensure_dirs(self) -> None:
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)
