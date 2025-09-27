#!/bin/bash

# Скрипт для публикации Docker образов SpotiFLAC v2.1.0

set -e

VERSION="v2.1.0"
REGISTRY="26rusreal"  # Замените на ваш Docker Hub username

echo "🚀 Публикация SpotiFLAC $VERSION"

# Проверяем, что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой директории проекта"
    exit 1
fi

# Собираем образы
echo "📦 Сборка Docker образов..."
docker compose build --no-cache

# Тегируем образы для публикации
echo "🏷️ Создание тегов..."
docker tag spotiflac-docker-ui:latest $REGISTRY/spotiflac-ui:$VERSION
docker tag spotiflac-docker-ui:latest $REGISTRY/spotiflac-ui:latest
docker tag spotiflac-docker-api:latest $REGISTRY/spotiflac-api:$VERSION
docker tag spotiflac-docker-api:latest $REGISTRY/spotiflac-api:latest

# Проверяем, что пользователь залогинен в Docker Hub
echo "🔐 Проверка авторизации Docker Hub..."
if ! docker info | grep -q "Username:"; then
    echo "❌ Ошибка: Необходимо войти в Docker Hub"
    echo "Выполните: docker login"
    exit 1
fi

# Публикуем образы
echo "📤 Публикация образов в Docker Hub..."

echo "Публикация UI образа..."
docker push $REGISTRY/spotiflac-ui:$VERSION
docker push $REGISTRY/spotiflac-ui:latest

echo "Публикация API образа..."
docker push $REGISTRY/spotiflac-api:$VERSION
docker push $REGISTRY/spotiflac-api:latest

echo "✅ Образы успешно опубликованы!"
echo ""
echo "🐳 Опубликованные образы:"
echo "  - $REGISTRY/spotiflac-ui:$VERSION"
echo "  - $REGISTRY/spotiflac-ui:latest"
echo "  - $REGISTRY/spotiflac-api:$VERSION"
echo "  - $REGISTRY/spotiflac-api:latest"
echo ""
echo "🚀 Для запуска используйте:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "🌐 Приложение будет доступно по адресу:"
echo "  http://localhost:8083"
