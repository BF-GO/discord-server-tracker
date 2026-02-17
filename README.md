[Русская версия](README.ru.md)

# Discord Server Tracker

Discord Server Tracker is a Manifest V3 browser extension that tracks clicks on Discord server join buttons across supported server listing websites.

## What Changed

- Project migrated to a Vite-based build pipeline.
- Legacy monolithic scripts were refactored into modular source files.
- Build output is now generated in `dist/` and can be zipped via script.

## Supported Sites

- https://server-discord.com
- https://myserver.gg
- https://discordserver.info
- https://disboard.org

## Development

1. Install dependencies:

```bash
npm install
```

2. Build extension:

```bash
npm run build
```

3. Optional watch mode during development:

```bash
npm run dev
```

4. Create release archive:

```bash
npm run build:zip
```

## Load Extension Locally

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist` folder.

## Project Structure

```text
public/              # Static extension assets copied as-is to dist
src/background/      # Service worker source
src/content/         # Content script source
src/popup/           # Popup UI (HTML/CSS/JS)
vite.config.js       # Build configuration
build.js             # Zip packaging script for dist
```


Legacy note: Extension/ contains old source files and is not used by the Vite build.

## License

This project is distributed under the MIT License.
