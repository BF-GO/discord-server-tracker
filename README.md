[Read in Russian](README.ru.md)

# Discord Server Tracker

Discord Server Tracker is a browser extension designed to track user interactions with Discord server join buttons. It provides a convenient way to log clicks, maintain a history of server visits, and display information in a user-friendly popup interface.

---

## Features

- **Server Tracking**: Counts the number of clicks on Discord server join buttons.
- **Server History**: Saves records of visited servers, including their names, invite links, and the time of the last visit.
- **Popup Interface**: Provides a clean, paginated interface for viewing tracked servers with search, navigation, and data reset capabilities.
- **Periodic Updates**: Automatically updates data when new servers are added or interactions occur.
- **Persistent Storage**: Stores all data locally using the browser’s storage API.
- **Multi-site Support**: In addition to [server-discord.com](https://server-discord.com), the extension now also supports [myserver.gg](https://myserver.gg).
- **Data Export and Import**: Ability to export server data to a JSON file and import it for backup or transfer purposes.
- **Multilingual Interface**: Supports interface language selection through settings (currently supports English, Russian, and additional languages via localization files).
- **Interactive Reset Button**: A reset button with unusual behavior – it changes shape, position, and reacts to cursor movements, adding a game-like element to usage.
- **Dynamic Interface Updates**: The interface instantly adapts to the current settings and data when the language is changed or data is updated.

> **Note**: This extension works exclusively on [https://server-discord.com](https://server-discord.com) and [https://myserver.gg](https://myserver.gg).

---

## Installation

### Installing the Extension Locally

1. **Clone or Download the Repository**  
   Clone this repository to your local computer or download it as a ZIP archive and extract the files.

2. **Go to the Extensions Management Page**  
   Open Chrome or any Chromium-based browser and navigate to the extensions management page:

   ```
   chrome://extensions/
   ```

3. **Enable Developer Mode**  
   Toggle the "Developer mode" switch in the top right corner of the page.

4. **Load the Extension**  
   Click the "Load unpacked" button and select the folder containing the extension files.

5. **Verify Installation**  
   The extension should appear on your browser's extension bar. Click it to open the popup interface.

### Installing via Chrome Web Store

You can also install the extension directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/discord-server-tracker/ncjajonogknecpjaknfimackajgfbjhb?hl=en&authuser=0). Simply follow the link and click "Add to Chrome".

---

## Usage

1. Go to [https://server-discord.com](https://server-discord.com) or [https://myserver.gg](https://myserver.gg).
2. Interact with the Discord server join buttons on the site.
3. Open the extension's popup to view server data, including click counts, visit history, and additional features:

- Use search and navigation for quick access to desired servers.
- Export the current data to a JSON file for backup.
- Import previously saved data to restore history.
- Change the interface language in the settings for a more comfortable experience.
- Reset all counters using the interactive reset button (hold Ctrl while clicking to confirm the reset).

---

## Contributing

We welcome contributions to the project! If you want to report a bug, suggest new features, or make changes to the code, please create an Issue or Pull Request in the repository.

You can also contact me directly on Discord: **@BF_GO**.
