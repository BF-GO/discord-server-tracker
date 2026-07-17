import { SITE_BASE_URLS, SUPPORTED_SITES } from './constants.js';

function splitStorageKey(storageKey) {
	const site = SUPPORTED_SITES.find((candidate) => storageKey.startsWith(`${candidate}_`));
	if (!site) {
		return null;
	}

	const id = storageKey.slice(site.length + 1);
	return id ? { site, id } : null;
}

export function isServerStorageKey(storageKey) {
	return splitStorageKey(storageKey) !== null;
}

function normalizeHistory(history) {
	if (!Array.isArray(history)) {
		return [];
	}

	return [...new Set(
		history.filter((entry) => {
			if (typeof entry !== 'string' || entry.length === 0) {
				return false;
			}

			return !Number.isNaN(new Date(entry).getTime());
		})
	)].sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
}

function normalizeTimestamp(value, fallback = 0) {
	const normalized = Number(value);
	return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeCount(count, historyLength = 0) {
	const normalized = Number(count);
	return Number.isFinite(normalized) && normalized > 0
		? Math.max(Math.floor(normalized), historyLength)
		: historyLength;
}

function buildMainLink(site, serverId) {
	const base = SITE_BASE_URLS[site] || '';
	return base ? `${base}${serverId}` : '';
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

function historyBounds(history) {
	const timestamps = history
		.map((entry) => new Date(entry).getTime())
		.filter((timestamp) => Number.isFinite(timestamp));

	return {
		first: timestamps.length ? Math.min(...timestamps) : 0,
		last: timestamps.length ? Math.max(...timestamps) : 0,
	};
}

export function normalizeStoredRecord(site, serverId, rawRecord) {
	if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
		return null;
	}

	const nextRecord = { ...rawRecord };
	if (site === 'server-discord.com' && !nextRecord.mainLink && nextRecord.link) {
		nextRecord.mainLink = nextRecord.link;
		delete nextRecord.link;
	}

	if (site === 'myserver.gg' && !nextRecord.mainLink && nextRecord.joinLink) {
		nextRecord.mainLink = buildMainLink(site, serverId);
	}

	const history = normalizeHistory(nextRecord.history ?? nextRecord.visits);
	const bounds = historyBounds(history);
	const lastVisited = normalizeTimestamp(nextRecord.lastVisited ?? nextRecord.lastVisitedAt, bounds.last);
	const firstVisitedAt = normalizeTimestamp(nextRecord.firstVisitedAt, bounds.first || lastVisited);

	delete nextRecord.visits;
	delete nextRecord.visitCount;

	Object.assign(nextRecord, {
		count: normalizeCount(rawRecord.count ?? rawRecord.visitCount, history.length),
		name: typeof nextRecord.name === 'string' ? nextRecord.name.trim() : '',
		mainLink: nextRecord.mainLink || buildMainLink(site, serverId),
		joinLink: nextRecord.joinLink || buildJoinLink(site, serverId, nextRecord.mainLink),
		history,
		lastVisited,
		firstVisitedAt,
		favorite: nextRecord.favorite === true,
		archived: nextRecord.archived === true,
		note: typeof nextRecord.note === 'string' ? nextRecord.note.trim().slice(0, 500) : '',
		tags: Array.isArray(nextRecord.tags)
			? nextRecord.tags.filter((tag) => typeof tag === 'string').slice(0, 20)
			: [],
	});

	return {
		normalized: nextRecord,
		changed: JSON.stringify(rawRecord) !== JSON.stringify(nextRecord),
	};
}

export function parseStorageRecords(storageMap, unknownServerLabel = 'Unknown server') {
	const servers = [];
	const storageUpdates = {};

	for (const [storageKey, rawRecord] of Object.entries(storageMap || {})) {
		const parsedKey = splitStorageKey(storageKey);
		if (!parsedKey) {
			continue;
		}

		const { site, id } = parsedKey;
		const result = normalizeStoredRecord(site, id, rawRecord);
		if (!result || result.normalized.count <= 0) {
			continue;
		}

		if (result.changed) {
			storageUpdates[storageKey] = result.normalized;
		}

		const name = result.normalized.name || unknownServerLabel;
		servers.push({
			key: storageKey,
			site,
			id,
			...result.normalized,
			name,
			searchName: name.toLocaleLowerCase(),
		});
	}

	servers.sort((left, right) => right.lastVisited - left.lastVisited);
	return { servers, storageUpdates };
}

export function serverToStorageRecord(server) {
	const { key, site, id, searchName, ...record } = server;
	return record;
}

export function mergeServerRecords(existingRecord, importedRecord, site, id) {
	const existing = normalizeStoredRecord(site, id, existingRecord)?.normalized;
	const imported = normalizeStoredRecord(site, id, importedRecord)?.normalized;
	if (!existing) return imported;
	if (!imported) return existing;

	const history = normalizeHistory([...(existing.history || []), ...(imported.history || [])]);
	const newest = imported.lastVisited >= existing.lastVisited ? imported : existing;
	const firstVisitedCandidates = [existing.firstVisitedAt, imported.firstVisitedAt]
		.filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
	return {
		...existing,
		...newest,
		count: Math.max(existing.count, imported.count, history.length),
		history,
		firstVisitedAt: firstVisitedCandidates.length
			? Math.min(...firstVisitedCandidates)
			: Math.max(existing.lastVisited, imported.lastVisited),
		lastVisited: Math.max(existing.lastVisited, imported.lastVisited),
		favorite: existing.favorite || imported.favorite,
		archived: imported.archived,
		note: imported.note || existing.note,
		tags: [...new Set([...(existing.tags || []), ...(imported.tags || [])])],
	};
}

export function getServerStats(servers, now = Date.now()) {
	const activeServers = servers.filter((server) => !server.archived);
	const totalVisits = servers.reduce((sum, server) => sum + server.count, 0);
	const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
	const countSince = (boundary) => servers.reduce((sum, server) => (
		sum + server.history.filter((entry) => new Date(entry).getTime() >= boundary).length
	), 0);

	return {
		totalServers: activeServers.length,
		totalVisits,
		visits7: countSince(sevenDaysAgo),
		visits30: countSince(thirtyDaysAgo),
		mostVisited: [...servers].sort((left, right) => right.count - left.count)[0] || null,
	};
}
