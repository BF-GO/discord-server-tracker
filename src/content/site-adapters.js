const UNKNOWN_SERVER = 'Unknown server';

function trimSlashes(value) {
	return value.replace(/^\/+|\/+$/g, '');
}

function toAbsoluteUrl(baseUrl, href) {
	if (!href) {
		return null;
	}

	try {
		return new URL(href, baseUrl).toString();
	} catch {
		return null;
	}
}

function parsePathSegmentFromHref(href, index) {
	if (!href) {
		return null;
	}

	try {
		const url = new URL(href, 'https://placeholder.local');
		const segments = url.pathname.split('/').filter(Boolean);
		return segments[index] ?? null;
	} catch {
		return null;
	}
}

function parseLastPathSegment(href) {
	if (!href) {
		return null;
	}

	try {
		const url = new URL(href, 'https://placeholder.local');
		const segments = url.pathname.split('/').filter(Boolean);
		return segments.length > 0 ? segments[segments.length - 1] : null;
	} catch {
		return null;
	}
}

function normalizeMyServerPath(pathname) {
	return pathname.replace(/^\/ru\//, '/');
}

function nodeMatchesBlock(node, blockSelector) {
	if (!(node instanceof Element)) {
		return false;
	}

	return node.matches(blockSelector) || node.querySelector(blockSelector) !== null;
}

const SERVER_DISCORD = {
	key: 'server-discord.com',
	matches: (hostname) => hostname.includes('server-discord.com'),
	blockSelector: '.guildApp__guild',
	joinButtonSelector: '.server__header__label-join__button',
	getServerBlocks: () => document.querySelectorAll('.guildApp__guild'),
	getJoinButton: (serverBlock) =>
		serverBlock.querySelector('.server__header__label-join__button'),
	getJoinButtonFromEvent: (target) =>
		target.closest('.server__header__label-join__button'),
	getServerBlockFromJoinButton: (joinButton) => joinButton.closest('.guildApp__guild'),
	isRelevantNode: (node) => nodeMatchesBlock(node, '.guildApp__guild'),
	getServerId: (serverBlock) => {
		const link = serverBlock.querySelector('a[href^="/"]');
		if (!link) {
			return null;
		}

		const href = link.getAttribute('href');
		if (!href) {
			return null;
		}

		return trimSlashes(href);
	},
	getServerName: (serverBlock) => {
		const nameElement = serverBlock.querySelector('.server__header__label-info__name');
		return nameElement ? nameElement.textContent.trim() : UNKNOWN_SERVER;
	},
	getMainLink: (serverBlock) => {
		const link = serverBlock.querySelector('.server__header__label-info a[href^="/"]');
		return toAbsoluteUrl('https://server-discord.com', link?.getAttribute('href'));
	},
	getJoinLink: (serverBlock) => {
		const link = serverBlock.querySelector('.server__header__label-join__button a[href^="/"]');
		return toAbsoluteUrl('https://server-discord.com', link?.getAttribute('href'));
	},
};

const MYSERVER = {
	key: 'myserver.gg',
	matches: (hostname) => hostname.includes('myserver.gg'),
	blockSelector: 'table.servers tbody tr.server',
	joinButtonSelector: 'td.join_link a.btn.btn-primary.btn-xs',
	onInit: () => {
		document.body.classList.add('myserver');
	},
	getServerBlocks: () => document.querySelectorAll('table.servers tbody tr.server'),
	getJoinButton: (serverBlock) =>
		serverBlock.querySelector('td.join_link a.btn.btn-primary.btn-xs'),
	getJoinButtonFromEvent: (target) =>
		target.closest('td.join_link a.btn.btn-primary.btn-xs'),
	getServerBlockFromJoinButton: (joinButton) => joinButton.closest('tr.server'),
	isRelevantNode: (node) => nodeMatchesBlock(node, 'table.servers tbody tr.server'),
	getServerId: (serverBlock) => {
		const joinLink = serverBlock.querySelector('td.join_link a[href*="/join"]');
		const href = joinLink?.getAttribute('href');
		if (!href) {
			return null;
		}

		const normalizedPath = normalizeMyServerPath(href);
		return parsePathSegmentFromHref(normalizedPath, 0);
	},
	getServerName: (serverBlock) => {
		const nameElement = serverBlock.querySelector('span.server_name');
		return nameElement ? nameElement.textContent.trim() : UNKNOWN_SERVER;
	},
	getMainLink: (serverBlock) => {
		const link = serverBlock.querySelector('.servers_info a[href^="/"]');
		const href = link?.getAttribute('href');
		return toAbsoluteUrl('https://myserver.gg', href ? normalizeMyServerPath(href) : null);
	},
	getJoinLink: (serverBlock) => {
		const link = serverBlock.querySelector('td.join_link a.btn.btn-primary.btn-xs');
		const href = link?.getAttribute('href');
		return toAbsoluteUrl('https://myserver.gg', href ? normalizeMyServerPath(href) : null);
	},
};

const DISCORDSERVER_INFO = {
	key: 'discordserver.info',
	matches: (hostname) => hostname.includes('discordserver.info'),
	blockSelector: 'section.server',
	joinButtonSelector: '.buttons a[href*="/invite"]',
	getServerBlocks: () => document.querySelectorAll('section.server'),
	getJoinButton: (serverBlock) => serverBlock.querySelector('.buttons a[href*="/invite"]'),
	getJoinButtonFromEvent: (target) => target.closest('.buttons a[href*="/invite"]'),
	getServerBlockFromJoinButton: (joinButton) => joinButton.closest('section.server'),
	isRelevantNode: (node) => nodeMatchesBlock(node, 'section.server'),
	getServerId: (serverBlock) => {
		const link = serverBlock.querySelector('h3 a[href*="discordserver.info/"]');
		return parseLastPathSegment(link?.getAttribute('href'));
	},
	getServerName: (serverBlock) => {
		const nameElement = serverBlock.querySelector('h3 a[href*="discordserver.info/"]');
		return nameElement ? nameElement.textContent.trim() : UNKNOWN_SERVER;
	},
	getMainLink: (serverBlock) => {
		const link = serverBlock.querySelector('h3 a[href*="discordserver.info/"]');
		return toAbsoluteUrl('https://discordserver.info', link?.getAttribute('href'));
	},
	getJoinLink: (serverBlock) => {
		const link = serverBlock.querySelector('.buttons a[href*="/invite"]');
		return toAbsoluteUrl('https://discordserver.info', link?.getAttribute('href'));
	},
};

const DISBOARD = {
	key: 'disboard.org',
	matches: (hostname) => hostname.includes('disboard.org'),
	blockSelector: '.listing-card',
	joinButtonSelector: '.server-join a[href*="/join/"]',
	getServerBlocks: () => document.querySelectorAll('.listing-card'),
	getJoinButton: (serverBlock) =>
		serverBlock.querySelector('.server-join a[href*="/join/"]'),
	getJoinButtonFromEvent: (target) =>
		target.closest('.server-join a[href*="/join/"]'),
	getServerBlockFromJoinButton: (joinButton) => joinButton.closest('.listing-card'),
	isRelevantNode: (node) => nodeMatchesBlock(node, '.listing-card'),
	getServerId: (serverBlock) => {
		const joinLink = serverBlock.querySelector('.server-join a[href*="/join/"]');
		return parseLastPathSegment(joinLink?.getAttribute('href'));
	},
	getServerName: (serverBlock) => {
		const nameElement = serverBlock.querySelector('.server-name a');
		return nameElement ? nameElement.textContent.trim() : UNKNOWN_SERVER;
	},
	getMainLink: (serverBlock) => {
		const link = serverBlock.querySelector('.server-name a[href*="/server/"]');
		return toAbsoluteUrl('https://disboard.org', link?.getAttribute('href'));
	},
	getJoinLink: (serverBlock) => {
		const link = serverBlock.querySelector('.server-join a[href*="/join/"]');
		return toAbsoluteUrl('https://disboard.org', link?.getAttribute('href'));
	},
};

const ADAPTERS = [SERVER_DISCORD, MYSERVER, DISCORDSERVER_INFO, DISBOARD];

export function resolveSiteAdapter(hostname) {
	return ADAPTERS.find((adapter) => adapter.matches(hostname)) ?? null;
}
