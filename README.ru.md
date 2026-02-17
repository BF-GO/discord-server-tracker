[English version](README.md)

# Discord Server Tracker

Discord Server Tracker — это расширение браузера на Manifest V3, которое отслеживает клики по кнопкам входа в Discord-серверы на поддерживаемых сайтах-каталогах.

## Что Обновлено

- Проект переведен на сборку через Vite.
- Монолитные скрипты разделены на модульную структуру.
- Результат сборки теперь создается в `dist/`, архив собирается отдельным скриптом.

## Поддерживаемые Сайты

- https://server-discord.com
- https://myserver.gg
- https://discordserver.info
- https://disboard.org

## Разработка

1. Установить зависимости:

```bash
npm install
```

2. Собрать расширение:

```bash
npm run build
```

3. Режим отслеживания изменений (watch):

```bash
npm run dev
```

4. Собрать ZIP-архив релиза:

```bash
npm run build:zip
```

## Локальная Установка Расширения

1. Откройте `chrome://extensions/`.
2. Включите **Режим разработчика**.
3. Нажмите **Загрузить распакованное расширение**.
4. Выберите папку `dist`.

## Структура Проекта

```text
public/              # Статические файлы расширения (копируются в dist)
src/background/      # Service worker
src/content/         # Content script
src/popup/           # Popup (HTML/CSS/JS)
vite.config.js       # Конфиг сборки
build.js             # Архивирование dist в extension.zip
```


Примечание: Extension/ содержит legacy-версию исходников и не используется Vite-сборкой.

## Лицензия

Проект распространяется под лицензией MIT.
