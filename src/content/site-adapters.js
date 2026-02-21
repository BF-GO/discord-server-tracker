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

function queryFirst(root, selectors) {
	for (const selector of selectors) {
		const element = root.querySelector(selector);
		if (element) {
			return element;
		}
	}

	return null;
}

const MYSERVER_BLOCK_SELECTORS = [
	'table.servers tbody tr.server',
	'.search-row',
];
const MYSERVER_JOIN_SELECTORS = [
	'td.join_link a.btn.btn-primary.btn-xs',
	'.search-row__join',
];
const MYSERVER_NAME_SELECTORS = ['span.server_name', '.search-row__name'];
const MYSERVER_MAIN_LINK_SELECTORS = ['.servers_info a[href^="/"]', '.search-row__name[href^="/"]'];
const MYSERVER_VIEW_LINK_SELECTORS = ['.search-row__buttons a[href^="/"]'];

function extractMyServerIdFromJoinButton(joinButton) {
	const onclick = joinButton?.getAttribute('onclick');
	if (!onclick) {
		return null;
	}

	const match = onclick.match(/serverJoin\('([^']+)'\)/);
	return match ? match[1] : null;
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
	blockSelector: MYSERVER_BLOCK_SELECTORS.join(', '),
	joinButtonSelector: MYSERVER_JOIN_SELECTORS.join(', '),
	onInit: () => {
		document.body.classList.add('myserver');
	},
	getServerBlocks: () => document.querySelectorAll(MYSERVER_BLOCK_SELECTORS.join(', ')),
	getJoinButton: (serverBlock) => queryFirst(serverBlock, MYSERVER_JOIN_SELECTORS),
	getJoinButtonFromEvent: (target) =>
		target.closest(MYSERVER_JOIN_SELECTORS.join(', ')),
	getServerBlockFromJoinButton: (joinButton) => joinButton.closest('tr.server, .search-row'),
	isRelevantNode: (node) => nodeMatchesBlock(node, MYSERVER_BLOCK_SELECTORS.join(', ')),
	getServerId: (serverBlock) => {
		const legacyJoinLink = serverBlock.querySelector('td.join_link a[href*="/join"]');
		const legacyHref = legacyJoinLink?.getAttribute('href');
		if (legacyHref) {
			const normalizedPath = normalizeMyServerPath(legacyHref);
			return parsePathSegmentFromHref(normalizedPath, 0);
		}

		const mainLink = queryFirst(serverBlock, MYSERVER_MAIN_LINK_SELECTORS);
		const mainHref = mainLink?.getAttribute('href');
		if (mainHref) {
			const normalizedPath = normalizeMyServerPath(mainHref);
			return parseLastPathSegment(normalizedPath);
		}

		const joinButton = queryFirst(serverBlock, MYSERVER_JOIN_SELECTORS);
		return extractMyServerIdFromJoinButton(joinButton);
	},
	getServerName: (serverBlock) => {
		const nameElement = queryFirst(serverBlock, MYSERVER_NAME_SELECTORS);
		return nameElement ? nameElement.textContent.trim() : UNKNOWN_SERVER;
	},
	getMainLink: (serverBlock) => {
		const link = queryFirst(serverBlock, MYSERVER_MAIN_LINK_SELECTORS);
		const href = link?.getAttribute('href');
		return toAbsoluteUrl('https://myserver.gg', href ? normalizeMyServerPath(href) : null);
	},
	getJoinLink: (serverBlock) => {
		const legacyLink = serverBlock.querySelector('td.join_link a.btn.btn-primary.btn-xs');
		const legacyHref = legacyLink?.getAttribute('href');
		if (legacyHref) {
			return toAbsoluteUrl(
				'https://myserver.gg',
				normalizeMyServerPath(legacyHref)
			);
		}

		const viewLink = queryFirst(serverBlock, MYSERVER_VIEW_LINK_SELECTORS);
		const viewHref = viewLink?.getAttribute('href');
		if (viewHref) {
			return toAbsoluteUrl('https://myserver.gg', normalizeMyServerPath(viewHref));
		}

		const serverId = MYSERVER.getServerId(serverBlock);
		return serverId ? `https://myserver.gg/${serverId}` : null;
	},
};

const DISCORDSERVER_INFO = {
	key: 'discordserver.info',
	matches: (hostname) => hostname.includes('discordserver.info'),
	blockSelector: 'section.server',
	joinButtonSelector: 'a[href*="/invite"]',
	getServerBlocks: () => document.querySelectorAll('section.server'),
	getJoinButton: (serverBlock) => serverBlock.querySelector('a[href*="/invite"]'),
	getJoinButtonFromEvent: (target) => target.closest('a[href*="/invite"]'),
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
		const link = serverBlock.querySelector('a[href*="/invite"]');
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
