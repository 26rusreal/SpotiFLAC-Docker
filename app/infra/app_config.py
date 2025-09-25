"""Хранение и валидация пользовательских настроек приложения."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Optional

from app.core.models import DownloadMode
from app.infra.settings import Settings

DEFAULT_ARTIST_TEMPLATE = "{artist}/{album}/{track:02d} - {title}.{ext}"
DEFAULT_SINGLE_TEMPLATE = "{playlist}/{track:02d} - {artist} - {title}.{ext}"


@dataclass
class ProxySettings:
    """Параметры SOCKS5-прокси для Spotify."""

    enabled: bool = False
    host: str = ""
    port: int = 0
    username: str = ""
    password: str = ""

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "ProxySettings":
        """Создаёт объект из словаря."""

        return cls(
            enabled=bool(payload.get("enabled", False)),
            host=str(payload.get("host", "") or ""),
            port=int(payload.get("port") or 0),
            username=str(payload.get("username", "") or ""),
            password=str(payload.get("password", "") or ""),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Преобразует объект в сериализуемый словарь."""

        return {
            "enabled": self.enabled,
            "host": self.host,
            "port": self.port or None,
            "username": self.username,
            "password": self.password,
        }

    def as_requests_proxies(self) -> Optional[Dict[str, str]]:
        """Возвращает словарь для requests, если прокси настроен."""

        if not self.enabled:
            return None
        if not self.host or not self.port:
            return None
        credentials = ""
        if self.username:
            credentials = self.username
            if self.password:
                credentials += f":{self.password}"
            credentials += "@"
        address = f"socks5h://{credentials}{self.host}:{self.port}"
        return {"http": address, "https": address}


