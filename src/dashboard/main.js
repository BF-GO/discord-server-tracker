import '../popup/style.css';
import './style.css';

import {
	DASHBOARD_PAGE_SIZE,
	DEFAULT_LANGUAGE,
	DEFAULT_THEME,
	DEFAULT_TIME_FORMAT,
} from '../popup/constants.js';
import {
	getServerStats,
	parseStorageRecords,
	serverToStorageRecord,
} from '../popup/data.js';
import { applyTranslationsToDocument, loadTranslations, translate } from '../popup/i18n.js';
import {
	getAllStorage,
	getPreference,
	notifyStorageChanged,
	removeStorage,
	setPreference,
	setStorage,
} from '../popup/storage.js';

const state = {
	language: DEFAULT_LANGUAGE,
	theme: DEFAULT_THEME,
	timeFormat: DEFAULT_TIME_FORMAT,
	translations: {},
	servers: [],
	query: '',
	view: 'all',
	source: 'all',
	date: 'all',
	sort: 'last',
	visibleLimit: DASHBOARD_PAGE_SIZE,
	noteKey: null,
};

const elements = {
	searchInput: document.getElementById('search-input'),
	statsGrid: document.getElementById('stats-grid'),
	dashboardTabs: [...document.querySelectorAll('.dashboard-tab')],
	sourceFilter: document.getElementById('source-filter'),
	dateFilter: document.getElementById('date-filter'),
	sortSelect: document.getElementById('sort-select'),
	clearFilters: document.getElementById('clear-filters'),
	resultSummary: document.getElementById('result-summary'),
	dashboardList: document.getElementById('dashboard-list'),
	listFooter: document.getElementById('list-footer'),
	loadMore: document.getElementById('load-more'),
	settingsButton: document.getElementById('settings-button'),
	settingsDialog: document.getElementById('settings-dialog'),
	languageSelect: document.getElementById('language-select'),
	themeSelect: document.getElementById('theme-select'),
	timeFormatSelect: document.getElementById('time-format-select'),
	noteDialog: document.getElementById('note-dialog'),
	noteServerName: document.getElementById('note-server-name'),
	noteInput: document.getElementById('note-input'),
	saveNote: document.getElementById('save-note'),
	historyDialog: document.getElementById('history-dialog'),
	historyServerName: document.getElementById('history-server-name'),
	historyList: document.getElementById('history-dialog-list'),
	confirmDialog: document.getElementById('confirm-dialog'),
	confirmTitle: document.getElementById('confirm-title'),
	confirmMessage: document.getElementById('confirm-message'),
	confirmAction: document.getElementById('confirm-action'),
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

function locale() {
	return state.language === 'ru' ? 'ru-RU' : 'en-US';
}

function applyTheme(theme) {
	state.theme = ['light', 'dark'].includes(theme) ? theme : 'system';
	if (state.theme === 'system') document.documentElement.removeAttribute('data-theme');
	else document.documentElement.dataset.theme = state.theme;
}

function formatDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return t('notAvailable', 'Not available');
	return date.toLocaleString(locale(), {
		year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
		hour12: state.timeFormat === '12',
	});
}

function getDateBoundary() {
	const now = new Date();
	if (state.date === 'today') {
		return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	}
	if (state.date === '7' || state.date === '30') {
		return Date.now() - Number(state.date) * 24 * 60 * 60 * 1000;
	}
	return 0;
}

function getFilteredServers() {
	const query = state.query.trim().toLocaleLowerCase();
	const boundary = getDateBoundary();
	let servers = state.servers.filter((server) => {
		if (state.view === 'archived' ? !server.archived : server.archived) return false;
		if (state.view === 'favorites' && !server.favorite) return false;
		if (state.view === 'recent' && server.lastVisited < Date.now() - 30 * 24 * 60 * 60 * 1000) return false;
		if (state.source !== 'all' && server.site !== state.source) return false;
		if (boundary && server.lastVisited < boundary) return false;
		if (query && ![server.name, server.site, server.note].some((value) => String(value || '').toLocaleLowerCase().includes(query))) return false;
		return true;
	});

	const sorters = {
		last: (left, right) => right.lastVisited - left.lastVisited,
		visits: (left, right) => right.count - left.count || right.lastVisited - left.lastVisited,
		name: (left, right) => left.name.localeCompare(right.name, locale(), { sensitivity: 'base' }),
		first: (left, right) => right.firstVisitedAt - left.firstVisitedAt,
	};
	servers = [...servers].sort(sorters[state.sort] || sorters.last);
	return servers;
}

