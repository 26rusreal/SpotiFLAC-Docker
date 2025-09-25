# SpotiFLAC Headless

Новая версия SpotiFLAC работает без графического интерфейса и состоит из трёх основных частей:

* библиотека и CLI для запуска загрузок напрямую из терминала;
* веб-API на FastAPI с очередями, логами и подпиской по WebSocket;
* современная панель управления на Vite + React.

## Основные возможности

* загрузка треков/альбомов/плейлистов Spotify через Qobuz, Tidal, Deezer и Amazon;
* тегирование и переименование по шаблону `{artist}/{album}/{track:02d} - {title}.{ext}`;
* хранение конфигурации и токенов в каталоге `/config`, файлов — в `/downloads`;
* выбор структуры каталога загрузок: по артистам или в одну папку;
* live-прогресс задач через WebSocket и обновляемый список файлов;
* сборка через Docker/Docker Compose для API и UI.

## Структура проекта

```
app/
  adapters/      # адаптеры провайдеров (Spotify, Qobuz, Tidal, Deezer, Amazon)
  api/           # FastAPI-приложение и схемы
  cli/           # Typer CLI
  core/          # бизнес-логика, очередь и модели
  infra/         # настройки, логирование, работа с файловой системой
  ui/            # фронтенд (Vite + React)
  requirements.txt
```

## Установка зависимостей

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r app/requirements.txt
```

Для фронтенда используйте Node 20 и `npm install` внутри каталога `app/ui`.

## CLI

CLI доступен командой `python -m app.cli.main`.

```bash
# Проверить окружение (ffmpeg, каталоги)
python -m app.cli.main probe

# Сохранить токены (например, Qobuz)
python -m app.cli.main login qobuz --data '{"user_auth_token": "..."}'

# Запустить загрузку
python -m app.cli.main fetch \
  "https://open.spotify.com/album/..." \
  --store qobuz \
  --quality 24-bit
```

Во время выполнения отображается прогресс, количество треков и последние события лога.

## Веб-API

Полное описание схем, запросов и форматов ответов доступно в [docs/API.md](docs/API.md).

* `POST /auth/{provider}` — сохранить токены провайдера;
* `GET /providers` — список доступных источников и магазинов;
* `POST /jobs` — создать задачу (`provider`, `store`, `url`, опционально `quality`, `path_template`);
* `GET /jobs`, `GET /jobs/{id}` — список и детали задач;
* `DELETE /jobs/{id}` — отменить задачу;
* `GET /jobs/{id}/logs` — последние записи лога;
* `GET /files` — список выгруженных файлов;
* `GET /settings` / `PUT /settings` — получить или обновить прокси и режим сохранения файлов;
* `GET /healthz`, `/readyz`, `/metrics` — служебные эндпоинты;
* `WS /ws/progress` — live-обновления задач.

## Панель управления

Фронтенд на Vite/React предоставляет формы для создания задач, сохранения токенов, мониторинга очереди, просмотра логов и последних файлов. Базовый URL API задаётся переменной окружения `VITE_API_BASE` (по умолчанию `/api`).

### Локальный запуск UI

```bash
cd app/ui
npm install
npm run dev -- --host
```

## Docker

Собрать и запустить весь стек можно через `docker compose`:

```bash
docker compose build
docker compose up
```

Доступы по умолчанию:

* API — `http://localhost:8080`;
* UI — `http://localhost:8081` (проксирует запросы `/api` и WebSocket к API).

Каталоги `./data/downloads` и `./data/config` проброшены в контейнеры, поэтому файлы и токены сохраняются между перезапусками.

## Тесты и качество

* синтаксическая проверка: `python -m compileall app`;
* ручной прогон `python -m app.cli.main probe` перед запуском в контейнере.

## Лицензия

Проект распространяется на условиях исходной лицензии репозитория SpotiFLAC.
