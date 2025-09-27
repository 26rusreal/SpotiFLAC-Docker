"""Фабрика зависимостей для CLI и API."""
from __future__ import annotations

from typing import Dict

from adapters.spotify_provider import SpotifyPlaylistProvider
from adapters.store_providers import STORE_REGISTRY
from core.interfaces import StoreProvider
from core.models import StoreType
from core.service import DownloadService
from infra.app_config import init_app_config
from infra.settings import Settings
from infra.storage import StorageManager


def create_service(settings: Settings) -> DownloadService:
    """Создаёт и настраивает сервис загрузок."""

    storage = StorageManager(settings.download_dir, settings.config_dir, settings.default_template)
    config_repo = init_app_config(settings.config_dir, settings=settings)
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
        config_repo=config_repo,
        worker_concurrency=settings.worker_concurrency,
    )
