"""Хранение и валидация пользовательских настроек приложения."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Optional

from app.infra.settings import Settings


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
class AppSettings:
    """Контейнер пользовательских настроек приложения."""

    proxy: ProxySettings = field(default_factory=ProxySettings)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "AppSettings":
        """Создаёт объект из словаря."""

        proxy_payload = payload.get("proxy", {}) if isinstance(payload, dict) else {}
        return cls(proxy=ProxySettings.from_dict(proxy_payload))

    def to_dict(self) -> Dict[str, Any]:
        """Преобразует настройки в словарь."""

        return {"proxy": self.proxy.to_dict()}


class AppConfigRepository:
    """Менеджер чтения и записи настроек на диске."""

    def __init__(self, config_dir: Path) -> None:
        self._config_path = config_dir / "app-settings.json"
        self._lock = RLock()
        self._cached: Optional[AppSettings] = None

    @property
    def config_path(self) -> Path:
        """Полный путь к файлу с настройками."""

        return self._config_path

    def _ensure_loaded(self) -> AppSettings:
        if self._cached is not None:
            return self._cached
        if not self._config_path.exists():
            self._cached = AppSettings()
            return self._cached
        try:
            data = json.loads(self._config_path.read_text())
        except (OSError, ValueError):
            self._cached = AppSettings()
        else:
            self._cached = AppSettings.from_dict(data)
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

    def update_proxy(self, proxy: ProxySettings) -> AppSettings:
        """Обновляет только блок настроек прокси."""

        with self._lock:
            current = self._ensure_loaded()
            current.proxy = proxy
            return self._write(current)

    def build_requests_proxies(self) -> Optional[Dict[str, str]]:
        """Подготавливает параметры прокси для requests."""

        with self._lock:
            settings = self._ensure_loaded()
            return settings.proxy.as_requests_proxies()


_repo_lock = RLock()
_active_repo: Optional[AppConfigRepository] = None


def init_app_config(config_dir: Path) -> AppConfigRepository:
    """Создаёт и запоминает репозиторий настроек для указанной папки."""

    global _active_repo
    with _repo_lock:
        _active_repo = AppConfigRepository(config_dir)
        return _active_repo


def get_app_config() -> AppConfigRepository:
    """Возвращает активный репозиторий настроек."""

    global _active_repo
    with _repo_lock:
        if _active_repo is None:
            settings = Settings()
            _active_repo = AppConfigRepository(settings.config_dir)
        return _active_repo
