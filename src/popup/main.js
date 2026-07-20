import './style.css';

import { DEFAULT_LANGUAGE, DEFAULT_THEME, DEFAULT_TIME_FORMAT } from './constants.js';
import {
	getServerStats,
	isServerStorageKey,
	mergeServerRecords,
	parseStorageRecords,
	serverToStorageRecord,
} from './data.js';
import { applyTranslationsToDocument, loadTranslations, translate } from './i18n.js';
import {
	getAllStorage,
	getExtensionUrl,
	getPreference,
	notifyStorageChanged,
	removeStorage,
	setPreference,
	setStorage,
} from './storage.js';

const state = {
	language: DEFAULT_LANGUAGE,
	theme: DEFAULT_THEME,
	timeFormat: DEFAULT_TIME_FORMAT,
	translations: {},
	servers: [],
	query: '',
	view: 'recent',
	expandedKey: null,
	noteKey: null,
	pendingImport: null,
};

const elements = {
	headerSummary: document.getElementById('header-summary'),
	searchInput: document.getElementById('search-input'),
	serverList: document.getElementById('server-list'),
	viewTabs: [...document.querySelectorAll('.view-tab')],
	settingsButton: document.getElementById('settings-button'),
	settingsDialog: document.getElementById('settings-dialog'),
	languageSelect: document.getElementById('language-select'),
	themeSelect: document.getElementById('theme-select'),
	timeFormatSelect: document.getElementById('time-format-select'),
	exportButton: document.getElementById('export-button'),
	importButton: document.getElementById('import-button'),
	resetButton: document.getElementById('reset-button'),
	importFileInput: document.getElementById('import-file-input'),
	importDialog: document.getElementById('import-dialog'),
	importMerge: document.getElementById('import-merge'),
	importReplace: document.getElementById('import-replace'),
	noteDialog: document.getElementById('note-dialog'),
	noteServerName: document.getElementById('note-server-name'),
	noteInput: document.getElementById('note-input'),
	saveNoteButton: document.getElementById('save-note'),
	confirmDialog: document.getElementById('confirm-dialog'),
	confirmTitle: document.getElementById('confirm-title'),
	confirmMessage: document.getElementById('confirm-message'),
	confirmAction: document.getElementById('confirm-action'),
	openDashboard: document.getElementById('open-dashboard'),
	toastRegion: document.getElementById('toast-region'),
};

