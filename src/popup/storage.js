const PREVIEW_STORAGE_KEY = 'discord-server-tracker-preview-storage';

function hasChromeRuntime() {
	return typeof chrome !== 'undefined' &&
		typeof chrome.runtime?.sendMessage === 'function';
}

function getPreviewStorage() {
	try {
		const parsed = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY) || '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function setPreviewStorage(data) {
	window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data, null, 2));
}

function sendRuntimeMessage(message) {
	if (!hasChromeRuntime()) {
		const current = getPreviewStorage();
		switch (message.action) {
			case 'getAllStorage': return Promise.resolve(current);
			case 'getStorage': return Promise.resolve(Object.fromEntries(
				(message.keys || []).filter((key) => key in current).map((key) => [key, current[key]])
			));
			case 'setStorage':
				setPreviewStorage({ ...current, ...(message.data || {}) });
				return Promise.resolve(true);
			case 'removeStorage': {
				const next = { ...current };
				for (const key of message.keys || []) delete next[key];
				setPreviewStorage(next);
				return Promise.resolve(true);
			}
			default: return Promise.resolve(null);
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

export function getAllStorage() {
	return sendRuntimeMessage({ action: 'getAllStorage' });
}

export function getStorage(keys) {
	return sendRuntimeMessage({
		action: 'getStorage',
		keys: Array.isArray(keys) ? keys : [keys],
	});
}

export function setStorage(data) {
	return sendRuntimeMessage({ action: 'setStorage', data });
}

export function removeStorage(keys) {
	return sendRuntimeMessage({
		action: 'removeStorage',
		keys: Array.isArray(keys) ? keys : [keys],
	});
}

export async function getPreference(key, fallback) {
	const stored = await getStorage(key);
	return stored?.[key] ?? fallback;
}

export function setPreference(key, value) {
	return setStorage({ [key]: value });
}

export function notifyStorageChanged() {
	if (hasChromeRuntime()) {
		chrome.runtime.sendMessage({ action: 'storageChanged' });
	}
}

export function getExtensionUrl(path) {
	return typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function'
		? chrome.runtime.getURL(path)
		: path;
}
