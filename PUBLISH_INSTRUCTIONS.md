# 🚀 Инструкции по публикации SpotiFLAC v2.1.0

## ✅ Что готово

### 📦 Docker образы
- `spotiflac-ui:v2.1.0` (52.8MB) - UI с красивым дизайном
- `spotiflac-api:v2.1.0` (632MB) - API сервер
- `spotiflac-ui:latest` - последняя версия UI
- `spotiflac-api:latest` - последняя версия API

### 🏷️ Git теги
- `v2.1.0` - создан и отправлен в GitHub
- Все изменения закоммичены и отправлены

### 📚 Документация
- `DEPLOYMENT.md` - инструкции по развертыванию
- `RELEASE_v2.1.0.md` - информация о релизе
- `docker-compose.prod.yml` - конфигурация для продакшена

## 🐳 Публикация Docker образов

### Вариант 1: Автоматическая публикация
```bash
# Войдите в Docker Hub
docker login

# Запустите скрипт публикации
./publish.sh
```

### Вариант 2: Ручная публикация
```bash
# Войдите в Docker Hub
docker login

# Тегируйте образы (замените YOUR_USERNAME на ваш Docker Hub username)
docker tag spotiflac-docker-ui:v2.1.0 YOUR_USERNAME/spotiflac-ui:v2.1.0
docker tag spotiflac-docker-ui:v2.1.0 YOUR_USERNAME/spotiflac-ui:latest
docker tag spotiflac-docker-api:v2.1.0 YOUR_USERNAME/spotiflac-api:v2.1.0
docker tag spotiflac-docker-api:v2.1.0 YOUR_USERNAME/spotiflac-api:latest

# Публикуйте образы
docker push YOUR_USERNAME/spotiflac-ui:v2.1.0
docker push YOUR_USERNAME/spotiflac-ui:latest
docker push YOUR_USERNAME/spotiflac-api:v2.1.0
docker push YOUR_USERNAME/spotiflac-api:latest
```

## 🌐 Создание GitHub Release

1. Перейдите на https://github.com/26rusreal/SpotiFLAC-Docker/releases
2. Нажмите "Create a new release"
3. Выберите тег "v2.1.0"
4. Заголовок: "SpotiFLAC v2.1.0 - Красивый UI с анимированным заголовком"
5. Скопируйте содержимое из `RELEASE_v2.1.0.md`
6. Нажмите "Publish release"

## 📋 Проверка готовности

### ✅ Git
- [x] Все изменения закоммичены
- [x] Тег v2.1.0 создан и отправлен
- [x] Документация обновлена

### ✅ Docker
- [x] Образы собраны и протестированы
- [x] Теги v2.1.0 созданы
- [x] Скрипт публикации готов

### ✅ Документация
- [x] DEPLOYMENT.md создан
- [x] RELEASE_v2.1.0.md создан
- [x] docker-compose.prod.yml готов

## 🎯 Следующие шаги

1. **Публикуйте Docker образы** (выберите один из вариантов выше)
2. **Создайте GitHub Release** с тегом v2.1.0
3. **Обновите README.md** с информацией о новом релизе
4. **Протестируйте развертывание** на чистой системе

## 🆘 Поддержка

Если возникнут проблемы:
- Проверьте логи: `docker compose logs`
- Убедитесь, что порты 8080 и 8083 свободны
- Проверьте системные требования в DEPLOYMENT.md

---

**Статус**: ✅ Готов к публикации  
**Версия**: v2.1.0  
**Дата**: 27 сентября 2025
