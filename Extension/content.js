(function () {
	let isActive = true;
	const currentSite = window.location.hostname;

	if (currentSite.includes('myserver.gg')) {
		document.body.classList.add('myserver');
	}

	let sitePrefix = '';
	if (currentSite.includes('server-discord.com')) {
		sitePrefix = 'server-discord.com';
	} else if (currentSite.includes('myserver.gg')) {
		sitePrefix = 'myserver.gg';
	} else {
		return;
	}

	window.addEventListener('beforeunload', () => {
		isActive = false;
	});

	function getServerId(block) {
		if (currentSite.includes('server-discord.com')) {
			const link = block.querySelector('a[href^="/"]');
			if (link) {
				return link.getAttribute('href').substring(1);
			}
		} else if (currentSite.includes('myserver.gg')) {
			const joinLink = block.querySelector('td.join_link a[href*="/join"]');
			if (joinLink) {
				let href = joinLink.getAttribute('href');
				href = href.replace(/^\/ru\//, '/');
				const parts = href.split('/');
				return parts.length > 1 ? parts[1] : null;
			}
		}
		return null;
	}

	function getServerName(block) {
		if (currentSite.includes('server-discord.com')) {
			const nameElement = block.querySelector(
				'.server__header__label-info__name'
			);
			return nameElement
				? nameElement.textContent.trim()
				: 'Неизвестный сервер';
		} else if (currentSite.includes('myserver.gg')) {
			const nameElement = block.querySelector('span.server_name');
			return nameElement
				? nameElement.textContent.trim()
				: 'Неизвестный сервер';
		}
		return 'Неизвестный сервер';
	}

	function getServerMainLink(block) {
		if (currentSite.includes('server-discord.com')) {
			const mainLink = block.querySelector(
				'.server__header__label-info a[href^="/"]'
			);
			return mainLink
				? `https://server-discord.com${mainLink.getAttribute('href')}`
				: null;
		} else if (currentSite.includes('myserver.gg')) {
			const mainLink = block.querySelector('.servers_info a[href^="/"]');
			if (mainLink) {
				let href = mainLink.getAttribute('href');
				href = href.replace(/^\/ru\//, '/');
				return `https://myserver.gg${href}`;
			}
			return null;
		}
		return null;
	}

	function getJoinLink(block) {
		if (currentSite.includes('server-discord.com')) {
			const joinLink = block.querySelector(
				'.server__header__label-join__button a[href^="/"]'
			);
			return joinLink
				? `https://server-discord.com${joinLink.getAttribute('href')}`
				: null;
		} else if (currentSite.includes('myserver.gg')) {
			const joinLink = block.querySelector(
				'td.join_link a.btn.btn-primary.btn-xs'
			);
			if (joinLink) {
				let href = joinLink.getAttribute('href');
				href = href.replace(/^\/ru\//, '/');
				return `https://myserver.gg${href}`;
			}
			return null;
		}
		return null;
	}

	function updateButton(button, count) {
		if (count > 0) {
			button.classList.add('tracked-join-button');
			let countSpan = button.querySelector('.click-count');
			if (!countSpan) {
				countSpan = document.createElement('span');
				countSpan.className = 'click-count';
				button.appendChild(countSpan);
			}
			countSpan.textContent = ` (${count})`;
		} else {
			button.classList.remove('tracked-join-button');
			const countSpan = button.querySelector('.click-count');
			if (countSpan) {
				button.removeChild(countSpan);
			}
		}
	}

	function sendMessage(message) {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(message, (response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
				} else if (response && response.error) {
					reject(new Error(response.error));
				} else {
					resolve(response ? response.data || response.success : null);
				}
			});
		});
	}

	async function refreshButtons() {
		if (!isActive) return;

		let serverBlocks = [];
		if (currentSite.includes('server-discord.com')) {
			serverBlocks = document.querySelectorAll('.guildApp__guild');
		} else if (currentSite.includes('myserver.gg')) {
			serverBlocks = document.querySelectorAll('table.servers tbody tr.server');
		}

		for (const block of serverBlocks) {
			let joinButton;
			if (currentSite.includes('server-discord.com')) {
				joinButton = block.querySelector('.server__header__label-join__button');
			} else if (currentSite.includes('myserver.gg')) {
				joinButton = block.querySelector(
					'td.join_link a.btn.btn-primary.btn-xs'
				);
			}

			if (joinButton) {
				const serverId = getServerId(block);
				if (!serverId) continue;

				try {
					const key = `${sitePrefix}_${serverId}`;
					const result = await sendMessage({
						action: 'getStorage',
						keys: [key],
					});
					let serverData = result ? result[key] : null;

					if (serverData && typeof serverData.lastVisited !== 'number') {
						serverData.lastVisited = 0;
						await sendMessage({
							action: 'setStorage',
							data: { [key]: serverData },
						});
					}

					if (serverData) {
						updateButton(joinButton, serverData.count);
					} else {
						updateButton(joinButton, 0);
					}
				} catch (error) {}
			}
		}
	}

	function setupEventDelegation() {
		document.body.addEventListener('click', async function (event) {
			if (!isActive) return;

			let joinButton;
			if (currentSite.includes('server-discord.com')) {
				joinButton = event.target.closest(
					'.server__header__label-join__button'
				);
			} else if (currentSite.includes('myserver.gg')) {
				joinButton = event.target.closest(
					'td.join_link a.btn.btn-primary.btn-xs'
				);
			}

			if (joinButton) {
				let serverBlock;
				if (currentSite.includes('server-discord.com')) {
					serverBlock = joinButton.closest('.guildApp__guild');
				} else if (currentSite.includes('myserver.gg')) {
					serverBlock = joinButton.closest('tr.server');
				}

				if (!serverBlock) return;

				const serverId = getServerId(serverBlock);
				if (!serverId) return;

				const serverName = getServerName(serverBlock);
				const serverMainLink = getServerMainLink(serverBlock);
				const serverJoinLink = getJoinLink(serverBlock);

				await handleJoinButtonClick(
					joinButton,
					serverBlock,
					serverId,
					serverName,
					serverMainLink,
					serverJoinLink
				);
			}
		});
	}

	async function handleJoinButtonClick(
		joinButton,
		serverBlock,
		serverId,
		serverName,
		serverMainLink,
		serverJoinLink
	) {
		try {
			const key = `${sitePrefix}_${serverId}`;
			const result = await sendMessage({
				action: 'getStorage',
				keys: [key],
			});
			let serverData = result ? result[key] : null;
			const currentDate = new Date().toISOString();
			const currentTime = Date.now();

			if (!serverData) {
				serverData = {
					count: 1,
					name: serverName,
					mainLink: serverMainLink,
					joinLink: serverJoinLink,
					history: [currentDate],
					lastVisited: currentTime,
				};
			} else {
				serverData.count = (serverData.count || 0) + 1;
				if (!serverData.history) {
					serverData.history = [];
				}
				serverData.history.unshift(currentDate);
				if (serverData.history.length > 5) {
					serverData.history.length = 5;
				}
				serverData.lastVisited = currentTime;
			}

			await sendMessage({
				action: 'setStorage',
				data: { [key]: serverData },
			});
			updateButton(joinButton, serverData.count);

			chrome.runtime.sendMessage({ action: 'storageChanged' });
		} catch (error) {}
	}

	function observeDOM() {
		if (!isActive) return;

		const observer = new MutationObserver((mutations) => {
			let needsRefresh = false;
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === 1) {
							let matches;
							if (currentSite.includes('server-discord.com')) {
								matches =
									node.matches('.guildApp__guild') ||
									node.querySelectorAll('.guildApp__guild').length > 0;
							} else if (currentSite.includes('myserver.gg')) {
								matches =
									node.matches('table.servers') ||
									node.querySelectorAll('table.servers').length > 0;
							}
							if (matches) {
								needsRefresh = true;
							}
						}
					});
				}
			});

			if (needsRefresh && isActive) {
				refreshButtons();
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
	}

	function periodicRefresh() {
		if (!isActive) return;
		setInterval(() => {
			if (isActive) refreshButtons();
		}, 5000);
	}

	async function run() {
		await refreshButtons();
		setupEventDelegation();
		observeDOM();
		periodicRefresh();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run);
	} else {
		run();
	}

	window.addEventListener('unload', () => {
		isActive = false;
	});

	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === 'storageChanged') {
			refreshButtons();
		}
	});
})();