@dataclass
class DownloadSettings:
    """Параметры структуры каталогов загрузок."""

    mode: DownloadMode = DownloadMode.SINGLE_FOLDER
    by_artist_template: str = DEFAULT_ARTIST_TEMPLATE
    single_folder_template: str = DEFAULT_SINGLE_TEMPLATE

    @classmethod
    def from_dict(
        cls,
        payload: Dict[str, Any],
        defaults: Optional["DownloadSettings"] = None,
    ) -> "DownloadSettings":
        """Создаёт настройки из словаря с учётом значений по умолчанию."""

        base = defaults or cls()
        if not isinstance(payload, dict):
            return cls(
                mode=base.mode,
                by_artist_template=base.by_artist_template,
                single_folder_template=base.single_folder_template,
            )

        mode_value = payload.get("mode", base.mode.value)
        try:
            mode = DownloadMode(mode_value)
        except ValueError:
            mode = base.mode

        return cls(
            mode=mode,
            by_artist_template=str(payload.get("by_artist_template") or base.by_artist_template),
            single_folder_template=str(payload.get("single_folder_template") or base.single_folder_template),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Преобразует настройки в сериализуемый словарь."""

        return {
            "mode": self.mode.value,
            "by_artist_template": self.by_artist_template,
            "single_folder_template": self.single_folder_template,
            "active_template": self.active_template,
        }

    @property
    def active_template(self) -> str:
        """Возвращает шаблон, соответствующий текущему режиму."""

        if self.mode == DownloadMode.SINGLE_FOLDER:
            return self.single_folder_template
        return self.by_artist_template

    def with_mode(self, mode: DownloadMode) -> "DownloadSettings":
        """Создаёт копию настроек с новым режимом."""

        return DownloadSettings(
            mode=mode,
            by_artist_template=self.by_artist_template,
            single_folder_template=self.single_folder_template,
        )


@dataclass
class AppSettings:
    """Контейнер пользовательских настроек приложения."""

    proxy: ProxySettings = field(default_factory=ProxySettings)
    download: DownloadSettings = field(default_factory=DownloadSettings)

    @classmethod
    def from_dict(
        cls,
        payload: Dict[str, Any],
        defaults: Optional["AppSettings"] = None,
    ) -> "AppSettings":
        """Создаёт объект из словаря."""

        proxy_payload = payload.get("proxy", {}) if isinstance(payload, dict) else {}
        download_payload = payload.get("download", {}) if isinstance(payload, dict) else {}
        base = defaults or cls()
        return cls(
            proxy=ProxySettings.from_dict(proxy_payload),
            download=DownloadSettings.from_dict(download_payload, base.download),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Преобразует настройки в словарь."""

        return {
            "proxy": self.proxy.to_dict(),
            "download": self.download.to_dict(),
        }


class AppConfigRepository:
    """Менеджер чтения и записи настроек на диске."""

    def __init__(self, config_dir: Path, defaults: Optional[AppSettings] = None) -> None:
        self._config_path = config_dir / "app-settings.json"
        self._lock = RLock()
        self._cached: Optional[AppSettings] = None
        self._defaults = defaults or AppSettings()

    def _clone_defaults(self) -> AppSettings:
        """Возвращает копию настроек по умолчанию."""

        return AppSettings.from_dict(self._defaults.to_dict(), self._defaults)

    @property
    def config_path(self) -> Path:
        """Полный путь к файлу с настройками."""

        return self._config_path

    def _ensure_loaded(self) -> AppSettings:
        if self._cached is not None:
            return self._cached
        if not self._config_path.exists():
            self._cached = self._clone_defaults()
            return self._cached
        try:
            data = json.loads(self._config_path.read_text())
        except (OSError, ValueError):
            self._cached = self._clone_defaults()
        else:
            self._cached = AppSettings.from_dict(data, self._defaults)
        return self._cached

    def load(self) -> AppSettings:
        """Возвращает настройки, кэшируя результат."""

        with self._lock:
            return self._ensure_loaded()

    def _write(self, settings: AppSettings) -> AppSettings:
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        self._config_path.write_text(
            json.dumps(settings.to_dict(), ensure_ascii=False, indent=2)
        )
        self._cached = settings
        return settings

    def save(self, settings: AppSettings) -> AppSettings:
        """Сохраняет переданные настройки на диск."""

        with self._lock:
            return self._write(settings)

    def update(
        self,
        *,
        proxy: Optional[ProxySettings] = None,
        download: Optional[DownloadSettings] = None,
    ) -> AppSettings:
        """Обновляет отдельные секции настроек и сохраняет результат."""

        with self._lock:
            current = self._ensure_loaded()
            if proxy is not None:
                current.proxy = proxy
            if download is not None:
                current.download = download
            return self._write(current)

    def update_proxy(self, proxy: ProxySettings) -> AppSettings:
        """Обновляет только блок настроек прокси."""

        return self.update(proxy=proxy)

    def update_download(self, download: DownloadSettings) -> AppSettings:
        """Обновляет правила сохранения загрузок."""

        return self.update(download=download)

    def build_requests_proxies(self) -> Optional[Dict[str, str]]:
        """Подготавливает параметры прокси для requests."""

        with self._lock:
            settings = self._ensure_loaded()
            return settings.proxy.as_requests_proxies()


_repo_lock = RLock()
_active_repo: Optional[AppConfigRepository] = None


def init_app_config(config_dir: Path, *, settings: Optional[Settings] = None) -> AppConfigRepository:
    """Создаёт и запоминает репозиторий настроек для указанной папки."""

    base_settings = settings or Settings()
    defaults = AppSettings(
        proxy=ProxySettings(),
        download=DownloadSettings(
            mode=DownloadMode.BY_ARTIST,
            by_artist_template=base_settings.default_template or DEFAULT_ARTIST_TEMPLATE,
            single_folder_template=getattr(base_settings, "flat_template", DEFAULT_SINGLE_TEMPLATE) or DEFAULT_SINGLE_TEMPLATE,
        ),
    )

    global _active_repo
    with _repo_lock:
        _active_repo = AppConfigRepository(config_dir, defaults=defaults)
        return _active_repo


def get_app_config() -> AppConfigRepository:
    """Возвращает активный репозиторий настроек."""

    global _active_repo
    with _repo_lock:
        if _active_repo is None:
            settings = Settings()
            _active_repo = init_app_config(settings.config_dir, settings=settings)
        return _active_repo
