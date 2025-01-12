console.log('Background script started.');

chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get('language', (data) => {
		if (!data.language) {
			chrome.storage.local.set({ language: 'en' });
		}
	});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'getStorage') {
		const keys = request.keys;
		chrome.storage.local.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				sendResponse({ data: result });
			}
		});
		return true;
	} else if (request.action === 'setStorage') {
		const data = request.data;
		chrome.storage.local.set(data, () => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				sendResponse({ success: true });
			}
		});
		return true;
	} else if (request.action === 'getAllStorage') {
		chrome.storage.local.get(null, (result) => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				sendResponse({ data: result });
			}
		});
		return true;
	} else if (request.action === 'clearStorage') {
		chrome.storage.local.clear(() => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				sendResponse({ success: true });
			}
		});
		return true;
	} else if (request.action === 'removeStorage') {
		const keys = request.keys;
		chrome.storage.local.remove(keys, () => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				sendResponse({ success: true });
			}
		});
		return true;
	} else {
		sendResponse({ error: 'Unknown action' });
	}
});
