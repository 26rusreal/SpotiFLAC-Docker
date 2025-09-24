"""Обёртка Spotify для нового интерфейса."""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional

from app.core.exceptions import ProviderError
from app.core.interfaces import PlaylistProvider
from app.core.models import ResolvedSource, TrackMetadata

from .spotify import (
    SpotifyInvalidUrlException,
    get_filtered_data,
    parse_uri,
)


class SpotifyPlaylistProvider(PlaylistProvider):
    """Провайдер плейлистов Spotify на основе существующего парсера."""

    def __init__(self, batch_delay: float = 0.2) -> None:
        self.batch_delay = batch_delay

    async def resolve(self, url: str) -> ResolvedSource:
        info = parse_uri(url)
        batch = info.get("type") in {"playlist", "artist_discography"}
        loop = asyncio.get_running_loop()
        try:
            data = await loop.run_in_executor(None, get_filtered_data, url, batch, self.batch_delay)
        except SpotifyInvalidUrlException as exc:  # noqa: PERF203
            raise ProviderError(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(f"Не удалось получить данные Spotify: {exc}") from exc

        if not data or "error" in data:
            raise ProviderError(data.get("error", "Неизвестная ошибка Spotify"))

        tracks = self._extract_tracks(data)
        name = self._extract_name(info.get("type"), data)
        return ResolvedSource(
            source_url=url,
            source_type=info.get("type", "unknown"),
            name=name,
            tracks=tracks,
        )

    def _extract_tracks(self, data: Dict[str, object]) -> List[TrackMetadata]:
        raw_tracks: List[Dict[str, object]] = []
        if "track_list" in data:
            raw_tracks = data.get("track_list", [])  # type: ignore[assignment]
        elif "track" in data:
            raw_tracks = [data.get("track", {})]  # type: ignore[list-item]

        tracks: List[TrackMetadata] = []
        for item in raw_tracks:
            if not isinstance(item, dict):
                continue
            tracks.append(
                TrackMetadata(
                    title=str(item.get("name", "")),
                    artists=str(item.get("artists", "")),
                    album=str(item.get("album_name", "")),
                    external_url=str(item.get("external_urls", "")),
                    isrc=str(item.get("isrc", "")),
                    duration_ms=int(item.get("duration_ms", 0) or 0),
                    track_number=(item.get("track_number") or None),
                    release_date=str(item.get("release_date", "")) or None,
                )
            )
        return tracks

    def _extract_name(self, data_type: Optional[str], data: Dict[str, object]) -> Optional[str]:
        if data_type == "playlist":
            playlist_info = data.get("playlist_info", {})
            if isinstance(playlist_info, dict):
                owner = playlist_info.get("owner", {})
                if isinstance(owner, dict):
                    return owner.get("name") or playlist_info.get("name")
        if data_type == "album":
            album_info = data.get("album_info", {})
            if isinstance(album_info, dict):
                return album_info.get("name")
        if data_type == "track":
            track = data.get("track", {})
            if isinstance(track, dict):
                return track.get("name")
        if data_type == "artist_discography":
            artist = data.get("artist_info", {})
            if isinstance(artist, dict):
                return artist.get("name")
        if data_type == "artist":
            artist = data.get("artist", {})
            if isinstance(artist, dict):
                return artist.get("name")
        return None
