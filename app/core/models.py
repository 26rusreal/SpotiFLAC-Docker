"""Общие модели и перечисления для движка загрузчика."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional


class ProviderType(str, Enum):
    """Типы источников плейлистов."""

    SPOTIFY = "spotify"


class StoreType(str, Enum):
    """Поддерживаемые магазины загрузки."""

    QOBUZ = "qobuz"
    TIDAL = "tidal"
    DEEZER = "deezer"
    AMAZON = "amazon"


class JobStatus(str, Enum):
    """Состояние задачи загрузки."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def finished(self) -> bool:
        return self in {self.COMPLETED, self.FAILED, self.CANCELLED}


@dataclass
class TrackMetadata:
    """Минимальный набор данных о треке, необходимый для загрузки."""

    title: str
    artists: str
    album: str
    external_url: str
    isrc: str
    duration_ms: int = 0
    track_number: Optional[int] = None
    release_date: Optional[str] = None

    def as_context(self) -> Dict[str, object]:
        """Возвращает словарь для подстановки в шаблоны путей."""

        return {
            "artist": self.artists,
            "album": self.album,
            "title": self.title,
            "track": self.track_number or 0,
            "ext": "flac",
        }


@dataclass
class ResolvedSource:
    """Результат разрешения ссылки Spotify."""

    source_url: str
    source_type: str
    name: Optional[str]
    tracks: List[TrackMetadata]


@dataclass
class DownloadJob:
    """Состояние задачи, с которым работает очередь."""

    id: str
    provider: ProviderType
    store: StoreType
    source_url: str
    quality: Optional[str]
    path_template: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    total_tracks: int = 0
    completed_tracks: int = 0
    failed_tracks: int = 0
    message: Optional[str] = None
    error: Optional[str] = None
    output_dir: str = ""
    logs: List[str] = field(default_factory=list)

    def touch(self) -> None:
        """Обновляет метку времени обновления."""

        self.updated_at = datetime.utcnow()

    def snapshot(self) -> "JobSnapshot":
        """Создаёт снимок состояния для передачи наружу."""

        return JobSnapshot(
            **self.to_dict(),
        )

    def to_dict(self) -> Dict[str, object]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        data["finished_at"] = self.finished_at.isoformat() if self.finished_at else None
        data["provider"] = self.provider.value
        data["store"] = self.store.value
        data["status"] = self.status.value
        return data


@dataclass
class JobSnapshot:
    """Плоское представление задачи для API/WS."""

    id: str
    provider: str
    store: str
    source_url: str
    quality: Optional[str]
    path_template: str
    created_at: str
    updated_at: str
    finished_at: Optional[str]
    status: str
    progress: float
    total_tracks: int
    completed_tracks: int
    failed_tracks: int
    message: Optional[str]
    error: Optional[str]
    output_dir: str
    logs: List[str]


@dataclass
class FileEntry:
    """Файл, доступный в каталоге загрузок."""

    path: Path
    size_bytes: int
    modified_at: datetime

    def to_dict(self) -> Dict[str, object]:
        return {
            "path": str(self.path),
            "size": self.size_bytes,
            "modified_at": self.modified_at.isoformat(),
        }
