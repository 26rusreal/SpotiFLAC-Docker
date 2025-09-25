"""Основной сервис управления заданиями и очередью загрузок."""
from __future__ import annotations

import asyncio
import contextlib
import shutil
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .exceptions import JobCancelled, ProviderError
from .interfaces import PlaylistProvider, StoreProvider
from .models import (
    DownloadJob,
    DownloadMode,
    FileEntry,
    JobSnapshot,
    JobStatus,
    ProviderType,
    ResolvedSource,
    StoreType,
    TrackMetadata,
)
from .utils import clamp_progress
from app.infra.app_config import (
    AppConfigRepository,
    DownloadSettings,
    ProxySettings,
    get_app_config,
)
from app.infra.storage import StorageManager


@dataclass
class JobRequest:
    """Параметры создания новой задачи."""

    provider: ProviderType
    store: StoreType
    url: str
    quality: Optional[str]
    path_template: Optional[str]


class JobState:
    """Внутреннее состояние задачи."""

    def __init__(self, job: DownloadJob) -> None:
        self.job = job
        self.subscribers: List[asyncio.Queue] = []
        self.cancel_requested = False

    def snapshot(self) -> JobSnapshot:
        return self.job.snapshot()

    def notify(self) -> None:
        snapshot = self.snapshot()
        for queue in list(self.subscribers):
            try:
                queue.put_nowait(snapshot)
            except asyncio.QueueFull:
                self.subscribers.remove(queue)


