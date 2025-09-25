"""Pydantic-схемы для REST API."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

from app.core.models import DownloadMode, ProviderType, StoreType
from app.infra.app_config import DEFAULT_ARTIST_TEMPLATE, DEFAULT_SINGLE_TEMPLATE


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
    mode: str
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
    downloaded_files: List[str]
    collection_name: Optional[str]


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


class HistoryItem(BaseModel):
    job_id: str
    playlist: str
    status: str
    created_at: str
    finished_at: Optional[str]
    total_tracks: int
    completed_tracks: int
    failed_tracks: int


class HistoryResponse(BaseModel):
    history: List[HistoryItem]


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


class DownloadSettingsModel(BaseModel):
    mode: DownloadMode = Field(
        default=DownloadMode.BY_ARTIST,
        description="Режим построения структуры каталогов",
    )
    active_template: str = Field(
        default=DEFAULT_ARTIST_TEMPLATE,
        description="Текущий шаблон с учётом выбранного режима",
    )
    by_artist_template: str = Field(
        default=DEFAULT_ARTIST_TEMPLATE,
        description="Шаблон для группировки по артистам",
    )
    single_folder_template: str = Field(
        default=DEFAULT_SINGLE_TEMPLATE,
        description="Шаблон для сохранения всех файлов в одной папке",
    )

    @model_validator(mode="after")
    def ensure_active_template(self) -> "DownloadSettingsModel":
        """Синхронизирует активный шаблон с выбранным режимом."""

        target = (
            self.single_folder_template
            if self.mode == DownloadMode.SINGLE_FOLDER
            else self.by_artist_template
        )
        object.__setattr__(self, "active_template", target)
        return self


class AppSettingsModel(BaseModel):
    proxy: ProxySettingsModel = Field(
        default_factory=ProxySettingsModel,
        description="Настройки доступа к Spotify",
    )
    download: DownloadSettingsModel = Field(
        default_factory=DownloadSettingsModel,
        description="Правила сохранения загруженных файлов",
    )
