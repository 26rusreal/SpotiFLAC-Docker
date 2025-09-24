"""Адаптеры магазинов, приводящие старые загрузчики к новому интерфейсу."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Optional

from app.core.exceptions import ProviderError
from app.core.interfaces import StoreProvider
from app.core.models import TrackMetadata

from .amazon import LucidaDownloader
from .deezer import DeezerDownloader
from .qobuz_auto import QobuzDownloader as QobuzAutoDownloader
from .qobuz_region import QobuzDownloader as QobuzRegionDownloader
from .tidal import TidalDownloader


def _default_cancel() -> bool:
    return False


class QobuzStore(StoreProvider):
    """Загрузчик для Qobuz, поддерживает auto/region режимы."""

    name = "qobuz"

    def __init__(self, mode: str = "auto", region: str = "us") -> None:
        if mode == "auto":
            self._downloader = QobuzAutoDownloader()
        else:
            self._downloader = QobuzRegionDownloader(region)
        self._lock = asyncio.Lock()

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: Optional[str] = None,
        is_cancelled: Optional[callable] = None,
    ) -> Path:
        if not track.isrc:
            raise ProviderError("ISRC отсутствует для трека")

        cancel = is_cancelled or _default_cancel

        async with self._lock:
            path = await asyncio.to_thread(
                self._downloader.download,
                track.isrc,
                str(destination),
                None,
                cancel,
            )
        if not path:
            raise ProviderError("Не удалось загрузить трек с Qobuz")
        return Path(path)


class TidalStore(StoreProvider):
    """Интеграция с загрузчиком Tidal."""

    name = "tidal"

    def __init__(self) -> None:
        self._downloader = TidalDownloader()
        self._lock = asyncio.Lock()

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: Optional[str] = None,
        is_cancelled: Optional[callable] = None,
    ) -> Path:
        query = f"{track.artists} - {track.title}".strip()
        cancel = is_cancelled or _default_cancel

        async with self._lock:
            path = await asyncio.to_thread(
                self._downloader.download,
                query,
                track.isrc or None,
                str(destination),
                quality or "LOSSLESS",
                None,
                cancel,
            )
        if not path:
            raise ProviderError("Не удалось загрузить трек с Tidal")
        return Path(path)


class DeezerStore(StoreProvider):
    """Обёртка для Deezer."""

    name = "deezer"

    def __init__(self) -> None:
        self._downloader = DeezerDownloader()
        self._lock = asyncio.Lock()

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: Optional[str] = None,
        is_cancelled: Optional[callable] = None,
    ) -> Path:
        if not track.isrc:
            raise ProviderError("ISRC отсутствует для трека")

        async with self._lock:
            path = await asyncio.to_thread(
                self._downloader.download_by_isrc_sync,
                track.isrc,
                str(destination),
            )
        if not path:
            raise ProviderError("Не удалось загрузить трек с Deezer")
        return Path(path)


class AmazonStore(StoreProvider):
    """Интеграция с загрузчиком Lucida/amazon."""

    name = "amazon"

    def __init__(self) -> None:
        self._downloader = LucidaDownloader()
        self._lock = asyncio.Lock()

    @staticmethod
    def _extract_track_id(external_url: str) -> Optional[str]:
        if "open.spotify.com/track/" not in external_url:
            return None
        return external_url.rstrip("/").split("/")[-1].split("?")[0]

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: Optional[str] = None,
        is_cancelled: Optional[callable] = None,
    ) -> Path:
        track_id = self._extract_track_id(track.external_url)
        if not track_id:
            raise ProviderError("Невозможно определить track_id Spotify для Amazon")

        async with self._lock:
            path = await asyncio.to_thread(
                self._downloader.download,
                track_id,
                str(destination),
                None,
                is_cancelled or _default_cancel,
            )
        if not path:
            raise ProviderError("Не удалось загрузить трек с Amazon Music")
        return Path(path)


STORE_REGISTRY = {
    QobuzStore.name: QobuzStore,
    TidalStore.name: TidalStore,
    DeezerStore.name: DeezerStore,
    AmazonStore.name: AmazonStore,
}
