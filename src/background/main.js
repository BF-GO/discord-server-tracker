const DEFAULT_LANGUAGE = 'en';

const DEFAULT_THEME = 'system';
const DEFAULT_TIME_FORMAT = '24';

function storageGet(keys) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			resolve(result);
		});
	});
}

function storageSet(data) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set(data, () => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			resolve(true);
		});
	});
}

function storageRemove(keys) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.remove(keys, () => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			resolve(true);
		});
	});
}

function storageClear() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.clear(() => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			resolve(true);
		});
	});
}

const messageHandlers = {
	async getStorage(request) {
		const keys = Array.isArray(request.keys) ? request.keys : [];
		const data = await storageGet(keys);
		return { data };
	},

	async setStorage(request) {
		const data = request.data && typeof request.data === 'object' ? request.data : {};
		await storageSet(data);
		return { success: true };
	},

	async getAllStorage() {
		const data = await storageGet(null);
		return { data };
	},

	async clearStorage() {
		await storageClear();
		return { success: true };
	},

	async removeStorage(request) {
		const keys = Array.isArray(request.keys) ? request.keys : [];
		await storageRemove(keys);
		return { success: true };
	},

	async storageChanged() {
		return { success: true };
	},
};

chrome.runtime.onInstalled.addListener(async () => {
	try {
		const preferences = await storageGet(['language', 'theme', 'timeFormat']);
		const defaults = {};

		if (!preferences.language) defaults.language = DEFAULT_LANGUAGE;
		if (!preferences.theme) defaults.theme = DEFAULT_THEME;
		if (!preferences.timeFormat) defaults.timeFormat = DEFAULT_TIME_FORMAT;
		if (Object.keys(defaults).length) await storageSet(defaults);
	} catch (error) {
		console.error('[Discord Server Tracker] Failed to initialize defaults:', error);
	}
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	const action = request?.action;
	const handler = action ? messageHandlers[action] : undefined;

	if (!handler) {
		sendResponse({ error: `Unknown action: ${String(action)}` });
		return false;
	}

	(async () => {
		try {
			const response = await handler(request);
			sendResponse(response);
		} catch (error) {
			sendResponse({ error: error instanceof Error ? error.message : String(error) });
		}
	})();

	return true;
});
