# Инструкции по отправке Docker образов в GitHub Container Registry

## Подготовка

1. Создайте Personal Access Token в GitHub:
   - Перейдите в Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Создайте новый токен с правами: `write:packages`, `read:packages`, `delete:packages`

2. Войдите в GitHub Container Registry:
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u 26rusreal --password-stdin
   ```

## Отправка образов

```bash
# Отправить API образ
docker push ghcr.io/26rusreal/spotiflac-api:v2.1.0

# Отправить UI образ  
docker push ghcr.io/26rusreal/spotiflac-ui:v2.1.0

# Отправить latest теги
docker tag ghcr.io/26rusreal/spotiflac-api:v2.1.0 ghcr.io/26rusreal/spotiflac-api:latest
docker tag ghcr.io/26rusreal/spotiflac-ui:v2.1.0 ghcr.io/26rusreal/spotiflac-ui:latest
docker push ghcr.io/26rusreal/spotiflac-api:latest
docker push ghcr.io/26rusreal/spotiflac-ui:latest
```

## Обновление docker-compose.prod.yml

После отправки образов обновите `docker-compose.prod.yml`:

```yaml
services:
  api:
    image: ghcr.io/26rusreal/spotiflac-api:v2.1.0
    # ... остальная конфигурация

  ui:
    image: ghcr.io/26rusreal/spotiflac-ui:v2.1.0
    # ... остальная конфигурация
```

## Проверка

Образы будут доступны по адресам:
- https://github.com/26rusreal/SpotiFLAC-Docker/pkgs/container/spotiflac-api
- https://github.com/26rusreal/SpotiFLAC-Docker/pkgs/container/spotiflac-ui
