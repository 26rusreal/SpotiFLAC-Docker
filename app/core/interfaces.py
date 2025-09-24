"""Интерфейсы для провайдеров и инфраструктурных компонентов."""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from .models import ResolvedSource, TrackMetadata


class PlaylistProvider(ABC):
    """Источник плейлистов (Spotify и т.п.)."""

    @abstractmethod
    async def resolve(self, url: str) -> ResolvedSource:
        """Возвращает список треков и метаданные по ссылке."""


class StoreProvider(ABC):
    """Поставщик контента (Qobuz, Tidal...)."""

    name: str

    @abstractmethod
    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: Optional[str] = None,
        is_cancelled: Optional[callable] = None,
    ) -> Path:
        """Скачивает трек и возвращает путь к сохранённому файлу."""


class Tagger(ABC):
    """Интерфейс для применения тегов."""

    @abstractmethod
    async def apply(self, file_path: Path, metadata: TrackMetadata) -> None:
        """Добавляет или обновляет теги."""


class Transcoder(ABC):
    """Интерфейс кодека."""

    @abstractmethod
    async def ensure_codec(self, file_path: Path, target_extension: str) -> Path:
        """Гарантирует, что файл имеет нужный кодек."""
