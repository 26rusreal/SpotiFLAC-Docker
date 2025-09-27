# Инструкции по отправке Docker образов в Docker Hub

## Подготовка

1. Войдите в Docker Hub:
   ```bash
   docker login
   # Введите ваш username и password
   ```

2. Или используйте токен:
   ```bash
   echo $DOCKERHUB_TOKEN | docker login -u 26rusreal --password-stdin
   ```

## Отправка образов

```bash
# Отправить API образ
docker push 26rusreal/spotiflac-api:v2.1.0

# Отправить UI образ  
docker push 26rusreal/spotiflac-ui:v2.1.0

# Создать и отправить latest теги
docker tag 26rusreal/spotiflac-api:v2.1.0 26rusreal/spotiflac-api:latest
docker tag 26rusreal/spotiflac-ui:v2.1.0 26rusreal/spotiflac-ui:latest
docker push 26rusreal/spotiflac-api:latest
docker push 26rusreal/spotiflac-ui:latest
```

## Обновление docker-compose.prod.yml

После отправки образов обновите `docker-compose.prod.yml`:

```yaml
services:
  api:
    image: 26rusreal/spotiflac-api:v2.1.0
    # ... остальная конфигурация

  ui:
    image: 26rusreal/spotiflac-ui:v2.1.0
    # ... остальная конфигурация
```

## Проверка

Образы будут доступны по адресам:
- https://hub.docker.com/r/26rusreal/spotiflac-api
- https://hub.docker.com/r/26rusreal/spotiflac-ui
