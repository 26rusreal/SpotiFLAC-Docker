# SpotiFLAC API v1

Документ описывает REST- и WebSocket-интерфейсы, предоставляемые сервисом SpotiFLAC. Он предназначен для интеграции с внешними сервисами, автоматизацией и созданием собственных пользовательских интерфейсов.

## Базовая информация

* Базовый URL: `http://<host>:8080`
* Все ответы — в формате JSON (если не указано иное).
* Время указано в формате ISO 8601 UTC.
* CORS открыт для всех доменов (`Access-Control-Allow-Origin: *`).

## Структура настроек

```jsonc
{
  "proxy": {
    "enabled": false,
    "host": "",
    "port": null,
    "username": "",
    "password": ""
  },
  "download": {
    "mode": "by_artist",          // или "single_folder"
    "active_template": "{artist}/{album}/{track:02d} - {title}.{ext}",
    "by_artist_template": "{artist}/{album}/{track:02d} - {title}.{ext}",
    "single_folder_template": "{artist} - {album} - {track:02d} - {title}.{ext}"
  }
}
```

Поле `active_template` вычисляется автоматически на основе выбранного режима и служит для отображения. При сохранении настроек достаточно передать значения `mode`, `by_artist_template` и `single_folder_template`.

## Эндпоинты настроек

### `GET /settings`

Возвращает сохранённые настройки прокси и режима сохранения файлов. В случае отсутствия файла конфигурации применяется окружение контейнера (`PATH_TEMPLATE`, `PATH_TEMPLATE_FLAT`).

### `PUT /settings`

Обновляет настройки. Тело запроса соответствует структуре, описанной выше. Можно передавать только одну из секций (`proxy` или `download`) — отсутствующие поля не изменяются.

Пример запроса для переключения режима на «в одну папку»:

```http
PUT /settings
Content-Type: application/json

{
  "download": {
    "mode": "single_folder"
  }
}
```

Ответ содержит полную структуру настроек с вычисленным `active_template`.

## Задачи загрузки

### `POST /jobs`

Создаёт задачу на загрузку.

```json
{
  "provider": "spotify",
  "store": "qobuz",
  "url": "https://open.spotify.com/album/...",
  "quality": "LOSSLESS",
  "path_template": "{artist} - {title}.{ext}"
}
```

Параметр `path_template` необязателен. При пустом значении используется `download.active_template` из настроек.

Ответ:

```json
{
  "job": {
    "id": "4d9c6ce6d2a44d00a67e77f6a31d54dd",
    "status": "pending",
    "progress": 0.0,
    "total_tracks": 0,
    "completed_tracks": 0,
    "failed_tracks": 0,
    "provider": "spotify",
    "store": "qobuz",
    "source_url": "https://open.spotify.com/album/...",
    "quality": "LOSSLESS",
    "path_template": "{artist} - {title}.{ext}",
    "output_dir": "/downloads",
    "logs": [],
    "created_at": "2024-06-01T09:10:00.000000",
    "updated_at": "2024-06-01T09:10:00.000000",
    "finished_at": null,
    "message": null,
    "error": null
  }
}
```

### `GET /jobs`

Возвращает массив всех задач (активных и завершённых). Для постраничной навигации можно фильтровать на клиенте — API отдаёт полный список.

### `GET /jobs/{id}`

Получает детальное описание задачи по идентификатору. При отсутствии возвращает `404`.

### `DELETE /jobs/{id}`

Отменяет выполнение. В случае успеха — `{ "cancelled": true }`.

### `GET /jobs/{id}/logs`

Возвращает массив строк с логами в порядке появления. Для потокового получения логов используйте WebSocket.

## Списки и метаданные

### `GET /providers`

Содержит два массива: `playlists` (поддерживаемые источники) и `stores` (магазины загрузки).

### `GET /files`

Возвращает массив объектов `{ "path": "...", "size": 1234, "modified_at": "..." }` из каталога `/downloads`, отсортированных по дате.

### `POST /auth/{provider}`

Сохраняет токены/куки провайдера. В теле запроса передаётся объект `{ "data": { ... } }`, который записывается в `/config/providers/<provider>.json`.

## Служебные эндпоинты

* `GET /healthz` — готовность контейнера.
* `GET /readyz` — статус очереди ("ready" или "starting").
* `GET /metrics` — метрика `spotiflac_jobs_total` в формате Prometheus.

## WebSocket: `GET /ws/progress`

Позволяет получать обновления задач в реальном времени. Сообщения идентичны объекту `job` в REST-ответах.

```json
{
  "id": "4d9c6ce6d2a44d00a67e77f6a31d54dd",
  "status": "running",
  "progress": 0.45,
  "completed_tracks": 9,
  "total_tracks": 20,
  "logs": ["Старт загрузки", "Загружен трек 9/20"]
}
```

Соединение можно открывать как из браузера, так и из серверного приложения. URL формируется из базового адреса API, заменяя протокол `http`/`https` на `ws`/`wss`.

## Типичные сценарии интеграции

1. Получить доступные магазины (`GET /providers`).
2. Настроить прокси/структуру файлов (`PUT /settings`).
3. Отправить задачу (`POST /jobs`).
4. Подписаться на WebSocket для мониторинга прогресса.
5. После завершения задачи запросить `GET /files` для отображения результатов.

## Коды ошибок

* `400 Bad Request` — ошибка валидации данных (например, отсутствует URL или неверный порт прокси).
* `404 Not Found` — запрошенный ресурс отсутствует.
* `500 Internal Server Error` — неожиданные ошибки внутри сервиса.

Рекомендуется обрабатывать текст сообщения (`detail`) в теле ответа для отображения пользователю.
