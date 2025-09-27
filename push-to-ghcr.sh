#!/bin/bash

# Скрипт для отправки Docker образов в GitHub Container Registry
# Использование: ./push-to-ghcr.sh

set -e

echo "🚀 Отправка Docker образов в GitHub Container Registry..."

# Проверяем, что пользователь вошел в систему
if ! docker info | grep -q "Username"; then
    echo "❌ Необходимо войти в GitHub Container Registry:"
    echo "   echo \$GITHUB_TOKEN | docker login ghcr.io -u 26rusreal --password-stdin"
    exit 1
fi

# Отправляем API образ
echo "📦 Отправка spotiflac-api:v2.1.0..."
docker push ghcr.io/26rusreal/spotiflac-api:v2.1.0

# Отправляем UI образ
echo "📦 Отправка spotiflac-ui:v2.1.0..."
docker push ghcr.io/26rusreal/spotiflac-ui:v2.1.0

# Создаем и отправляем latest теги
echo "🏷️  Создание latest тегов..."
docker tag ghcr.io/26rusreal/spotiflac-api:v2.1.0 ghcr.io/26rusreal/spotiflac-api:latest
docker tag ghcr.io/26rusreal/spotiflac-ui:v2.1.0 ghcr.io/26rusreal/spotiflac-ui:latest

echo "📦 Отправка latest тегов..."
docker push ghcr.io/26rusreal/spotiflac-api:latest
docker push ghcr.io/26rusreal/spotiflac-ui:latest

echo "✅ Все образы успешно отправлены в GitHub Container Registry!"
echo ""
echo "🔗 Образы доступны по адресам:"
echo "   - https://github.com/26rusreal/SpotiFLAC-Docker/pkgs/container/spotiflac-api"
echo "   - https://github.com/26rusreal/SpotiFLAC-Docker/pkgs/container/spotiflac-ui"
echo ""
echo "📋 Для использования в production:"
echo "   docker compose -f docker-compose.prod.yml up -d"