function t(key, fallback = key) {
	return translate(state.translations, key, fallback);
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function safeUrl(value) {
	try {
		const url = new URL(value);
		return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
	} catch {
		return '';
	}
}

function applyTheme(theme) {
	state.theme = ['light', 'dark'].includes(theme) ? theme : 'system';
	if (state.theme === 'system') {
		document.documentElement.removeAttribute('data-theme');
	} else {
		document.documentElement.dataset.theme = state.theme;
	}
}

function locale() {
	return state.language === 'ru' ? 'ru-RU' : 'en-US';
}

function dateOptions() {
	return {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: state.timeFormat === '12',
	};
}

function formatDate(timestamp) {
	if (!timestamp) return t('notAvailable', 'Not available');
	const date = new Date(timestamp);
	return Number.isNaN(date.getTime()) ? t('notAvailable', 'Not available') : date.toLocaleString(locale(), dateOptions());
}

function formatRelative(timestamp) {
	if (!timestamp) return t('never', 'Never');
	const seconds = Math.round((timestamp - Date.now()) / 1000);
	const formatter = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
	if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
	const minutes = Math.round(seconds / 60);
	if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
	const days = Math.round(hours / 24);
	if (Math.abs(days) < 30) return formatter.format(days, 'day');
	return formatDate(timestamp);
}

function getVisibleServers() {
	const query = state.query.trim().toLocaleLowerCase();
	let servers = state.servers.filter((server) => !server.archived);
	if (query) {
		servers = servers.filter((server) => [server.name, server.site, server.note]
			.some((value) => String(value || '').toLocaleLowerCase().includes(query)));
	}

	if (state.view === 'favorites') {
		servers = servers.filter((server) => server.favorite);
	} else if (state.view === 'popular') {
		servers = [...servers].sort((left, right) => right.count - left.count || right.lastVisited - left.lastVisited);
	} else {
		servers = [...servers].sort((left, right) => right.lastVisited - left.lastVisited);
	}

	return servers;
}

const icons = {
	star: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
	more: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
	clock: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

function renderCard(server) {
	const expanded = state.expandedKey === server.key;
	const history = server.history.slice(0, 5);
	const mainLink = safeUrl(server.mainLink);
	const joinLink = safeUrl(server.joinLink);
	return `
		<article class="server-card" data-key="${escapeHtml(server.key)}">
			<div class="server-card__main">
				<div>
					<div class="server-card__title-row"><button class="server-card__title" type="button" data-action="history" aria-expanded="${expanded}">${escapeHtml(server.name)}</button></div>
					<span class="server-card__site">${escapeHtml(server.site)}</span>
					<div class="server-card__meta"><span>${icons.clock}${escapeHtml(formatRelative(server.lastVisited))}</span><span>${escapeHtml(t('visits', 'Visits'))}: ${server.count}</span></div>
				</div>
				<div class="server-card__actions">
					<button class="mini-button ${server.favorite ? 'is-favorite' : ''}" type="button" data-action="favorite" aria-label="${escapeHtml(server.favorite ? t('removeFavorite', 'Remove favorite') : t('addFavorite', 'Add favorite'))}">${icons.star}</button>
					<details class="card-menu">
						<summary class="mini-button" aria-label="${escapeHtml(t('moreActions', 'More actions'))}">${icons.more}</summary>
						<div class="card-menu__popover">
							<button type="button" data-action="note">${escapeHtml(server.note ? t('editNote', 'Edit note') : t('addNote', 'Add note'))}</button>
							${joinLink ? `<button type="button" data-action="copy">${escapeHtml(t('copyInvite', 'Copy invite link'))}</button>` : ''}
							${mainLink ? `<a href="${escapeHtml(mainLink)}" target="_blank" rel="noopener">${escapeHtml(t('openSource', 'Open source page'))}</a>` : ''}
							<button type="button" data-action="history">${escapeHtml(t('showHistory', 'Show visit history'))}</button>
							<button class="danger-action" type="button" data-action="archive">${escapeHtml(t('archive', 'Archive'))}</button>
							<button class="danger-action" type="button" data-action="delete">${escapeHtml(t('deletePermanently', 'Delete permanently'))}</button>
						</div>
					</details>
					${joinLink ? `<a class="mini-button" href="${escapeHtml(joinLink)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t('join', 'Join'))}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg></a>` : ''}
				</div>
			</div>
			${expanded ? `
				<div class="server-card__details">
					<div class="details-summary">
						<div class="details-stat"><span>${escapeHtml(t('firstVisit', 'First visit'))}</span><strong title="${escapeHtml(formatDate(server.firstVisitedAt))}">${escapeHtml(formatRelative(server.firstVisitedAt))}</strong></div>
						<div class="details-stat"><span>${escapeHtml(t('lastVisit', 'Last visit'))}</span><strong title="${escapeHtml(formatDate(server.lastVisited))}">${escapeHtml(formatRelative(server.lastVisited))}</strong></div>
						<div class="details-stat"><span>${escapeHtml(t('totalVisits', 'Total visits'))}</span><strong>${server.count}</strong></div>
					</div>
					${server.note ? `<p class="note-preview">${escapeHtml(server.note)}</p>` : ''}
					<div class="history-list">${history.length ? history.map((entry) => `<span class="history-chip">${escapeHtml(formatDate(entry))}</span>`).join('') : `<span class="muted">${escapeHtml(t('noHistory', 'No visit history'))}</span>`}</div>
				</div>` : ''}
		</article>`;
}

function render() {
	const stats = getServerStats(state.servers);
	elements.headerSummary.textContent = t('summaryCompact', '{servers} servers · {visits} visits')
		.replace('{servers}', String(stats.totalServers))
		.replace('{visits}', String(stats.totalVisits));

	const visible = getVisibleServers();
	elements.serverList.setAttribute('aria-busy', 'false');
	if (visible.length) {
		elements.serverList.innerHTML = visible.map(renderCard).join('');
		return;
	}

	const isFirstRun = state.servers.length === 0;
	elements.serverList.innerHTML = `
		<div class="empty-state"><div><div class="empty-state__icon" aria-hidden="true">${isFirstRun ? '✦' : '⌕'}</div>
		<h2>${escapeHtml(isFirstRun ? t('firstRunTitle', 'No tracked servers yet') : t('emptyViewTitle', 'Nothing found'))}</h2>
		<p>${escapeHtml(isFirstRun ? t('firstRunDescription', 'Visit one of the supported listing websites and click a server join button. The server will appear here automatically.') : t('emptyViewDescription', 'Try another search or switch the current view.'))}</p>
		${isFirstRun ? `<button class="secondary-button" type="button" data-action="show-tracking-info">${escapeHtml(t('viewSupportedWebsites', 'View supported websites'))}</button>` : ''}
		</div></div>`;
}

async function loadServers() {
	const storage = await getAllStorage();
	const parsed = parseStorageRecords(storage, t('unknownServer', 'Unknown server'));
	state.servers = parsed.servers;
	if (Object.keys(parsed.storageUpdates).length) {
		await setStorage(parsed.storageUpdates);
	}
	render();
}

async function updateServer(key, patch) {
	const server = state.servers.find((entry) => entry.key === key);
	if (!server) return;
	Object.assign(server, patch);
	await setStorage({ [key]: serverToStorageRecord(server) });
	notifyStorageChanged();
	render();
}

function showToast(message, { error = false, actionLabel = '', onAction = null } = {}) {
	const toast = document.createElement('div');
	toast.className = `toast${error ? ' toast--error' : ''}`;
	const text = document.createElement('span');
	text.textContent = message;
	toast.append(text);
	if (actionLabel && onAction) {
		const button = document.createElement('button');
		button.className = 'toast__action';
		button.type = 'button';
		button.textContent = actionLabel;
		button.addEventListener('click', async () => {
			await onAction();
			toast.remove();
		}, { once: true });
		toast.append(button);
	}
	elements.toastRegion.append(toast);
	window.setTimeout(() => toast.remove(), 5000);
}

function requestConfirmation({ title, message, confirmLabel }) {
	elements.confirmTitle.textContent = title;
	elements.confirmMessage.textContent = message;
	elements.confirmAction.textContent = confirmLabel || t('confirm', 'Confirm');
	elements.confirmDialog.showModal();
	return new Promise((resolve) => {
		const finish = (result) => {
			elements.confirmAction.removeEventListener('click', accept);
			elements.confirmDialog.removeEventListener('close', cancel);
			resolve(result);
		};
		const accept = () => { elements.confirmDialog.close('confirmed'); finish(true); };
		const cancel = () => finish(elements.confirmDialog.returnValue === 'confirmed');
		elements.confirmAction.addEventListener('click', accept, { once: true });
		elements.confirmDialog.addEventListener('close', cancel, { once: true });
	});
}

async function archiveServer(server) {
	await updateServer(server.key, { archived: true });
	showToast(t('serverArchived', 'Server archived.'), {
		actionLabel: t('undo', 'Undo'),
		onAction: () => updateServer(server.key, { archived: false }),
	});
}

async function deleteServer(server) {
	const confirmed = await requestConfirmation({
		title: t('confirmDeleteTitle', 'Delete server permanently?'),
		message: t('confirmDeleteMessage', 'This removes the server and all visit history. This action cannot be undone.'),
		confirmLabel: t('deletePermanently', 'Delete permanently'),
	});
	if (!confirmed) return;

	await removeStorage(server.key);
	state.servers = state.servers.filter((entry) => entry.key !== server.key);
	notifyStorageChanged();
	render();
	showToast(t('serverDeleted', 'Server permanently deleted.'));
}

function openNoteDialog(server) {
	state.noteKey = server.key;
	elements.noteServerName.textContent = server.name;
	elements.noteInput.value = server.note || '';
	elements.noteDialog.showModal();
	elements.noteInput.focus();
}

async function handleListAction(event) {
	const action = event.target.closest('[data-action]')?.dataset.action;
	if (action === 'show-tracking-info') {
		elements.settingsDialog.showModal();
		document.getElementById('tracking-info')?.scrollIntoView({ block: 'nearest' });
		return;
	}

	const card = event.target.closest('.server-card');
	if (!card) return;
	const server = state.servers.find((entry) => entry.key === card.dataset.key);
	if (!server) return;
	if (action) {
		event.preventDefault();
		event.stopPropagation();
		card.querySelector('.card-menu')?.removeAttribute('open');
	}

	switch (action) {
		case 'favorite': await updateServer(server.key, { favorite: !server.favorite }); break;
		case 'note': openNoteDialog(server); break;
		case 'copy':
			try {
				await navigator.clipboard.writeText(safeUrl(server.joinLink));
				showToast(t('inviteCopied', 'Invite link copied.'));
			} catch { showToast(t('copyError', 'Could not copy the invite link.'), { error: true }); }
			break;
		case 'history':
			state.expandedKey = state.expandedKey === server.key ? null : server.key;
			render();
			break;
		case 'archive': await archiveServer(server); break;
		case 'delete': await deleteServer(server); break;
		default:
			if (event.target.closest('.server-card__main') && !event.target.closest('a, button, summary, details')) {
				state.expandedKey = state.expandedKey === server.key ? null : server.key;
				render();
			}
	}
}

function parseImportPayload(payload) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid');
	const records = payload.servers && typeof payload.servers === 'object' ? payload.servers : payload;
	const valid = Object.fromEntries(Object.entries(records).filter(([key, value]) => (
		isServerStorageKey(key) && value && typeof value === 'object' && !Array.isArray(value)
	)));
	if (!Object.keys(valid).length) throw new Error('empty');
	return valid;
}

async function importData(mode) {
	try {
		const incoming = state.pendingImport;
		const current = await getAllStorage();
		const next = {};
		for (const [key, rawRecord] of Object.entries(incoming)) {
			const parsed = parseStorageRecords({ [key]: rawRecord }, t('unknownServer', 'Unknown server'));
			const server = parsed.servers[0];
			if (!server) continue;
			next[key] = mode === 'merge' && current[key]
				? mergeServerRecords(current[key], rawRecord, server.site, server.id)
				: serverToStorageRecord(server);
		}
		if (!Object.keys(next).length) throw new Error('empty');
		if (mode === 'replace') {
			await removeStorage(Object.keys(current).filter(isServerStorageKey));
		}
		await setStorage(next);
		notifyStorageChanged();
		elements.importDialog.close();
		state.pendingImport = null;
		await loadServers();
		showToast(t('importSuccess', 'Data imported successfully.'));
	} catch {
		showToast(t('importError', 'Import failed. Check the file format and try again.'), { error: true });
	}
}

function exportData() {
	try {
		const servers = Object.fromEntries(state.servers.map((server) => [server.key, serverToStorageRecord(server)]));
		const blob = new Blob([JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), servers }, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `discord-server-tracker-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
		showToast(t('exportSuccess', 'Data exported.'));
	} catch {
		showToast(t('exportError', 'Could not export data.'), { error: true });
	}
}

async function setLanguage(language) {
	state.language = language === 'ru' ? 'ru' : 'en';
	state.translations = await loadTranslations(state.language);
	document.documentElement.lang = state.language;
	applyTranslationsToDocument(state.translations);
	await setPreference('language', state.language);
	render();
}

function wireEvents() {
	elements.searchInput.addEventListener('input', (event) => { state.query = event.target.value; render(); });
	elements.viewTabs.forEach((tab) => tab.addEventListener('click', () => {
		state.view = tab.dataset.view;
		elements.viewTabs.forEach((entry) => {
			const active = entry === tab;
			entry.classList.toggle('is-active', active);
			entry.setAttribute('aria-selected', String(active));
		});
		render();
	}));
	elements.serverList.addEventListener('click', (event) => { void handleListAction(event); });
	elements.settingsButton.addEventListener('click', () => elements.settingsDialog.showModal());
	elements.openDashboard.addEventListener('click', () => window.open(getExtensionUrl('dashboard.html'), '_blank', 'noopener'));
	elements.languageSelect.addEventListener('change', (event) => { void setLanguage(event.target.value); });
	elements.themeSelect.addEventListener('change', async (event) => { applyTheme(event.target.value); await setPreference('theme', state.theme); });
	elements.timeFormatSelect.addEventListener('change', async (event) => {
		state.timeFormat = event.target.value === '12' ? '12' : '24';
		await setPreference('timeFormat', state.timeFormat);
		notifyStorageChanged();
		render();
	});
	elements.exportButton.addEventListener('click', exportData);
	elements.importButton.addEventListener('click', () => elements.importFileInput.click());
	elements.importFileInput.addEventListener('change', async () => {
		try {
			const file = elements.importFileInput.files?.[0];
			if (!file) return;
			state.pendingImport = parseImportPayload(JSON.parse(await file.text()));
			elements.importDialog.showModal();
		} catch { showToast(t('importError', 'Import failed. Check the file format and try again.'), { error: true }); }
		elements.importFileInput.value = '';
	});
	elements.importMerge.addEventListener('click', () => { void importData('merge'); });
	elements.importReplace.addEventListener('click', () => { void importData('replace'); });
	elements.saveNoteButton.addEventListener('click', async () => {
		if (state.noteKey) await updateServer(state.noteKey, { note: elements.noteInput.value.trim().slice(0, 500) });
		elements.noteDialog.close();
		showToast(t('noteSaved', 'Note saved.'));
	});
	elements.resetButton.addEventListener('click', async () => {
		const confirmed = await requestConfirmation({
			title: t('resetData', 'Reset tracked data'),
			message: t('confirmReset', 'Delete all tracked servers and visit history? Your language, theme, and time format will be kept.'),
			confirmLabel: t('reset', 'Reset'),
		});
		if (!confirmed) return;
		const storage = await getAllStorage();
		await removeStorage(Object.keys(storage).filter(isServerStorageKey));
		notifyStorageChanged();
		elements.settingsDialog.close();
		await loadServers();
		showToast(t('dataReset', 'Tracked data reset.'));
	});
}

async function run() {
	[state.language, state.theme, state.timeFormat] = await Promise.all([
		getPreference('language', DEFAULT_LANGUAGE),
		getPreference('theme', DEFAULT_THEME),
		getPreference('timeFormat', DEFAULT_TIME_FORMAT),
	]);
	state.language = state.language === 'ru' ? 'ru' : 'en';
	state.timeFormat = state.timeFormat === '12' ? '12' : '24';
	applyTheme(state.theme);
	state.translations = await loadTranslations(state.language);
	document.documentElement.lang = state.language;
	applyTranslationsToDocument(state.translations);
	elements.languageSelect.value = state.language;
	elements.themeSelect.value = state.theme;
	elements.timeFormatSelect.value = state.timeFormat;
	wireEvents();
	await loadServers();
	elements.searchInput.focus();
}

run().catch((error) => {
	console.error('[Discord Server Tracker] Popup initialization failed:', error);
	elements.serverList.setAttribute('aria-busy', 'false');
	elements.serverList.innerHTML = `<div class="empty-state"><div><h2>${escapeHtml(t('loadError', 'Could not load server history'))}</h2><p>${escapeHtml(t('tryAgain', 'Close the popup and try again.'))}</p></div></div>`;
});
