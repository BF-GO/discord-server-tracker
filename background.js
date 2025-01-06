// background.js

console.log('Background script started.');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('Background received message:', request);

	if (request.action === 'getStorage') {
		const keys = request.keys;
		chrome.storage.local.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				console.error('Error in getStorage:', chrome.runtime.lastError.message);
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				console.log('getStorage result:', result);
				sendResponse({ data: result });
			}
		});
		return true; // Indicates that the response will be sent asynchronously
	} else if (request.action === 'setStorage') {
		const data = request.data;
		chrome.storage.local.set(data, () => {
			if (chrome.runtime.lastError) {
				console.error('Error in setStorage:', chrome.runtime.lastError.message);
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				console.log('setStorage success:', data);
				sendResponse({ success: true });
			}
		});
		return true;
	} else if (request.action === 'getAllStorage') {
		chrome.storage.local.get(null, (result) => {
			if (chrome.runtime.lastError) {
				console.error(
					'Error in getAllStorage:',
					chrome.runtime.lastError.message
				);
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				console.log('getAllStorage result:', result);
				sendResponse({ data: result });
			}
		});
		return true;
	} else if (request.action === 'clearStorage') {
		chrome.storage.local.clear(() => {
			if (chrome.runtime.lastError) {
				console.error(
					'Error in clearStorage:',
					chrome.runtime.lastError.message
				);
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				console.log('clearStorage success');
				sendResponse({ success: true });
			}
		});
		return true;
	} else if (request.action === 'removeStorage') {
		// Новое действие для удаления ключей
		const keys = request.keys;
		chrome.storage.local.remove(keys, () => {
			if (chrome.runtime.lastError) {
				console.error(
					'Error in removeStorage:',
					chrome.runtime.lastError.message
				);
				sendResponse({ error: chrome.runtime.lastError.message });
			} else {
				console.log('removeStorage success:', keys);
				sendResponse({ success: true });
			}
		});
		return true;
	} else {
		console.warn('Unknown action:', request.action);
		sendResponse({ error: 'Unknown action' });
	}
});
