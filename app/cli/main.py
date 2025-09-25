"""CLI-интерфейс на базе Typer."""
from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path
from typing import Optional

import typer

from app.core.factory import create_service
from app.core.models import JobStatus, ProviderType, StoreType
from app.core.service import JobRequest
from app.infra.settings import Settings
from app.infra.storage import StorageManager

app = typer.Typer(help="Инструмент загрузки треков из потоковых сервисов")


def _parse_provider(value: str) -> ProviderType:
    try:
        return ProviderType(value)
    except ValueError as exc:
        raise typer.BadParameter(f"Неизвестный провайдер: {value}") from exc


def _parse_store(value: str) -> StoreType:
    try:
        return StoreType(value)
    except ValueError as exc:
        raise typer.BadParameter(f"Неизвестный магазин: {value}") from exc


async def _watch_job(service, job_id: str) -> JobStatus:
    queue = service.subscribe_job(job_id)
    try:
        while True:
            snapshot = await queue.get()
            typer.echo(
                f"[{snapshot.status}] {snapshot.progress * 100:.1f}% "
                f"({snapshot.completed_tracks}/{snapshot.total_tracks})",
            )
            if snapshot.status in {
                JobStatus.COMPLETED.value,
                JobStatus.FAILED.value,
                JobStatus.CANCELLED.value,
            }:
                return JobStatus(snapshot.status)
    finally:
        service.unsubscribe_job(job_id, queue)


@app.command()
def fetch(
    url: str = typer.Argument(..., help="Ссылка на плейлист/альбом/трек Spotify"),
    store: str = typer.Option("qobuz", help="Магазин для загрузки"),
    provider: str = typer.Option("spotify", help="Источник метаданных"),
    quality: Optional[str] = typer.Option(None, help="Желаемое качество (если поддерживается)"),
    path_template: Optional[str] = typer.Option(None, help="Шаблон пути сохранения"),
) -> None:
    """Создаёт задачу на загрузку и отслеживает её завершение."""

    settings = Settings()
    service = create_service(settings)

    async def runner() -> JobStatus:
        await service.start()
        try:
            request = JobRequest(
                provider=_parse_provider(provider),
                store=_parse_store(store),
                url=url,
                quality=quality,
                path_template=path_template,
            )
            snapshot = await service.submit_job(request)
            return await _watch_job(service, snapshot.id)
        finally:
            await service.stop()

    status = asyncio.run(runner())
    if status is JobStatus.COMPLETED:
        typer.secho("Задача выполнена", fg=typer.colors.GREEN)
    elif status is JobStatus.FAILED:
        typer.secho("Задача завершилась ошибкой", fg=typer.colors.RED)
    else:
        typer.secho("Задача отменена", fg=typer.colors.YELLOW)


@app.command()
def login(
    provider: str = typer.Argument(..., help="Название магазина/сервиса"),
    file: Optional[Path] = typer.Option(None, "--file", "-f", help="Путь до JSON с токенами"),
    data: Optional[str] = typer.Option(None, "--data", "-d", help="JSON-строка с токенами"),
) -> None:
    """Сохраняет токены доступа для провайдера."""

    if not file and not data:
        raise typer.BadParameter("Необходимо указать --file или --data")

    if file:
        payload = json.loads(file.read_text())
    else:
        payload = json.loads(data or "{}")

    settings = Settings()
    storage = StorageManager(settings.download_dir, settings.config_dir, settings.default_template)
    path = storage.save_tokens(provider, payload)
    typer.echo(f"Токены сохранены в {path}")


@app.command()
def probe() -> None:
    """Проверяет зависимости и права доступа."""

    settings = Settings()
    ok = True

    if shutil.which("ffmpeg"):
        typer.secho("ffmpeg найден", fg=typer.colors.GREEN)
    else:
        typer.secho("ffmpeg не найден", fg=typer.colors.RED)
        ok = False

    for path in [settings.download_dir, settings.config_dir]:
        try:
            path.mkdir(parents=True, exist_ok=True)
            typer.secho(f"Каталог доступен: {path}", fg=typer.colors.GREEN)
        except Exception as exc:  # noqa: BLE001
            typer.secho(f"Ошибка доступа к {path}: {exc}", fg=typer.colors.RED)
            ok = False

    raise typer.Exit(code=0 if ok else 1)


if __name__ == "__main__":  # pragma: no cover
    app()
