# 🚀 SpotiFLAC v2.1.0 - Инструкции по развертыванию

## 📦 Docker образы

### Сборка образов
```bash
# Клонируйте репозиторий
git clone https://github.com/26rusreal/SpotiFLAC-Docker.git
cd SpotiFLAC-Docker

# Соберите образы
docker compose build

# Или соберите конкретные образы
docker build -t spotiflac-ui:v2.1.0 ./app/ui
docker build -t spotiflac-api:v2.1.0 ./app/api
```

### Запуск приложения
```bash
# Запустите все сервисы
docker compose up -d

# Проверьте статус
docker compose ps

# Просмотр логов
docker compose logs -f
```

## 🌐 Доступ к приложению

- **UI**: http://localhost:8083
- **API**: http://localhost:8080

## ⚙️ Конфигурация

### Переменные окружения
Создайте файл `.env` в корне проекта:

```env
# API настройки
API_PORT=8080
API_HOST=0.0.0.0

# UI настройки  
UI_PORT=8083
UI_HOST=0.0.0.0

# Настройки прокси (опционально)
PROXY_ENABLED=false
PROXY_HOST=
PROXY_PORT=1080
PROXY_USERNAME=
PROXY_PASSWORD=
```

### Настройка портов
Отредактируйте `docker-compose.yml` для изменения портов:

```yaml
services:
  ui:
    ports:
      - "8083:80"  # Измените 8083 на нужный порт
  api:
    ports:
      - "8080:8080"  # Измените 8080 на нужный порт
```

## 🔧 Управление

### Остановка
```bash
docker compose down
```

### Перезапуск
```bash
docker compose restart
```

### Обновление
```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```

### Просмотр логов
```bash
# Все сервисы
docker compose logs -f

# Только UI
docker compose logs -f ui

# Только API
docker compose logs -f api
```

## 🐛 Отладка

### Проверка контейнеров
```bash
docker compose ps
docker compose logs
```

### Проверка сетевого подключения
```bash
# Проверка UI
curl http://localhost:8083

# Проверка API
curl http://localhost:8080/api/settings
```

### Вход в контейнер
```bash
# UI контейнер
docker compose exec ui sh

# API контейнер
docker compose exec api sh
```

## 📋 Системные требования

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM (рекомендуется)
- 1GB свободного места

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи: `docker compose logs`
2. Убедитесь, что порты свободны
3. Проверьте системные требования
4. Создайте issue в репозитории

## 📝 Changelog v2.1.0

### ✨ Новые возможности
- Красиво оформленный заголовок с анимациями
- Трехцветный градиент с плавным переходом
- Анимированная музыкальная нота
- Подзаголовок с описанием приложения
- Hover эффекты и интерактивность

### 🎨 Улучшения дизайна
- Перемещен заголовок на уровень блоков задач
- Белый фон с современным дизайном
- Улучшенная цветовая схема
- Адаптивный дизайн для всех устройств

### 🔧 Технические улучшения
- Оптимизированные Docker образы
- Улучшенная производительность
- Стабильная работа без морганий
- Готовность к продакшену