function renderStats() {
	const stats = getServerStats(state.servers);
	const values = [
		[t('trackedServers', 'Tracked servers'), stats.totalServers, t('archived', 'Archived') + `: ${state.servers.filter((server) => server.archived).length}`],
		[t('totalVisits', 'Total visits'), stats.totalVisits, t('allTime', 'All time')],
		[t('visits7', 'Visits · 7 days'), stats.visits7, t('recent', 'Recent')],
		[t('visits30', 'Visits · 30 days'), stats.visits30, t('activity', 'Activity')],
		[t('topServer', 'Top server'), stats.mostVisited?.name || '—', stats.mostVisited ? `${stats.mostVisited.count} ${t('visits', 'visits').toLocaleLowerCase()}` : t('noHistory', 'No visit history')],
	];
	elements.statsGrid.innerHTML = values.map(([label, value, detail]) => `
		<article class="stat-card"><span class="stat-card__label">${escapeHtml(label)}</span><strong class="stat-card__value" title="${escapeHtml(value)}">${escapeHtml(value)}</strong><span class="stat-card__detail">${escapeHtml(detail)}</span></article>
	`).join('');
}

const icon = {
	star: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
	note: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v13H9l-4 4V4Z"/></svg>',
	history: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6V4"/><path d="M12 7v5l3 2"/></svg>',
	copy: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
	external: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 5h5v5M19 5l-8 8"/><path d="M19 13v6H5V5h6"/></svg>',
	archive: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16v13H4V7ZM3 4h18v3H3V4Z"/><path d="M9 11h6"/></svg>',
	restore: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6V4"/><path d="M12 8v4l-3 2"/></svg>',
	delete: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>',
};

function actionButton(action, label, svg, classes = '') {
	return `<button class="row-action ${classes}" type="button" data-action="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${svg}</button>`;
}

