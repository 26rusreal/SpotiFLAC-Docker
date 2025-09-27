#!/bin/bash

# Скрипт для отправки Docker образов в Docker Hub
# Использование: ./push-to-dockerhub.sh

set -e

echo "🚀 Отправка Docker образов в Docker Hub..."

# Проверяем, что пользователь вошел в систему
if ! docker info | grep -q "Username"; then
    echo "❌ Необходимо войти в Docker Hub:"
    echo "   docker login"
    echo "   # Или используйте токен:"
    echo "   echo \$DOCKERHUB_TOKEN | docker login -u 26rusreal --password-stdin"
    exit 1
fi

# Отправляем API образ
echo "📦 Отправка spotiflac-api:v2.1.0..."
docker push 26rusreal/spotiflac-api:v2.1.0

# Отправляем UI образ
echo "📦 Отправка spotiflac-ui:v2.1.0..."
docker push 26rusreal/spotiflac-ui:v2.1.0

# Создаем и отправляем latest теги
echo "🏷️  Создание latest тегов..."
docker tag 26rusreal/spotiflac-api:v2.1.0 26rusreal/spotiflac-api:latest
docker tag 26rusreal/spotiflac-ui:v2.1.0 26rusreal/spotiflac-ui:latest

echo "📦 Отправка latest тегов..."
docker push 26rusreal/spotiflac-api:latest
docker push 26rusreal/spotiflac-ui:latest

echo "✅ Все образы успешно отправлены в Docker Hub!"
echo ""
echo "🔗 Образы доступны по адресам:"
echo "   - https://hub.docker.com/r/26rusreal/spotiflac-api"
echo "   - https://hub.docker.com/r/26rusreal/spotiflac-ui"
echo ""
echo "📋 Для использования в production:"
echo "   docker compose -f docker-compose.prod.yml up -d"
