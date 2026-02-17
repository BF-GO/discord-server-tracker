import './style.css';

import { DEFAULT_LANGUAGE, SERVERS_PER_PAGE } from './constants.js';
import { buildUpdatedServerPayload, parseStorageRecords } from './data.js';
import {
	applyTranslationsToDocument,
	loadTranslations,
	translate,
} from './i18n.js';
import { wireInteractiveResetButton } from './reset-button.js';
import {
	clearStorage,
	getAllStorage,
	getLanguage,
	notifyStorageChanged,
	removeStorage,
	setLanguage,
	setStorage,
} from './storage.js';

const state = {
	language: DEFAULT_LANGUAGE,
	translations: {},
	servers: [],
	query: '',
	currentPage: 1,
};

const SEARCH_DEBOUNCE_MS = 120;

const elements = {
	searchInput: document.getElementById('search-input'),
	serverList: document.getElementById('server-list'),
	prevPageButton: document.getElementById('prev-page'),
	nextPageButton: document.getElementById('next-page'),
	pageInfo: document.getElementById('page-info'),
	exportButton: document.getElementById('export-button'),
	importButton: document.getElementById('import-button'),
	importFileInput: document.getElementById('import-file-input'),
	settingsButton: document.getElementById('settings-button'),
	settingsModal: document.getElementById('settings-modal'),
	modalContent: document.querySelector('.modal__content'),
	closeModalButton: document.getElementById('close-modal'),
	languageSelect: document.getElementById('language-select'),
	resetButton: document.getElementById('reset-button'),
	dropdownToggle: document.querySelector('.dropdown-toggle'),
	dropdownMenu: document.querySelector('.dropdown-menu'),
	dropdownIcon: document.querySelector('.dropdown-icon'),
};

function t(key, fallback) {
	return translate(state.translations, key, fallback);
}

function getFilteredServers() {
	const normalizedQuery = state.query.trim().toLowerCase();
	if (!normalizedQuery) {
		return [...state.servers];
	}

	return state.servers.filter((server) =>
		(server.searchName || server.name.toLowerCase()).includes(normalizedQuery)
	);
}

function getTotalPages(totalItems) {
	return Math.max(1, Math.ceil(totalItems / SERVERS_PER_PAGE));
}

function updatePaginationControls(filteredCount) {
	const totalPages = getTotalPages(filteredCount);
	if (state.currentPage > totalPages) {
		state.currentPage = totalPages;
	}

	elements.pageInfo.textContent = t('pageInfo', 'Page {0} of {1}')
		.replace('{0}', String(state.currentPage))
		.replace('{1}', String(totalPages));

	elements.prevPageButton.disabled = state.currentPage <= 1;
	elements.nextPageButton.disabled = state.currentPage >= totalPages;
}

function createHistoryTooltip(server) {
	const tooltip = document.createElement('div');
	tooltip.className = 'custom-tooltip';

	if (!Array.isArray(server.history) || server.history.length === 0) {
		const emptyEntry = document.createElement('div');
		emptyEntry.className = 'tooltip-entry';
		emptyEntry.textContent = t('noHistory', 'No visit history');
		tooltip.appendChild(emptyEntry);
		return tooltip;
	}

	const sortedHistory = [...server.history].sort(
		(left, right) => new Date(right).getTime() - new Date(left).getTime()
	);

	for (const historyDate of sortedHistory) {
		const entry = document.createElement('div');
		entry.className = 'tooltip-entry';
		entry.textContent = new Date(historyDate).toLocaleString();
		tooltip.appendChild(entry);
	}

	return tooltip;
}

async function updateServerLastVisited(server) {
	const nextPayload = buildUpdatedServerPayload({
		count: server.count,
		name: server.name,
		mainLink: server.mainLink,
		joinLink: server.joinLink,
		history: server.history,
		lastVisited: server.lastVisited,
	});

	await setStorage({ [server.key]: nextPayload });
	notifyStorageChanged();
}