function renderRow(server) {
	const sourceUrl = safeUrl(server.mainLink);
	const joinUrl = safeUrl(server.joinLink);
	return `
		<article class="dashboard-row" data-key="${escapeHtml(server.key)}">
			<div class="dashboard-row__server">
				<div class="dashboard-row__title">${server.favorite ? '<span class="favorite-dot">★</span>' : ''}<strong>${escapeHtml(server.name)}</strong></div>
				<span class="dashboard-row__site">${escapeHtml(server.site)}</span>
				${server.note ? `<span class="dashboard-row__note" title="${escapeHtml(server.note)}">${escapeHtml(server.note)}</span>` : ''}
			</div>
			<div class="dashboard-row__metric"><small>${escapeHtml(t('lastVisit', 'Last visit'))}</small>${escapeHtml(formatDate(server.lastVisited))}</div>
			<div class="dashboard-row__metric dashboard-row__metric--first"><small>${escapeHtml(t('firstVisit', 'First visit'))}</small>${escapeHtml(formatDate(server.firstVisitedAt))} · ${server.count} ${escapeHtml(t('visits', 'visits').toLocaleLowerCase())}</div>
			<div class="dashboard-row__actions">
				${actionButton('favorite', server.favorite ? t('removeFavorite', 'Remove favorite') : t('addFavorite', 'Add favorite'), icon.star, server.favorite ? 'is-favorite' : '')}
				${actionButton('note', server.note ? t('editNote', 'Edit note') : t('addNote', 'Add note'), icon.note)}
				${actionButton('history', t('showHistory', 'Show visit history'), icon.history)}
				${joinUrl ? actionButton('copy', t('copyInvite', 'Copy invite link'), icon.copy) : ''}
				${sourceUrl ? `<a class="row-action" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t('openSource', 'Open source page'))}" title="${escapeHtml(t('openSource', 'Open source page'))}">${icon.external}</a>` : ''}
				${joinUrl ? `<a class="row-action" href="${escapeHtml(joinUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t('join', 'Join'))}" title="${escapeHtml(t('join', 'Join'))}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></a>` : ''}
				${server.archived
					? actionButton('restore', t('restore', 'Restore'), icon.restore) + actionButton('delete', t('deletePermanently', 'Delete permanently'), icon.delete, 'is-danger')
					: actionButton('archive', t('archive', 'Archive'), icon.archive, 'is-danger')}
			</div>
		</article>`;
}

function renderList() {
	const filtered = getFilteredServers();
	const visible = filtered.slice(0, state.visibleLimit);
	elements.dashboardList.setAttribute('aria-busy', 'false');
	elements.resultSummary.textContent = t('showingResults', 'Showing {shown} of {total}')
		.replace('{shown}', String(visible.length)).replace('{total}', String(filtered.length));
	if (!visible.length) {
		elements.dashboardList.innerHTML = `<div class="dashboard-empty"><div><h2>${escapeHtml(t('noDashboardResults', 'No servers match these filters'))}</h2><p>${escapeHtml(t('noDashboardResultsDescription', 'Clear one or more filters to see your history.'))}</p></div></div>`;
	} else {
		elements.dashboardList.innerHTML = visible.map(renderRow).join('');
	}
	elements.listFooter.hidden = visible.length >= filtered.length;
}

function render() {
	renderStats();
	renderList();
}

async function loadServers() {
	const storage = await getAllStorage();
	const parsed = parseStorageRecords(storage, t('unknownServer', 'Unknown server'));
	state.servers = parsed.servers;
	if (Object.keys(parsed.storageUpdates).length) await setStorage(parsed.storageUpdates);
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

function showToast(message, { actionLabel = '', onAction = null, error = false } = {}) {
	const toast = document.createElement('div');
	toast.className = `toast${error ? ' toast--error' : ''}`;
	const label = document.createElement('span');
	label.textContent = message;
	toast.append(label);
	if (actionLabel && onAction) {
		const action = document.createElement('button');
		action.className = 'toast__action';
		action.type = 'button';
		action.textContent = actionLabel;
		action.addEventListener('click', async () => { await onAction(); toast.remove(); }, { once: true });
		toast.append(action);
	}
	elements.toastRegion.append(toast);
	window.setTimeout(() => toast.remove(), 5000);
}

function openNote(server) {
	state.noteKey = server.key;
	elements.noteServerName.textContent = server.name;
	elements.noteInput.value = server.note || '';
	elements.noteDialog.showModal();
	elements.noteInput.focus();
}

function openHistory(server) {
	elements.historyServerName.textContent = server.name;
	elements.historyList.innerHTML = server.history.length
		? server.history.map((entry, index) => `<div class="full-history__row"><span>${index + 1}</span><span>${escapeHtml(formatDate(entry))}</span></div>`).join('')
		: `<p class="muted">${escapeHtml(t('noHistory', 'No visit history'))}</p>`;
	elements.historyDialog.showModal();
}

function requestConfirmation({ title, message, confirmLabel }) {
	elements.confirmTitle.textContent = title;
	elements.confirmMessage.textContent = message;
	elements.confirmAction.textContent = confirmLabel;
	elements.confirmDialog.showModal();
	return new Promise((resolve) => {
		const accept = () => {
			elements.confirmDialog.removeEventListener('close', cancel);
			elements.confirmDialog.close();
			resolve(true);
		};
		const cancel = () => {
			elements.confirmAction.removeEventListener('click', accept);
			resolve(false);
		};
		elements.confirmAction.addEventListener('click', accept, { once: true });
		elements.confirmDialog.addEventListener('close', cancel, { once: true });
	});
}

async function handleAction(event) {
	const row = event.target.closest('.dashboard-row');
	const action = event.target.closest('[data-action]')?.dataset.action;
	if (!row || !action) return;
	const server = state.servers.find((entry) => entry.key === row.dataset.key);
	if (!server) return;

	switch (action) {
		case 'favorite': await updateServer(server.key, { favorite: !server.favorite }); break;
		case 'note': openNote(server); break;
		case 'history': openHistory(server); break;
		case 'copy':
			try { await navigator.clipboard.writeText(safeUrl(server.joinLink)); showToast(t('inviteCopied', 'Invite link copied.')); }
			catch { showToast(t('copyError', 'Could not copy the invite link.'), { error: true }); }
			break;
		case 'archive':
			await updateServer(server.key, { archived: true });
			showToast(t('serverArchived', 'Server archived.'), { actionLabel: t('undo', 'Undo'), onAction: () => updateServer(server.key, { archived: false }) });
			break;
		case 'restore': await updateServer(server.key, { archived: false }); showToast(t('serverRestored', 'Server restored.')); break;
		case 'delete': {
			const confirmed = await requestConfirmation({ title: t('confirmDeleteTitle', 'Delete server permanently?'), message: t('confirmDeleteMessage', 'This removes the server and all visit history. This action cannot be undone.'), confirmLabel: t('deletePermanently', 'Delete permanently') });
			if (!confirmed) return;
			await removeStorage(server.key);
			state.servers = state.servers.filter((entry) => entry.key !== server.key);
			notifyStorageChanged();
			render();
			showToast(t('serverDeleted', 'Server permanently deleted.'));
			break;
		}
	}
}

async function setLanguage(language) {
	state.language = language === 'ru' ? 'ru' : 'en';
	state.translations = await loadTranslations(state.language);
	document.documentElement.lang = state.language;
	document.title = `${t('dashboardTitle', 'Server history')} · ${t('appTitle', 'Discord Server Tracker')}`;
	applyTranslationsToDocument(state.translations);
	await setPreference('language', state.language);
	render();
}

function resetLimitAndRender() {
	state.visibleLimit = DASHBOARD_PAGE_SIZE;
	renderList();
}

function wireEvents() {
	elements.searchInput.addEventListener('input', (event) => { state.query = event.target.value; resetLimitAndRender(); });
	elements.dashboardTabs.forEach((tab) => tab.addEventListener('click', () => {
		state.view = tab.dataset.view;
		elements.dashboardTabs.forEach((entry) => {
			const active = entry === tab;
			entry.classList.toggle('is-active', active);
			entry.setAttribute('aria-selected', String(active));
		});
		resetLimitAndRender();
	}));
	elements.sourceFilter.addEventListener('change', (event) => { state.source = event.target.value; resetLimitAndRender(); });
	elements.dateFilter.addEventListener('change', (event) => { state.date = event.target.value; resetLimitAndRender(); });
	elements.sortSelect.addEventListener('change', (event) => { state.sort = event.target.value; resetLimitAndRender(); });
	elements.clearFilters.addEventListener('click', () => {
		state.query = ''; state.source = 'all'; state.date = 'all'; state.sort = 'last';
		elements.searchInput.value = ''; elements.sourceFilter.value = 'all'; elements.dateFilter.value = 'all'; elements.sortSelect.value = 'last';
		resetLimitAndRender();
	});
	elements.loadMore.addEventListener('click', () => { state.visibleLimit += DASHBOARD_PAGE_SIZE; renderList(); });
	elements.dashboardList.addEventListener('click', (event) => { void handleAction(event); });
	elements.settingsButton.addEventListener('click', () => elements.settingsDialog.showModal());
	elements.languageSelect.addEventListener('change', (event) => { void setLanguage(event.target.value); });
	elements.themeSelect.addEventListener('change', async (event) => { applyTheme(event.target.value); await setPreference('theme', state.theme); });
	elements.timeFormatSelect.addEventListener('change', async (event) => {
		state.timeFormat = event.target.value === '12' ? '12' : '24';
		await setPreference('timeFormat', state.timeFormat);
		notifyStorageChanged();
		render();
	});
	elements.saveNote.addEventListener('click', async () => {
		if (state.noteKey) await updateServer(state.noteKey, { note: elements.noteInput.value.trim().slice(0, 500) });
		elements.noteDialog.close();
		showToast(t('noteSaved', 'Note saved.'));
	});
	if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
		chrome.runtime.onMessage.addListener((request) => {
			if (request?.action === 'storageChanged') void loadServers();
		});
	}
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
	document.title = `${t('dashboardTitle', 'Server history')} · ${t('appTitle', 'Discord Server Tracker')}`;
	applyTranslationsToDocument(state.translations);
	elements.languageSelect.value = state.language;
	elements.themeSelect.value = state.theme;
	elements.timeFormatSelect.value = state.timeFormat;
	wireEvents();
	await loadServers();
	elements.searchInput.focus();
}

run().catch((error) => {
	console.error('[Discord Server Tracker] Dashboard initialization failed:', error);
	elements.dashboardList.setAttribute('aria-busy', 'false');
	elements.dashboardList.innerHTML = `<div class="dashboard-empty"><div><h2>${escapeHtml(t('loadError', 'Could not load server history'))}</h2><p>${escapeHtml(t('tryAgain', 'Refresh the page and try again.'))}</p></div></div>`;
});
