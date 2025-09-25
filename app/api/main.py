"""FastAPI-приложение для управления загрузками."""
from __future__ import annotations

from dataclasses import asdict
from typing import Dict

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from app.api.schemas import (
    AppSettingsModel,
    FileItem,
    FilesResponse,
    JobCreateRequest,
    JobModel,
    JobResponse,
    JobsListResponse,
    ProvidersResponse,
    TokenPayload,
)
from app.core.factory import create_service
from app.core.service import JobRequest
from app.infra.app_config import DownloadSettings, ProxySettings
from app.infra.settings import Settings

settings = Settings()
service = create_service(settings)
app = FastAPI(title="SpotiFLAC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def snapshot_to_model(snapshot) -> JobModel:
    return JobModel(**asdict(snapshot))


@app.on_event("startup")
async def startup() -> None:
    await service.start()


@app.on_event("shutdown")
async def shutdown() -> None:
    await service.stop()


@app.get("/healthz")
async def healthz() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> Dict[str, str]:
    return {"status": "ready" if service.started else "starting"}


@app.get("/settings", response_model=AppSettingsModel)
async def get_settings() -> AppSettingsModel:
    """Возвращает текущие пользовательские настройки."""

    data = service.get_settings()
    return AppSettingsModel(**data)


@app.put("/settings", response_model=AppSettingsModel)
async def update_settings(payload: AppSettingsModel) -> AppSettingsModel:
    """Сохраняет настройки прокси и возвращает актуальные значения."""

    proxy_settings = None
    if "proxy" in payload.model_fields_set:
        proxy_settings = ProxySettings(
            enabled=payload.proxy.enabled,
            host=payload.proxy.host,
            port=payload.proxy.port or 0,
            username=payload.proxy.username,
            password=payload.proxy.password,
        )

    download_settings = None
    if "download" in payload.model_fields_set:
        download_settings = DownloadSettings(
            mode=payload.download.mode,
            by_artist_template=payload.download.by_artist_template,
            single_folder_template=payload.download.single_folder_template,
        )

    updated = service.update_settings(
        proxy=proxy_settings,
        download=download_settings,
    )
    return AppSettingsModel(**updated)


@app.get("/metrics")
async def metrics() -> PlainTextResponse:
    jobs = service.list_jobs()
    lines = ["# HELP spotiflac_jobs_total Количество задач", "# TYPE spotiflac_jobs_total gauge", f"spotiflac_jobs_total {len(jobs)}"]
    return PlainTextResponse("\n".join(lines))


@app.get("/providers", response_model=ProvidersResponse)
async def providers() -> ProvidersResponse:
    data = service.get_providers()
    return ProvidersResponse(**data)


@app.post("/auth/{provider}")
async def save_tokens(provider: str, payload: TokenPayload) -> Dict[str, str]:
    path = service.storage.save_tokens(provider, payload.data)
    return {"stored": str(path)}


@app.post("/jobs", response_model=JobResponse)
async def create_job(request: JobCreateRequest) -> JobResponse:
    job_request = JobRequest(
        provider=request.provider,
        store=request.store,
        url=request.url,
        quality=request.quality,
        path_template=request.path_template,
    )
    snapshot = await service.submit_job(job_request)
    return JobResponse(job=snapshot_to_model(snapshot))


@app.get("/jobs", response_model=JobsListResponse)
async def list_jobs() -> JobsListResponse:
    snapshots = service.list_jobs()
    return JobsListResponse(jobs=[snapshot_to_model(s) for s in snapshots])


@app.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str) -> JobResponse:
    snapshot = service.get_job(job_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return JobResponse(job=snapshot_to_model(snapshot))


@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str) -> Dict[str, object]:
    cancelled = service.cancel_job(job_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return {"cancelled": True}


@app.get("/files", response_model=FilesResponse)
async def list_files() -> FilesResponse:
    files = [FileItem(**item) for item in service.get_files()]
    return FilesResponse(files=files)


@app.websocket("/ws/progress")
async def progress_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    queue = service.subscribe_global()
    try:
        while True:
            snapshot = await queue.get()
            await websocket.send_json(asdict(snapshot))
    except WebSocketDisconnect:
        pass
    finally:
        service.unsubscribe_global(queue)


@app.get("/jobs/{job_id}/logs")
async def job_logs(job_id: str) -> JSONResponse:
    snapshot = service.get_job(job_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return JSONResponse({"logs": snapshot.logs})
