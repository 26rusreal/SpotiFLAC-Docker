# 🎵 SpotiFLAC v2.1.0 - Красивый UI с анимированным заголовком

Современная версия SpotiFLAC с красивым веб-интерфейсом и Docker-контейнерами:

* 🎨 **Красивый UI** - анимированный заголовок с градиентом и музыкальной нотой
* 🚀 **Docker-контейнеры** - простое развертывание через Docker Compose
* 🌐 **Веб-API** - FastAPI с очередями, логами и WebSocket
* ⚡ **Современный дизайн** - белый фон, адаптивная верстка, hover эффекты

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

## 🚀 Быстрый старт

### Docker Compose (рекомендуется)

```bash
# Клонируйте репозиторий
git clone https://github.com/26rusreal/SpotiFLAC-Docker.git
cd SpotiFLAC-Docker

# Запустите приложение
docker compose up -d

# Откройте в браузере
open http://localhost:8083
```

### Доступы по умолчанию

* **UI** — `http://localhost:8083` (красивый веб-интерфейс)
* **API** — `http://localhost:8080` (REST API)

### Управление

```bash
# Остановка
docker compose down

# Перезапуск
docker compose restart

# Просмотр логов
docker compose logs -f
```

## 📦 Docker образы

### GitHub Container Registry
- `ghcr.io/26rusreal/spotiflac-ui:v2.1.0` - UI с красивым дизайном
- `ghcr.io/26rusreal/spotiflac-api:v2.1.0` - API сервер

### Размеры
- UI: ~53MB (оптимизированный)
- API: ~632MB (с Python зависимостями)

### Production развертывание
```bash
# Использование готовых образов из GitHub Container Registry
docker compose -f docker-compose.prod.yml up -d
```

### Отправка образов
```bash
# Войти в GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u 26rusreal --password-stdin

# Отправить образы
./push-to-ghcr.sh
```

## Тесты и качество

* синтаксическая проверка: `python -m compileall app`;
* ручной прогон `python -m app.cli.main probe` перед запуском в контейнере.

## 📚 Документация

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Подробные инструкции по развертыванию
- **[RELEASE_v2.1.0.md](./RELEASE_v2.1.0.md)** - Информация о релизе v2.1.0
- **[PUBLISH_INSTRUCTIONS.md](./PUBLISH_INSTRUCTIONS.md)** - Инструкции по публикации

## 🆘 Поддержка

- **GitHub Issues**: [Создать issue](https://github.com/26rusreal/SpotiFLAC-Docker/issues)
- **Версии**: [Все релизы](https://github.com/26rusreal/SpotiFLAC-Docker/releases)

## 📋 Системные требования

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM (рекомендуется)
- 1GB свободного места

## Лицензия

Проект распространяется на условиях исходной лицензии репозитория SpotiFLAC.
