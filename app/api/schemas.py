"""Pydantic-схемы для REST API."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

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


class ProxySettingsModel(BaseModel):
    enabled: bool = Field(False, description="Активировать SOCKS5-прокси")
    host: str = Field("", description="Адрес прокси-сервера")
    port: Optional[int] = Field(None, description="Порт прокси", ge=1, le=65535)
    username: str = Field("", description="Имя пользователя для авторизации")
    password: str = Field("", description="Пароль для авторизации")

    @model_validator(mode="after")
    def validate_proxy(self) -> "ProxySettingsModel":
        """Проверяет наличие адреса и порта при включённом прокси."""

        if self.enabled:
            if not self.host.strip():
                raise ValueError("Укажите адрес прокси-сервера")
            if not self.port:
                raise ValueError("Укажите порт прокси-сервера")
        return self


class AppSettingsModel(BaseModel):
    proxy: ProxySettingsModel = Field(
        default_factory=ProxySettingsModel,
        description="Настройки доступа к Spotify",
    )
