"""Pydantic-схемы для REST API."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.core.models import ProviderType, StoreType


class TokenPayload(BaseModel):
    data: Dict[str, object] = Field(..., description="Токены/куки провайдера")


class JobCreateRequest(BaseModel):
    provider: ProviderType = Field(..., description="Источник метаданных")
    store: StoreType = Field(..., description="Магазин для загрузки")
    url: str = Field(..., description="Ссылка на плейлист/альбом/трек Spotify")
    quality: Optional[str] = Field(None, description="Профиль качества")
    path_template: Optional[str] = Field(None, description="Шаблон пути сохранения")


class JobModel(BaseModel):
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


class JobResponse(BaseModel):
    job: JobModel


class JobsListResponse(BaseModel):
    jobs: List[JobModel]


class ProvidersResponse(BaseModel):
    playlists: List[str]
    stores: List[str]


class FileItem(BaseModel):
    path: str
    size: int
    modified_at: str


class FilesResponse(BaseModel):
    files: List[FileItem]