class DownloadService:
    """Оркестратор загрузок."""

    def __init__(
        self,
        playlist_provider: PlaylistProvider,
        store_providers: Dict[StoreType, StoreProvider],
        storage: StorageManager,
        config_repo: AppConfigRepository | None,
        *,
        worker_concurrency: int = 1,
    ) -> None:
        self.playlist_provider = playlist_provider
        self.store_providers = store_providers
        self.storage = storage
        self.config_repo = config_repo or get_app_config()
        self.worker_concurrency = max(1, worker_concurrency)

        self._jobs: Dict[str, JobState] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._global_subscribers: List[asyncio.Queue] = []
        self._workers: List[asyncio.Task] = []
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        self.storage.ensure_directories()
        self._workers = [
            asyncio.create_task(self._worker(), name=f"job-worker-{i}")
            for i in range(self.worker_concurrency)
        ]
        self._started = True

    @property
    def started(self) -> bool:
        return self._started

    async def stop(self) -> None:
        if not self._started:
            return
        for worker in self._workers:
            worker.cancel()
        for worker in self._workers:
            with contextlib.suppress(asyncio.CancelledError):
                await worker
        self._workers.clear()
        self._started = False

    async def submit_job(self, request: JobRequest) -> JobSnapshot:
        if not self._started:
            raise RuntimeError("Сервис не запущен")

        job_id = uuid.uuid4().hex
        template, mode = self._resolve_template(request)

        job = DownloadJob(
            id=job_id,
            provider=request.provider,
            store=request.store,
            source_url=request.url,
            quality=request.quality,
            path_template=template,
            output_dir=str(self.storage.download_dir),
            mode=mode,
        )
        state = JobState(job)
        self._jobs[job_id] = state
        state.notify()
        self._broadcast(state)
        await self._queue.put(job_id)
        return state.snapshot()

    def get_job(self, job_id: str) -> Optional[JobSnapshot]:
        state = self._jobs.get(job_id)
        return state.snapshot() if state else None

    def list_jobs(self) -> List[JobSnapshot]:
        return [state.snapshot() for state in self._jobs.values()]

    def subscribe_job(self, job_id: str) -> asyncio.Queue:
        state = self._jobs.get(job_id)
        if not state:
            raise KeyError(job_id)
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        state.subscribers.append(queue)
        queue.put_nowait(state.snapshot())
        return queue

    def unsubscribe_job(self, job_id: str, queue: asyncio.Queue) -> None:
        state = self._jobs.get(job_id)
        if not state:
            return
        with contextlib.suppress(ValueError):
            state.subscribers.remove(queue)

    def subscribe_global(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._global_subscribers.append(queue)
        for state in self._jobs.values():
            queue.put_nowait(state.snapshot())
        return queue

    def unsubscribe_global(self, queue: asyncio.Queue) -> None:
        with contextlib.suppress(ValueError):
            self._global_subscribers.remove(queue)

    def cancel_job(self, job_id: str) -> bool:
        state = self._jobs.get(job_id)
        if not state:
            return False
        state.cancel_requested = True
        state.job.message = "Отмена запрошена пользователем"
        state.job.touch()
        state.notify()
        self._broadcast(state)
        return True

    async def _worker(self) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                state = self._jobs.get(job_id)
                if not state:
                    continue
                job = state.job
                if job.status not in {JobStatus.PENDING, JobStatus.FAILED}:
                    continue

                job.status = JobStatus.RUNNING
                job.touch()
                state.notify()
                self._broadcast(state)

                try:
                    await self._execute_job(state)
                except JobCancelled:
                    job.status = JobStatus.CANCELLED
                    job.message = "Задача отменена"
                    job.finished_at = datetime.utcnow()
                    job.touch()
                except Exception as exc:  # noqa: BLE001
                    job.status = JobStatus.FAILED
                    job.error = str(exc)
                    job.finished_at = datetime.utcnow()
                    job.touch()
                else:
                    job.status = JobStatus.COMPLETED
                    job.finished_at = datetime.utcnow()
                    job.touch()

                state.notify()
                self._broadcast(state)
            finally:
                self._queue.task_done()

    async def _execute_job(self, state: JobState) -> None:
        job = state.job
        store = self.store_providers.get(job.store)
        if not store:
            raise ProviderError(f"Провайдер {job.store.value} недоступен")

        resolved = await self.playlist_provider.resolve(job.source_url)
        tracks = resolved.tracks
        if not tracks:
            raise ProviderError("Список треков пуст")

        job.total_tracks = len(tracks)
        job.message = resolved.name or resolved.source_type
        job.collection_name = resolved.name or None
        job.output_dir = str(self.storage.download_dir)
        job.touch()
        state.notify()
        self._broadcast(state)

        for track in tracks:
            if state.cancel_requested:
                raise JobCancelled()
            if not track.isrc:
                job.failed_tracks += 1
                job.touch()
                state.notify()
                self._broadcast(state)
                continue

            final_path = self.storage.build_track_path(job, track)
            final_path.parent.mkdir(parents=True, exist_ok=True)
            if final_path.exists():
                job.completed_tracks += 1
                job.progress = clamp_progress(job.completed_tracks, job.total_tracks)
                job.touch()
                state.notify()
                self._broadcast(state)
                continue

            try:
                downloaded = await store.download_track(
                    track,
                    final_path.parent,
                    quality=job.quality,
                    is_cancelled=lambda: state.cancel_requested,
                )
                downloaded_path = Path(downloaded)
                if downloaded_path != final_path:
                    shutil.move(downloaded_path, final_path)
                job.completed_tracks += 1
                relative_path = str(final_path.relative_to(self.storage.download_dir))
                if relative_path not in job.downloaded_files:
                    job.downloaded_files.append(relative_path)
            except JobCancelled:
                raise
            except Exception:  # noqa: BLE001
                job.failed_tracks += 1
            finally:
                job.progress = clamp_progress(job.completed_tracks, job.total_tracks)
                job.touch()
                state.notify()
                self._broadcast(state)

    def _broadcast(self, state: JobState) -> None:
        snapshot = state.snapshot()
        for queue in list(self._global_subscribers):
            try:
                queue.put_nowait(snapshot)
            except asyncio.QueueFull:
                self._global_subscribers.remove(queue)

    def get_files(self) -> List[Dict[str, object]]:
        return [entry.to_dict() for entry in self.storage.list_downloads()]

    def get_history(self) -> List[Dict[str, object]]:
        jobs = sorted(
            self._jobs.values(),
            key=lambda state: state.job.created_at,
            reverse=True,
        )
        history: List[Dict[str, object]] = []
        for state in jobs:
            job = state.job
            history.append(
                {
                    "job_id": job.id,
                    "playlist": job.collection_name or job.message or job.source_url,
                    "status": job.status.value,
                    "created_at": job.created_at.isoformat(),
                    "finished_at": job.finished_at.isoformat() if job.finished_at else None,
                    "total_tracks": job.total_tracks,
                    "completed_tracks": job.completed_tracks,
                    "failed_tracks": job.failed_tracks,
                }
            )
        return history

    def get_job_files(self, job_id: str) -> List[Dict[str, object]]:
        state = self._jobs.get(job_id)
        if not state:
            return []
        files: List[Dict[str, object]] = []
        seen: set[str] = set()
        for relative in state.job.downloaded_files:
            if not relative or relative in seen:
                continue
            seen.add(relative)
            path = self.storage.download_dir / relative
            if not path.exists() or not path.is_file():
                continue
            stat = path.stat()
            entry = FileEntry(
                path=Path(relative),
                size_bytes=stat.st_size,
                modified_at=datetime.utcfromtimestamp(stat.st_mtime),
            )
            files.append(entry.to_dict())
        files.sort(key=lambda item: item["path"])
        return files

    def get_providers(self) -> Dict[str, object]:
        return {
            "playlists": [job_provider.value for job_provider in ProviderType],
            "stores": [store.value for store in self.store_providers.keys()],
        }

    def get_settings(self) -> Dict[str, object]:
        """Возвращает сохранённые настройки приложения."""

        return self.config_repo.load().to_dict()

    def update_settings(
        self,
        proxy: ProxySettings | None = None,
        download: DownloadSettings | None = None,
    ) -> Dict[str, object]:
        """Обновляет параметры приложения и возвращает новые значения."""

        if proxy is None and download is None:
            return self.get_settings()

        updated = self.config_repo.update(proxy=proxy, download=download)
        return updated.to_dict()

    def _resolve_template(self, request: JobRequest) -> tuple[str, DownloadMode]:
        """Определяет шаблон пути для новой задачи."""

        settings = self.config_repo.load()

        if request.path_template and request.path_template.strip():
            return request.path_template.strip(), settings.download.mode

        template = settings.download.active_template or self.storage.default_template
        return (template or self.storage.default_template, settings.download.mode)
