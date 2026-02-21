const PREVIEW_STORAGE_KEY = 'discord-server-tracker-preview-storage';
const PREVIEW_LANGUAGE_KEY = 'discord-server-tracker-preview-language';
const PREVIEW_TIME_FORMAT_KEY = 'discord-server-tracker-preview-time-format';
const TIME_FORMAT_STORAGE_KEY = 'timeFormat';
const DEFAULT_TIME_FORMAT = '24';

function normalizeTimeFormat(value) {
	return value === '12' ? '12' : '24';
}

function hasChromeRuntime() {
	return (
		typeof chrome !== 'undefined' &&
		typeof chrome.runtime !== 'undefined' &&
		typeof chrome.runtime.sendMessage === 'function'
	);
}

function hasChromeStorage() {
	return (
		typeof chrome !== 'undefined' &&
		typeof chrome.storage !== 'undefined' &&
		typeof chrome.storage.local !== 'undefined'
	);
}

function getPreviewStorage() {
	try {
		const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
		if (!raw) {
			return {};
		}

		const parsed = JSON.parse(raw);
		return typeof parsed === 'object' && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

function setPreviewStorage(nextData) {
	window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(nextData, null, 2));
}

function sendRuntimeMessage(message) {
	if (!hasChromeRuntime()) {
		const currentPreviewStorage = getPreviewStorage();

		switch (message.action) {
			case 'getAllStorage':
				return Promise.resolve(currentPreviewStorage);
			case 'getStorage': {
				const result = {};
				for (const key of message.keys || []) {
					if (key in currentPreviewStorage) {
						result[key] = currentPreviewStorage[key];
					}
				}
				return Promise.resolve(result);
			}
			case 'setStorage':
				setPreviewStorage({
					...currentPreviewStorage,
					...(message.data || {}),
				});
				return Promise.resolve(true);
			case 'removeStorage': {
				const nextStorage = { ...currentPreviewStorage };
				for (const key of message.keys || []) {
					delete nextStorage[key];
				}
				setPreviewStorage(nextStorage);
				return Promise.resolve(true);
			}
			case 'clearStorage':
				setPreviewStorage({});
				return Promise.resolve(true);
			default:
				return Promise.resolve(null);
		}
	}

	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(message, (response) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}

			if (response?.error) {
				reject(new Error(response.error));
				return;
			}

			resolve(response?.data ?? response?.success ?? null);
		});
	});
}

export async function getAllStorage() {
	return sendRuntimeMessage({ action: 'getAllStorage' });
}

export async function getStorage(keys) {
	const normalizedKeys = Array.isArray(keys) ? keys : [keys];
	return sendRuntimeMessage({ action: 'getStorage', keys: normalizedKeys });
}

export async function setStorage(data) {
	return sendRuntimeMessage({ action: 'setStorage', data });
}

export async function removeStorage(keys) {
	const normalizedKeys = Array.isArray(keys) ? keys : [keys];
	return sendRuntimeMessage({ action: 'removeStorage', keys: normalizedKeys });
}

export async function clearStorage() {
	return sendRuntimeMessage({ action: 'clearStorage' });
}

export async function getLanguage(defaultLanguage) {
	if (!hasChromeStorage()) {
		return window.localStorage.getItem(PREVIEW_LANGUAGE_KEY) || defaultLanguage;
	}

	return new Promise((resolve) => {
		chrome.storage.local.get('language', (data) => {
			resolve(data?.language || defaultLanguage);
		});
	});
}

export async function setLanguage(language) {
	if (!hasChromeStorage()) {
		window.localStorage.setItem(PREVIEW_LANGUAGE_KEY, language);
		return;
	}

	return new Promise((resolve) => {
		chrome.storage.local.set({ language }, () => {
			resolve();
		});
	});
}

export async function getTimeFormat(defaultTimeFormat = DEFAULT_TIME_FORMAT) {
	const fallbackTimeFormat = normalizeTimeFormat(defaultTimeFormat);
	if (!hasChromeStorage()) {
		return normalizeTimeFormat(
			window.localStorage.getItem(PREVIEW_TIME_FORMAT_KEY) || fallbackTimeFormat
		);
	}

	return new Promise((resolve) => {
		chrome.storage.local.get(TIME_FORMAT_STORAGE_KEY, (data) => {
			resolve(normalizeTimeFormat(data?.[TIME_FORMAT_STORAGE_KEY] || fallbackTimeFormat));
		});
	});
}

export async function setTimeFormat(timeFormat) {
	const normalizedTimeFormat = normalizeTimeFormat(timeFormat);
	if (!hasChromeStorage()) {
		window.localStorage.setItem(PREVIEW_TIME_FORMAT_KEY, normalizedTimeFormat);
		return;
	}

	return new Promise((resolve) => {
		chrome.storage.local.set({ [TIME_FORMAT_STORAGE_KEY]: normalizedTimeFormat }, () => {
			resolve();
		});
	});
}

export function notifyStorageChanged() {
	if (hasChromeRuntime()) {
		chrome.runtime.sendMessage({ action: 'storageChanged' });
	}
}
