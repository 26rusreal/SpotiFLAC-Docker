"""Фабрика зависимостей для CLI и API."""
from __future__ import annotations

from typing import Dict

from app.adapters.spotify_provider import SpotifyPlaylistProvider
from app.adapters.store_providers import STORE_REGISTRY
from app.core.interfaces import StoreProvider
from app.core.models import StoreType
from app.core.service import DownloadService
from app.infra.logging import configure_logging
from app.infra.settings import Settings
from app.infra.storage import StorageManager


def create_service(settings: Settings) -> DownloadService:
    """Создаёт и настраивает сервис загрузок."""

    configure_logging(settings.log_level)
    storage = StorageManager(settings.download_dir, settings.config_dir, settings.default_template)
    playlist_provider = SpotifyPlaylistProvider(batch_delay=settings.spotify_batch_delay)

    store_providers: Dict[StoreType, StoreProvider] = {}
    for name, factory in STORE_REGISTRY.items():
        try:
            store_type = StoreType(name)
        except ValueError:
            continue
        store_providers[store_type] = factory()

    return DownloadService(
        playlist_provider=playlist_provider,
        store_providers=store_providers,
        storage=storage,
        worker_concurrency=settings.worker_concurrency,
    )