function createServerListItem(server) {
	const listItem = document.createElement('li');
	listItem.className = 'server-item';

	const iconContainer = document.createElement('div');
	iconContainer.className = 'icon-container';

	const icon = document.createElement('img');
	icon.className = 'server-icon';
	icon.src = '/icons/book.png';
	icon.alt = 'Server icon';
	iconContainer.appendChild(icon);
	iconContainer.appendChild(createHistoryTooltip(server));

	const nameLink = document.createElement('a');
	nameLink.className = 'server-name';
	nameLink.href = server.mainLink;
	nameLink.textContent = server.name;
	nameLink.title = server.name;
	nameLink.target = '_blank';
	nameLink.rel = 'noopener noreferrer';
	nameLink.addEventListener('click', () => {
		void updateServerLastVisited(server);
	});

	const countElement = document.createElement('span');
	countElement.className = 'server-count';
	countElement.textContent = `${t('clicks', 'Clicks')}: ${server.count}`;

	const joinLink = document.createElement('a');
	joinLink.className = 'server-link';
	joinLink.href = server.joinLink;
	joinLink.textContent = t('goTo', 'Join');
	joinLink.target = '_blank';
	joinLink.rel = 'noopener noreferrer';
	joinLink.addEventListener('click', () => {
		void updateServerLastVisited(server);
	});

	const deleteButton = document.createElement('button');
	deleteButton.className = 'delete-button';
	deleteButton.type = 'button';
	deleteButton.title = t('deleteServer', 'Delete server');
	deleteButton.innerHTML = '&times;';
	deleteButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void deleteServer(server);
	});

	listItem.append(iconContainer, nameLink, countElement, joinLink, deleteButton);
	return listItem;
}

function renderServerList() {
	const filteredServers = getFilteredServers();
	const totalPages = getTotalPages(filteredServers.length);
	if (state.currentPage > totalPages) {
		state.currentPage = totalPages;
	}

	const startIndex = (state.currentPage - 1) * SERVERS_PER_PAGE;
	const visibleServers = filteredServers.slice(startIndex, startIndex + SERVERS_PER_PAGE);

	elements.serverList.innerHTML = '';

	if (visibleServers.length === 0) {
		const emptyState = document.createElement('li');
		emptyState.className = 'server-item server-item--empty';
		emptyState.textContent = t('noServers', 'No servers tracked.');
		elements.serverList.appendChild(emptyState);
	} else {
		const fragment = document.createDocumentFragment();
		for (const server of visibleServers) {
			fragment.appendChild(createServerListItem(server));
		}
		elements.serverList.appendChild(fragment);
	}

	updatePaginationControls(filteredServers.length);
}

async function loadServers() {
	try {
		const storageData = await getAllStorage();
		const { servers, storageUpdates } = parseStorageRecords(
			storageData || {},
			t('unknownServer', 'Unknown server')
		);

		if (Object.keys(storageUpdates).length > 0) {
			await setStorage(storageUpdates);
		}

		state.servers = servers;
		renderServerList();
	} catch (error) {
		console.error('[Discord Server Tracker] Failed to load servers:', error);
	}
}

async function deleteServer(server) {
	const confirmed = window.confirm(
		t(
			'confirmDelete',
			'Are you sure you want to delete this server from the list?'
		)
	);

	if (!confirmed) {
		return;
	}

	try {
		await removeStorage([server.key]);
		notifyStorageChanged();
		await loadServers();
	} catch (error) {
		console.error('[Discord Server Tracker] Failed to delete server:', error);
	}
}

async function resetCounters() {
	const confirmed = window.confirm(
		t('confirmReset', 'Are you sure you want to reset all counters?')
	);
	if (!confirmed) {
		return;
	}

	try {
		await clearStorage();
		notifyStorageChanged();
		closeSettingsModal();
		state.servers = [];
		state.currentPage = 1;
		renderServerList();
	} catch (error) {
		console.error('[Discord Server Tracker] Failed to reset counters:', error);
	}
}

async function exportData() {
	try {
		const data = await getAllStorage();
		const blob = new Blob([JSON.stringify(data || {}, null, 2)], {
			type: 'application/json',
		});
		const objectUrl = URL.createObjectURL(blob);

		const temporaryLink = document.createElement('a');
		temporaryLink.href = objectUrl;
		temporaryLink.download = `servers_backup_${new Date()
			.toISOString()
			.slice(0, 10)}.json`;

		document.body.appendChild(temporaryLink);
		temporaryLink.click();
		temporaryLink.remove();
		URL.revokeObjectURL(objectUrl);
	} catch (error) {
		window.alert(t('exportError', 'Failed to export data.'));
	}
}

function isObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function importData(event) {
	const [file] = event.target.files || [];
	if (!file) {
		return;
	}

	try {
		const content = await file.text();
		const parsedData = JSON.parse(content);

		if (!isObject(parsedData)) {
			throw new Error('Invalid import payload.');
		}

		await setStorage(parsedData);
		notifyStorageChanged();
		await loadServers();
		window.alert(t('importSuccess', 'Data imported successfully.'));
	} catch (error) {
		window.alert(
			t(
				'importError',
				'Failed to import data. Please ensure the file format is correct.'
			)
		);
	} finally {
		event.target.value = '';
	}
}

function closeSettingsModal() {
	elements.settingsModal.style.display = 'none';
	resetButtonEffects.resetVisualState();
}

function openSettingsModal() {
	elements.settingsModal.style.display = 'flex';
}

function closeDropdownMenu() {
	elements.dropdownToggle.setAttribute('aria-expanded', 'false');
	elements.dropdownMenu.style.display = 'none';
}

function toggleDropdownMenu() {
	const expanded = elements.dropdownToggle.getAttribute('aria-expanded') === 'true';
	elements.dropdownToggle.setAttribute('aria-expanded', String(!expanded));
	elements.dropdownMenu.style.display = expanded ? 'none' : 'block';

	elements.dropdownIcon.classList.add('animate-bounce');
	elements.dropdownIcon.addEventListener(
		'animationend',
		() => {
			elements.dropdownIcon.classList.remove('animate-bounce');
		},
		{ once: true }
	);
}

async function applyLanguage(language) {
	try {
		state.translations = await loadTranslations(language);
		state.language = language;
		applyTranslationsToDocument(state.translations);
		document.documentElement.lang = language;
		renderServerList();
	} catch (error) {
		console.error('[Discord Server Tracker] Failed to apply language:', error);
	}
}

function wireEvents() {
	let searchDebounceTimer = null;

	elements.searchInput.addEventListener('input', (event) => {
		state.query = event.target.value || '';
		state.currentPage = 1;

		if (searchDebounceTimer !== null) {
			clearTimeout(searchDebounceTimer);
		}

		searchDebounceTimer = window.setTimeout(() => {
			renderServerList();
		}, SEARCH_DEBOUNCE_MS);
	});

	elements.prevPageButton.addEventListener('click', () => {
		if (state.currentPage <= 1) {
			return;
		}

		state.currentPage -= 1;
		renderServerList();
	});

	elements.nextPageButton.addEventListener('click', () => {
		const totalPages = getTotalPages(getFilteredServers().length);
		if (state.currentPage >= totalPages) {
			return;
		}

		state.currentPage += 1;
		renderServerList();
	});

	elements.exportButton.addEventListener('click', () => {
		void exportData();
	});

	elements.importButton.addEventListener('click', () => {
		elements.importFileInput.click();
	});

	elements.importFileInput.addEventListener('change', (event) => {
		void importData(event);
	});

	elements.settingsButton.addEventListener('click', openSettingsModal);
	elements.closeModalButton.addEventListener('click', closeSettingsModal);

	window.addEventListener('click', (event) => {
		if (event.target === elements.settingsModal) {
			closeSettingsModal();
		}
	});

	elements.languageSelect.addEventListener('change', async (event) => {
		const selectedLanguage = event.target.value || DEFAULT_LANGUAGE;

		await setLanguage(selectedLanguage);
		await applyLanguage(selectedLanguage);
		closeSettingsModal();
	});

	elements.dropdownToggle.addEventListener('click', toggleDropdownMenu);

	document.addEventListener('click', (event) => {
		if (
			event.target instanceof Node &&
			!elements.dropdownToggle.contains(event.target) &&
			!elements.dropdownMenu.contains(event.target)
		) {
			closeDropdownMenu();
		}
	});

	if (
		typeof chrome !== 'undefined' &&
		typeof chrome.runtime !== 'undefined' &&
		typeof chrome.runtime.onMessage !== 'undefined'
	) {
		chrome.runtime.onMessage.addListener((request) => {
			if (request?.action === 'storageChanged') {
				void loadServers();
			}
		});
	}
}

const resetButtonEffects = wireInteractiveResetButton({
	resetButton: elements.resetButton,
	modalContent: elements.modalContent,
	onConfirmReset: resetCounters,
});

async function init() {
	wireEvents();

	const savedLanguage = await getLanguage(DEFAULT_LANGUAGE);
	elements.languageSelect.value = savedLanguage;

	await applyLanguage(savedLanguage);
	await loadServers();
}

void init();
