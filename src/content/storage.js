const EXTENSION_CONTEXT_INVALIDATED_MESSAGE = 'Extension context invalidated';

function hasValidExtensionContext() {
	return (
		typeof chrome !== 'undefined' &&
		typeof chrome.runtime !== 'undefined' &&
		typeof chrome.runtime.id === 'string'
	);
}

function createInvalidatedContextError() {
	return new Error(EXTENSION_CONTEXT_INVALIDATED_MESSAGE);
}

export function isExtensionContextInvalidatedError(error) {
	return (
		!hasValidExtensionContext() ||
		(error instanceof Error && error.message.includes(EXTENSION_CONTEXT_INVALIDATED_MESSAGE))
	);
}

function sendRuntimeMessage(message) {
	if (!hasValidExtensionContext()) {
		return Promise.reject(createInvalidatedContextError());
	}

	return new Promise((resolve, reject) => {
		try {
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
		} catch (error) {
			reject(error);
		}
	});
}

export async function getStorageValue(keys) {
	const normalizedKeys = Array.isArray(keys) ? keys : [keys];
	return sendRuntimeMessage({ action: 'getStorage', keys: normalizedKeys });
}

export async function setStorageValue(data) {
	return sendRuntimeMessage({ action: 'setStorage', data });
}

export function notifyStorageChanged() {
	if (!hasValidExtensionContext()) {
		return;
	}

	try {
		chrome.runtime.sendMessage({ action: 'storageChanged' }, () => {
			void chrome.runtime.lastError;
		});
	} catch {
		// The old content script is shutting down after an extension reload.
	}
}
