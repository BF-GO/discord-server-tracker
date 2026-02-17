function sendRuntimeMessage(message) {
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

export async function getStorageValue(keys) {
	const normalizedKeys = Array.isArray(keys) ? keys : [keys];
	return sendRuntimeMessage({ action: 'getStorage', keys: normalizedKeys });
}

export async function setStorageValue(data) {
	return sendRuntimeMessage({ action: 'setStorage', data });
}

export function notifyStorageChanged() {
	chrome.runtime.sendMessage({ action: 'storageChanged' });
}
