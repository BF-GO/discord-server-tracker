import { resolveSiteAdapter } from './site-adapters.js';
import { getStorageValue, notifyStorageChanged, setStorageValue } from './storage.js';

const HISTORY_LIMIT = 5;
const REFRESH_INTERVAL_MS = 5000;
const REFRESH_DEBOUNCE_MS = 120;
const UNKNOWN_SERVER = 'Unknown server';

const adapter = resolveSiteAdapter(window.location.hostname);

if (!adapter) {
	// Unsupported page.
} else {
	let isActive = true;
	let refreshTimeoutId = null;

	if (typeof adapter.onInit === 'function') {
		adapter.onInit();
	}

	function getStorageKey(serverId) {
		return `${adapter.key}_${serverId}`;
	}

	function setButtonTrackedState(joinButton, count) {
		const safeCount = Number.isFinite(count) ? count : 0;

		if (safeCount > 0) {
			joinButton.classList.add('tracked-join-button');

			let countBadge = joinButton.querySelector('.click-count');
			if (!countBadge) {
				countBadge = document.createElement('span');
				countBadge.className = 'click-count';
				joinButton.appendChild(countBadge);
			}

			countBadge.textContent = ` (${safeCount})`;
			return;
		}

		joinButton.classList.remove('tracked-join-button');
		const countBadge = joinButton.querySelector('.click-count');
		if (countBadge) {
			countBadge.remove();
		}
	}

	async function getServerData(storageKey) {
		const result = await getStorageValue([storageKey]);
		return result?.[storageKey] ?? null;
	}

	async function normalizeServerData(storageKey, serverData) {
		if (!serverData || typeof serverData.lastVisited === 'number') {
			return serverData;
		}

		const normalizedData = {
			...serverData,
			lastVisited: 0,
		};

		await setStorageValue({ [storageKey]: normalizedData });
		return normalizedData;
	}

	async function syncButtonState(serverBlock) {
		const joinButton = adapter.getJoinButton(serverBlock);
		if (!joinButton) {
			return;
		}

		const serverId = adapter.getServerId(serverBlock);
		if (!serverId) {
			return;
		}

		const storageKey = getStorageKey(serverId);

		try {
			const serverData = await normalizeServerData(storageKey, await getServerData(storageKey));
			setButtonTrackedState(joinButton, Number(serverData?.count ?? 0));
		} catch (error) {
			console.error('[Discord Server Tracker] Failed to sync button state:', error);
		}
	}

	async function refreshButtons() {
		if (!isActive) {
			return;
		}

		const serverBlocks = Array.from(adapter.getServerBlocks());
		for (const serverBlock of serverBlocks) {
			if (!isActive) {
				return;
			}

			await syncButtonState(serverBlock);
		}
	}

	function scheduleRefresh() {
		if (!isActive) {
			return;
		}

		if (refreshTimeoutId !== null) {
			clearTimeout(refreshTimeoutId);
		}

		refreshTimeoutId = window.setTimeout(() => {
			refreshTimeoutId = null;
			void refreshButtons();
		}, REFRESH_DEBOUNCE_MS);
	}

	function buildNextServerData(existingData, serverBlock) {
		const now = Date.now();
		const historyEntry = new Date(now).toISOString();

		const history = Array.isArray(existingData?.history)
			? [...existingData.history]
			: [];

		history.unshift(historyEntry);
		history.length = HISTORY_LIMIT;

		const nextCount = (Number(existingData?.count) || 0) + 1;

		return {
			count: nextCount,
			name: adapter.getServerName(serverBlock) || existingData?.name || UNKNOWN_SERVER,
			mainLink: adapter.getMainLink(serverBlock) || existingData?.mainLink || null,
			joinLink: adapter.getJoinLink(serverBlock) || existingData?.joinLink || null,
			history,
			lastVisited: now,
		};
	}

	async function handleJoinClick(joinButton) {
		const serverBlock = adapter.getServerBlockFromJoinButton(joinButton);
		if (!serverBlock) {
			return;
		}

		const serverId = adapter.getServerId(serverBlock);
		if (!serverId) {
			return;
		}

		const storageKey = getStorageKey(serverId);

		try {
			const currentData = await getServerData(storageKey);
			const nextData = buildNextServerData(currentData, serverBlock);

			await setStorageValue({ [storageKey]: nextData });
			setButtonTrackedState(joinButton, nextData.count);
			notifyStorageChanged();
		} catch (error) {
			console.error('[Discord Server Tracker] Failed to track server click:', error);
		}
	}

	function setupClickTracking() {
		document.body.addEventListener('click', (event) => {
			if (!isActive) {
				return;
			}

			if (!(event.target instanceof Element)) {
				return;
			}

			const joinButton = adapter.getJoinButtonFromEvent(event.target);
			if (!joinButton) {
				return;
			}

			void handleJoinClick(joinButton);
		});
	}

	function setupDomObserver() {
		const observer = new MutationObserver((mutations) => {
			if (!isActive) {
				return;
			}

			const hasRelevantNode = mutations.some((mutation) => {
				if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
					return false;
				}

				return Array.from(mutation.addedNodes).some((node) => adapter.isRelevantNode(node));
			});

			if (hasRelevantNode) {
				scheduleRefresh();
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		window.addEventListener(
			'beforeunload',
			() => {
				observer.disconnect();
			},
			{ once: true }
		);
	}

	function setupPeriodicRefresh() {
		const timerId = window.setInterval(() => {
			if (isActive) {
				void refreshButtons();
			}
		}, REFRESH_INTERVAL_MS);

		window.addEventListener(
			'beforeunload',
			() => {
				clearInterval(timerId);
			},
			{ once: true }
		);
	}

	function setupStorageChangedListener() {
		chrome.runtime.onMessage.addListener((request) => {
			if (request?.action === 'storageChanged') {
				void refreshButtons();
			}
		});
	}

	async function run() {
		await refreshButtons();
		setupClickTracking();
		setupDomObserver();
		setupPeriodicRefresh();
		setupStorageChangedListener();
	}

	window.addEventListener('beforeunload', () => {
		isActive = false;
	});

	window.addEventListener('unload', () => {
		isActive = false;
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			void run();
		});
	} else {
		void run();
	}
}
