"""Вспомогательные функции для работы с путями и асинхронными очередями."""
from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import AsyncIterator, Dict

INVALID_PATH_CHARS = re.compile(r'[<>:"/\\|?*]')
MULTI_SPACES = re.compile(r"\s+")


def sanitize_component(value: str) -> str:
    """Очищает часть пути от недопустимых символов."""

    clean = INVALID_PATH_CHARS.sub("_", value)
    clean = clean.replace("..", "_")
    return MULTI_SPACES.sub(" ", clean).strip() or "Unknown"


def render_path(template: str, context: Dict[str, object]) -> Path:
    """Генерирует путь относительно каталога загрузок."""

    safe_context: Dict[str, object] = {}
    for key, val in context.items():
        if isinstance(val, str):
            safe_context[key] = sanitize_component(val)
        else:
            safe_context[key] = val
    rendered = template.format(**safe_context)
    candidate = Path(rendered)
    if candidate.is_absolute():
        candidate = Path(*candidate.parts[1:])
    return candidate


def clamp_progress(done: int, total: int) -> float:
    """Возвращает прогресс от 0.0 до 1.0."""

    if total <= 0:
        return 0.0
    return max(0.0, min(1.0, done / total))


async def stream_queue(queue: asyncio.Queue) -> AsyncIterator:
    """Асинхронный генератор, возвращающий элементы из очереди."""

    try:
        while True:
            item = await queue.get()
            yield item
    except asyncio.CancelledError:
        return
