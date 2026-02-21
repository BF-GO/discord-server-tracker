import { SITE_BASE_URLS } from './constants.js';

function splitStorageKey(storageKey) {
	const separatorIndex = storageKey.indexOf('_');
	if (separatorIndex === -1) {
		return null;
	}

	return {
		site: storageKey.slice(0, separatorIndex),
		id: storageKey.slice(separatorIndex + 1),
	};
}

function normalizeHistory(history) {
	if (!Array.isArray(history)) {
		return [];
	}

	return history
		.filter((entry) => typeof entry === 'string' && entry.length > 0);
}

function normalizeLastVisited(lastVisited) {
	return typeof lastVisited === 'number' && Number.isFinite(lastVisited)
		? lastVisited
		: 0;
}

function normalizeCount(count) {
	const normalized = Number(count);
	return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function buildMainLink(site, serverId) {
	const base = SITE_BASE_URLS[site] || '';
	if (!base) {
		return '';
	}

	return `${base}${serverId}`;
}

function buildJoinLink(site, serverId, mainLink) {
	if (site === 'discordserver.info') {
		return mainLink || buildMainLink(site, serverId);
	}

	if (site === 'disboard.org') {
		return `https://disboard.org/server/join/${serverId}`;
	}

	const normalizedMainLink = mainLink || buildMainLink(site, serverId);
	return normalizedMainLink ? `${normalizedMainLink}/join` : '';
}

function normalizeStoredRecord(site, serverId, rawRecord) {
	if (!rawRecord || typeof rawRecord !== 'object') {
		return null;
	}

	const nextRecord = { ...rawRecord };
	let changed = false;

	if (site === 'server-discord.com' && !nextRecord.mainLink && nextRecord.link) {
		nextRecord.mainLink = nextRecord.link;
		delete nextRecord.link;
		changed = true;
	}

	if (site === 'myserver.gg' && !nextRecord.mainLink && nextRecord.joinLink) {
		nextRecord.mainLink = buildMainLink(site, serverId);
		changed = true;
	}

	const normalizedCount = normalizeCount(nextRecord.count);
	if (nextRecord.count !== normalizedCount) {
		nextRecord.count = normalizedCount;
		changed = true;
	}

	const normalizedHistory = normalizeHistory(nextRecord.history);
	if (
		!Array.isArray(nextRecord.history) ||
		nextRecord.history.length !== normalizedHistory.length ||
		nextRecord.history.some((entry, index) => entry !== normalizedHistory[index])
	) {
		nextRecord.history = normalizedHistory;
		changed = true;
	}

	const normalizedLastVisited = normalizeLastVisited(nextRecord.lastVisited);
	if (nextRecord.lastVisited !== normalizedLastVisited) {
		nextRecord.lastVisited = normalizedLastVisited;
		changed = true;
	}

	if (!nextRecord.mainLink) {
		nextRecord.mainLink = buildMainLink(site, serverId);
		changed = true;
	}

	if (!nextRecord.joinLink) {
		nextRecord.joinLink = buildJoinLink(site, serverId, nextRecord.mainLink);
		changed = true;
	}

	return { normalized: nextRecord, changed };
}

export function parseStorageRecords(storageMap, unknownServerLabel) {
	const servers = [];
	const storageUpdates = {};

	for (const [storageKey, rawRecord] of Object.entries(storageMap)) {
		const parsedKey = splitStorageKey(storageKey);
		if (!parsedKey) {
			continue;
		}

		const { site, id } = parsedKey;
		const result = normalizeStoredRecord(site, id, rawRecord);
		if (!result) {
			continue;
		}

		if (result.changed) {
			storageUpdates[storageKey] = result.normalized;
		}

		if (result.normalized.count <= 0) {
			continue;
		}

		servers.push({
			key: storageKey,
			site,
			id,
			count: result.normalized.count,
			name: result.normalized.name || unknownServerLabel,
			searchName: (result.normalized.name || unknownServerLabel).toLowerCase(),
			mainLink: result.normalized.mainLink,
			joinLink: result.normalized.joinLink,
			history: result.normalized.history,
			lastVisited: result.normalized.lastVisited,
		});
	}

	servers.sort((left, right) => right.lastVisited - left.lastVisited);

	return { servers, storageUpdates };
}

export function buildUpdatedServerPayload(existingRecord) {
	const now = Date.now();
	const history = Array.isArray(existingRecord.history) ? [...existingRecord.history] : [];

	history.unshift(new Date(now).toISOString());

	return {
		...existingRecord,
		count: (Number(existingRecord.count) || 0) + 1,
		history,
		lastVisited: now,
	};
}

