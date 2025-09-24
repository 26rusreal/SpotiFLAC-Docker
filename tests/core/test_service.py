"""Тесты для сервиса загрузок."""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.core.exceptions import JobCancelled
from app.core.interfaces import PlaylistProvider, StoreProvider
from app.core.models import (
    JobSnapshot,
    JobStatus,
    ProviderType,
    ResolvedSource,
    StoreType,
    TrackMetadata,
)
from app.core.service import DownloadService, JobRequest
from app.infra.storage import StorageManager


class ЗаглушкаПлейлиста(PlaylistProvider):
    """Простейший поставщик треков для тестов."""

    def __init__(self, треки: list[TrackMetadata]) -> None:
        self._треки = треки
        self.запросы: list[str] = []

    async def resolve(self, url: str) -> ResolvedSource:
        self.запросы.append(url)
        return ResolvedSource(
            source_url=url,
            source_type="playlist",
            name="Тестовый плейлист",
            tracks=list(self._треки),
        )


class ФиксированныйМагазин(StoreProvider):
    """Магазин, создающий файл и возвращающий его путь."""

    name = "qobuz"

    def __init__(self) -> None:
        self.вызовы: list[tuple[TrackMetadata, Path, str | None]] = []
        self.завершено = asyncio.Event()

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: str | None = None,
        is_cancelled: callable | None = None,
    ) -> Path:
        self.вызовы.append((track, destination, quality))
        временный = destination / f"{track.isrc}.flac"
        временный.write_bytes(b"")
        self.завершено.set()
        return временный


class МедленныйМагазин(StoreProvider):
    """Магазин, проверяющий отмену и выбрасывающий исключение."""

    name = "qobuz"

    def __init__(self) -> None:
        self.стартовал = asyncio.Event()

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: str | None = None,
        is_cancelled: callable | None = None,
    ) -> Path:
        self.стартовал.set()
        while True:
            await asyncio.sleep(0.01)
            if is_cancelled and is_cancelled():
                raise JobCancelled()


class ОшибочныйМагазин(StoreProvider):
    """Магазин, который не должен вызываться."""

    name = "qobuz"

    async def download_track(
        self,
        track: TrackMetadata,
        destination: Path,
        *,
        quality: str | None = None,
        is_cancelled: callable | None = None,
    ) -> Path:
        raise AssertionError("Магазин не должен вызываться в этом тесте")


@pytest.fixture
def настройки(tmp_path: Path) -> StorageManager:
    """Возвращает менеджер хранения с временными путями."""

    папка_загрузок = tmp_path / "downloads"
    папка_конфига = tmp_path / "config"
    return StorageManager(
        папка_загрузок,
        папка_конфига,
        "{artist}/{album}/{track:02d} - {title}.{ext}",
    )


async def дождаться_завершения(сервис: DownloadService, job_id: str) -> JobSnapshot:
    """Ожидает финального статуса задачи через подписку."""

    очередь = сервис.subscribe_job(job_id)
    try:
        while True:
            снимок = await asyncio.wait_for(очередь.get(), timeout=2)
            if снимок.status in {
                JobStatus.COMPLETED.value,
                JobStatus.FAILED.value,
                JobStatus.CANCELLED.value,
            }:
                return снимок
    finally:
        сервис.unsubscribe_job(job_id, очередь)


@pytest.mark.asyncio
async def test_успешная_загрузка(настройки: StorageManager) -> None:
    """Проверяет полный цикл успешной задачи."""

    трек = TrackMetadata(
        title="Композиция",
        artists="Исполнитель",
        album="Альбом",
        external_url="https://example.com/track",
        isrc="TEST123",
        track_number=1,
    )
    плейлист = ЗаглушкаПлейлиста([трек])
    магазин = ФиксированныйМагазин()
    сервис = DownloadService(
        плейлист,
        {StoreType.QOBUZ: магазин},
        настройки,
    )

    await сервис.start()
    try:
        запрос = JobRequest(
            provider=ProviderType.SPOTIFY,
            store=StoreType.QOBUZ,
            url="https://open.spotify.com/playlist/1",
            quality="LOSSLESS",
            path_template="{artist}/{album}/{track:02d} - {title}.{ext}",
        )
        снимок = await сервис.submit_job(запрос)
        await asyncio.wait_for(магазин.завершено.wait(), timeout=2)
        финальный = await дождаться_завершения(сервис, снимок.id)

        ожидаемый_путь = (
            настройки.download_dir
            / "Исполнитель"
            / "Альбом"
            / "01 - Композиция.flac"
        )
        assert финальный.status == JobStatus.COMPLETED.value
        assert финальный.completed_tracks == 1
        assert финальный.failed_tracks == 0
        assert финальный.progress == pytest.approx(1.0, rel=1e-3)
        assert ожидаемый_путь.exists()
        assert магазин.вызовы and магазин.вызовы[0][2] == "LOSSLESS"
    finally:
        await сервис.stop()


@pytest.mark.asyncio
async def test_отмена_задачи(настройки: StorageManager) -> None:
    """Проверяет корректную обработку отмены."""

    трек = TrackMetadata(
        title="Композиция",
        artists="Исполнитель",
        album="Альбом",
        external_url="https://example.com/track",
        isrc="TEST123",
    )
    плейлист = ЗаглушкаПлейлиста([трек])
    магазин = МедленныйМагазин()
    сервис = DownloadService(
        плейлист,
        {StoreType.QOBUZ: магазин},
        настройки,
    )

    await сервис.start()
    try:
        запрос = JobRequest(
            provider=ProviderType.SPOTIFY,
            store=StoreType.QOBUZ,
            url="https://open.spotify.com/playlist/1",
            quality=None,
            path_template="",
        )
        снимок = await сервис.submit_job(запрос)
        await asyncio.wait_for(магазин.стартовал.wait(), timeout=2)
        assert сервис.cancel_job(снимок.id) is True

        финальный = await дождаться_завершения(сервис, снимок.id)
        assert финальный.status == JobStatus.CANCELLED.value
        assert финальный.error is None
        assert финальный.completed_tracks == 0
    finally:
        await сервис.stop()


@pytest.mark.asyncio
async def test_ошибка_провайдера_при_пустом_списке(настройки: StorageManager) -> None:
    """Проверяет ошибку при пустом списке треков."""

    плейлист = ЗаглушкаПлейлиста([])
    магазин = ОшибочныйМагазин()
    сервис = DownloadService(
        плейлист,
        {StoreType.QOBUZ: магазин},
        настройки,
    )

    await сервис.start()
    try:
        запрос = JobRequest(
            provider=ProviderType.SPOTIFY,
            store=StoreType.QOBUZ,
            url="https://open.spotify.com/playlist/1",
            quality=None,
            path_template="",
        )
        снимок = await сервис.submit_job(запрос)
        финальный = await дождаться_завершения(сервис, снимок.id)

        assert финальный.status == JobStatus.FAILED.value
        assert финальный.error == "Список треков пуст"
        assert финальный.total_tracks == 0
    finally:
        await сервис.stop()
