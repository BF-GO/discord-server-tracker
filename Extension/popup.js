document.addEventListener('DOMContentLoaded', async () => {
	const resetButton = document.getElementById('reset-button');
	const serverList = document.getElementById('server-list');
	const searchInput = document.getElementById('search-input');
	const prevPageButton = document.getElementById('prev-page');
	const nextPageButton = document.getElementById('next-page');
	const pageInfo = document.getElementById('page-info');
	const exportButton = document.getElementById('export-button');
	const importButton = document.getElementById('import-button');
	const importFileInput = document.getElementById('import-file-input');
	const settingsButton = document.getElementById('settings-button');
	const settingsModal = document.getElementById('settings-modal');
	const closeModal = document.getElementById('close-modal');
	const languageSelect = document.getElementById('language-select');

	const SERVERS_PER_PAGE = 10;
	let servers = [];
	let filteredServers = [];
	let currentPage = 1;
	let totalPages = 1;
	let currentTranslations = {};

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

	async function loadTranslations(language) {
		const response = await fetch(`locales/${language}.json`);
		if (!response.ok) {
			throw new Error(
				`Failed to load translations file for language: ${language}`
			);
		}
		const translations = await response.json();
		return translations;
	}

	function updateUILanguageElements() {
		document.querySelectorAll('[data-i18n-key]').forEach((el) => {
			const key = el.getAttribute('data-i18n-key');
			if (key && currentTranslations[key]) {
				if (el.tagName === 'INPUT' && el.type === 'text') {
					el.setAttribute('placeholder', currentTranslations[key]);
				} else {
					el.textContent = currentTranslations[key];
				}
			}
		});

		document.querySelectorAll('[title][data-i18n-key]').forEach((el) => {
			const key = el.getAttribute('data-i18n-key');
			if (key && currentTranslations[key]) {
				el.setAttribute('title', currentTranslations[key]);
			}
		});

		document.querySelectorAll('.server-count').forEach((el) => {
			const countText = el.textContent.replace(/\D/g, '');
			el.textContent = `${
				currentTranslations['clicks'] || 'Нажатий'
			}: ${countText}`;
		});
	}

	async function updateUILanguage(language) {
		try {
			currentTranslations = await loadTranslations(language);
			updateUILanguageElements();
			renderServerList(searchInput.value.trim().toLowerCase());
		} catch (error) {
			console.error(error);
		}
	}

	const dropdownToggle = document.querySelector('.dropdown-toggle');
	const dropdownIcon = document.querySelector('.dropdown-icon');
	const dropdownMenu = document.querySelector('.dropdown-menu');

	dropdownToggle.addEventListener('click', () => {
		const expanded =
			dropdownToggle.getAttribute('aria-expanded') === 'true' || false;
		dropdownToggle.setAttribute('aria-expanded', !expanded);
		dropdownMenu.style.display = expanded ? 'none' : 'block';

		dropdownIcon.classList.add('animate-bounce');
		dropdownIcon.addEventListener(
			'animationend',
			() => {
				dropdownIcon.classList.remove('animate-bounce');
			},
			{ once: true }
		);
	});

	document.addEventListener('click', (event) => {
		if (
			!dropdownToggle.contains(event.target) &&
			!dropdownMenu.contains(event.target)
		) {
			dropdownToggle.setAttribute('aria-expanded', 'false');
			dropdownMenu.style.display = 'none';
		}
	});

	async function loadServers() {
		try {
			const result = await sendMessage({ action: 'getAllStorage' });
			servers = [];

			for (const key in result) {
				if (result.hasOwnProperty(key)) {
					const [site, serverId] = key.split('_');
					const serverData = result[key];
					let { count, name, mainLink, joinLink, lastVisited } = serverData;

					if (count > 0) {
						if (typeof lastVisited !== 'number') {
							lastVisited = 0;
							await sendMessage({
								action: 'setStorage',
								data: { [key]: { ...serverData, lastVisited } },
							});
						}
						if (site === 'server-discord.com' && !joinLink) {
							joinLink = `${mainLink}/join`;
							await sendMessage({
								action: 'setStorage',
								data: { [key]: { ...serverData, joinLink } },
							});
						}
						servers.push({
							site: site,
							id: serverId,
							count: count,
							name:
								name ||
								currentTranslations['unknownServer'] ||
								'Неизвестный сервер',
							mainLink: mainLink || `${getSiteURL(site)}${serverId}`,
							joinLink: joinLink || `${getSiteURL(site)}${serverId}/join`,
							history: serverData.history || [],
							lastVisited: lastVisited,
						});
					}
				}
			}

			servers.sort((a, b) => b.lastVisited - a.lastVisited);
			filteredServers = [...servers];
			currentPage = 1;
			calculateTotalPages();
			renderServerList(searchInput.value.trim().toLowerCase());
		} catch (error) {
			console.error(error);
		}
	}

	function getSiteURL(site) {
		if (site === 'server-discord.com') {
			return 'https://server-discord.com/';
		} else if (site === 'myserver.gg') {
			return 'https://myserver.gg/';
		} else {
			return '';
		}
	}

	function calculateTotalPages() {
		totalPages = Math.ceil(filteredServers.length / SERVERS_PER_PAGE) || 1;
	}

	function renderServerList(filter = '') {
		if (filter !== '') {
			filteredServers = servers.filter((server) =>
				server.name.toLowerCase().includes(filter.toLowerCase())
			);
		} else {
			filteredServers = [...servers];
		}

		calculateTotalPages();

		if (currentPage > totalPages) {
			currentPage = totalPages;
		}

		const startIndex = (currentPage - 1) * SERVERS_PER_PAGE;
		const endIndex = startIndex + SERVERS_PER_PAGE;
		const serversToDisplay = filteredServers.slice(startIndex, endIndex);

		serverList.innerHTML = '';

		if (serversToDisplay.length === 0) {
			serverList.innerHTML = `<li>${
				currentTranslations['noServers'] || 'Нет отслеживаемых серверов.'
			}</li>`;
		} else {
			for (const server of serversToDisplay) {
				const listItem = document.createElement('li');
				listItem.className = 'server-item';

				const iconContainer = document.createElement('div');
				iconContainer.className = 'icon-container';

				const icon = document.createElement('img');
				icon.src = 'icons/book.png';
				icon.alt = 'Server Icon';
				icon.className = 'server-icon';
				iconContainer.appendChild(icon);

				const tooltip = document.createElement('div');
				tooltip.className = 'custom-tooltip';
				if (server.history && server.history.length > 0) {
					tooltip.classList.add('tooltip-dates');
					const sortedHistory = [...server.history].sort(
						(a, b) => new Date(b) - new Date(a)
					);

					sortedHistory.forEach((dateStr, index) => {
						const entry = document.createElement('div');
						entry.textContent = new Date(dateStr).toLocaleString();
						entry.style.whiteSpace = 'nowrap';
						if (index < sortedHistory.length - 1) {
							entry.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
							entry.style.paddingBottom = '4px';
							entry.style.marginBottom = '4px';
						}
						tooltip.appendChild(entry);
					});
				} else {
					tooltip.classList.add('tooltip-text');
					const entry = document.createElement('div');
					entry.textContent =
						currentTranslations['noHistory'] || 'No visit history';
					entry.style.whiteSpace = 'nowrap';
					tooltip.appendChild(entry);
				}
				iconContainer.appendChild(tooltip);

				const nameLink = document.createElement('a');
				nameLink.className = 'server-name';
				nameLink.href = server.mainLink;
				nameLink.textContent = server.name;
				nameLink.title = server.name;
				nameLink.target = '_blank';
				nameLink.addEventListener('click', () => {
					updateLastVisited(server.site, server.id);
				});

				const countSpan = document.createElement('span');
				countSpan.className = 'server-count';
				countSpan.textContent = `${
					currentTranslations['clicks'] || 'Нажатий'
				}: ${server.count}`;

				const linkElement = document.createElement('a');
				linkElement.className = 'server-link';
				linkElement.textContent = currentTranslations['goTo'] || 'Перейти';
				linkElement.href = server.joinLink;
				linkElement.target = '_blank';
				linkElement.addEventListener('click', () => {
					updateLastVisited(server.site, server.id);
				});

				const deleteButton = document.createElement('button');
				deleteButton.className = 'delete-button';
				deleteButton.title =
					currentTranslations['deleteServer'] || 'Удалить сервер';
				deleteButton.innerHTML = '&times;';
				deleteButton.addEventListener('click', (e) => {
					e.stopPropagation();
					deleteServer(server.site, server.id);
				});

				listItem.appendChild(iconContainer);
				listItem.appendChild(nameLink);
				listItem.appendChild(countSpan);
				listItem.appendChild(linkElement);
				listItem.appendChild(deleteButton);

				serverList.appendChild(listItem);
			}
		}

		updatePaginationControls();
	}

	function updatePaginationControls() {
		pageInfo.textContent = (
			currentTranslations['pageInfo'] || 'Страница {0} из {1}'
		)
			.replace('{0}', currentPage)
			.replace('{1}', totalPages);
		prevPageButton.disabled = currentPage === 1;
		nextPageButton.disabled = currentPage === totalPages;
	}

	async function resetCounters() {
		if (
			confirm(
				currentTranslations['confirmReset'] ||
					'Вы уверены, что хотите сбросить все счетчики?'
			)
		) {
			try {
				const success = await sendMessage({ action: 'clearStorage' });
				if (success) {
					servers = [];
					filteredServers = [];
					currentPage = 1;
					totalPages = 1;
					renderServerList();
					settingsModal.style.display = 'none';
				}
			} catch (error) {
				console.error(error);
			}
		}
	}

	async function updateLastVisited(site, serverId) {
		const currentDate = new Date().toISOString();
		const currentTime = Date.now();
		try {
			const key = `${site}_${serverId}`;
			const result = await sendMessage({ action: 'getStorage', keys: [key] });
			let serverData = result && result[key] ? result[key] : null;

			if (!serverData) {
				serverData = {
					count: 1,
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
			loadServers();
		} catch (error) {
			console.error(error);
		}
	}

	async function deleteServer(site, serverId) {
		if (
			confirm(
				currentTranslations['confirmDelete'] ||
					'Вы уверены, что хотите удалить этот сервер из списка?'
			)
		) {
			try {
				const key = `${site}_${serverId}`;
				const success = await sendMessage({
					action: 'removeStorage',
					keys: [key],
				});

				if (success) {
					servers = servers.filter(
						(server) => !(server.site === site && server.id === serverId)
					);
					filteredServers = filteredServers.filter(
						(server) => !(server.site === site && server.id === serverId)
					);
					calculateTotalPages();
					if (currentPage > totalPages) {
						currentPage = totalPages;
					}
					renderServerList(searchInput.value.trim().toLowerCase());
					chrome.runtime.sendMessage({ action: 'storageChanged' });
				}
			} catch (error) {
				console.error(error);
			}
		}
	}

	async function exportData() {
		try {
			const data = await sendMessage({ action: 'getAllStorage' });
			const dataStr = JSON.stringify(data, null, 2);
			const blob = new Blob([dataStr], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `servers_backup_${new Date()
				.toISOString()
				.slice(0, 10)}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			alert(
				currentTranslations['exportError'] ||
					'Не удалось экспортировать данные.'
			);
		}
	}

	function importData(event) {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const content = e.target.result;
				const data = JSON.parse(content);

				if (typeof data !== 'object' || data === null) {
					throw new Error('Invalid file format.');
				}

				for (const key in data) {
					if (data.hasOwnProperty(key)) {
						if (typeof data[key].lastVisited !== 'number') {
							data[key].lastVisited = 0;
						}
						if (
							key.startsWith('myserver.gg_') &&
							!data[key].mainLink &&
							data[key].joinLink
						) {
							const [site, serverId] = key.split('_');
							if (site === 'myserver.gg') {
								data[key].mainLink = `https://myserver.gg/${serverId}`;
							}
						}
						if (
							key.startsWith('server-discord.com_') &&
							!data[key].mainLink &&
							data[key].link
						) {
							data[key].mainLink = data[key].link;
							delete data[key].link;
						}
						if (key.startsWith('server-discord.com_') && !data[key].joinLink) {
							data[key].joinLink = `${data[key].mainLink}/join`;
						}
					}
				}

				await sendMessage({ action: 'setStorage', data: data });
				alert(
					currentTranslations['importSuccess'] ||
						'Данные успешно импортированы.'
				);
				loadServers();
				chrome.runtime.sendMessage({ action: 'storageChanged' });
			} catch (error) {
				alert(
					currentTranslations['importError'] ||
						'Не удалось импортировать данные.'
				);
			}
		};
		reader.readAsText(file);
	}

	exportButton.addEventListener('click', exportData);
	importButton.addEventListener('click', () => {
		importFileInput.click();
	});
	importFileInput.addEventListener('change', importData);
	searchInput.addEventListener('input', (e) => {
		const filter = e.target.value.trim().toLowerCase();
		currentPage = 1;
		renderServerList(filter);
	});
	prevPageButton.addEventListener('click', () => {
		if (currentPage > 1) {
			currentPage--;
			renderServerList(searchInput.value.trim().toLowerCase());
		}
	});
	nextPageButton.addEventListener('click', () => {
		if (currentPage < totalPages) {
			currentPage++;
			renderServerList(searchInput.value.trim().toLowerCase());
		}
	});
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === 'storageChanged') {
			loadServers();
		}
	});

	settingsButton.addEventListener('click', () => {
		settingsModal.style.display = 'flex';
	});

	function resetResetButtonStyles() {
		resetButton.style.position = '';
		resetButton.style.left = '';
		resetButton.style.top = '';
		resetButton.style.borderRadius = '';
		resetButton.style.clipPath = '';
		resetButton.style.width = '';
		resetButton.style.height = '';
		resetButton.style.opacity = '';
		resetButton.style.transform = '';
		resetButton.style.transition = '';
	}

	closeModal.addEventListener('click', () => {
		settingsModal.style.display = 'none';
		resetResetButtonStyles();
	});

	window.addEventListener('click', (event) => {
		if (event.target === settingsModal) {
			settingsModal.style.display = 'none';
			resetResetButtonStyles();
		}
	});

	languageSelect.addEventListener('change', (event) => {
		const selectedLanguage = event.target.value;
		chrome.storage.local.set({ language: selectedLanguage }, () => {
			settingsModal.style.display = 'none';
			updateUILanguage(selectedLanguage);
			resetResetButtonStyles();
		});
	});

	function getRandomShape() {
		const shapes = [
			'50%',
			'0',
			'polygon(50% 0%, 0% 100%, 100% 100%)',
			'polygon(50% 0%, 0% 75%, 25% 75%, 0% 100%, 100% 100%, 75% 75%, 100% 75%)',
			'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)',
			'polygon(50% 0%, 100% 25%, 75% 100%, 25% 100%, 0% 25%)',
			'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
		];
		return shapes[Math.floor(Math.random() * shapes.length)];
	}

	function getRandomSize() {
		return Math.floor(Math.random() * 60) + 40 + 'px';
	}

	function getRandomPosition(container) {
		const containerRect = container.getBoundingClientRect();
		const maxX = containerRect.width - 100;
		const maxY = containerRect.height - 100;
		return {
			x: Math.random() * maxX,
			y: Math.random() * maxY,
		};
	}

	function moveButtonRandomlyAndChangeForm() {
		const container = document.querySelector('.modal__content');
		if (!container) return;

		const { x, y } = getRandomPosition(container);

		resetButton.style.position = 'absolute';
		resetButton.style.left = x + 'px';
		resetButton.style.top = y + 'px';

		resetButton.style.borderRadius = '0';
		resetButton.style.clipPath = getRandomShape();
		resetButton.style.width = getRandomSize();
		resetButton.style.height = getRandomSize();
	}

	resetButton.addEventListener('mouseenter', (e) => {
		if (!e.ctrlKey) {
			resetButton.style.transition = 'transform 0.3s ease-in-out';
			resetButton.style.transform = `rotate(${Math.random() * 360}deg)`;
		}
	});

	resetButton.addEventListener('click', (e) => {
		if (e.ctrlKey) {
			resetCounters();
		} else {
			resetButton.style.opacity = '0';
			setTimeout(() => {
				const container = document.querySelector('.modal__content');
				if (!container) return;
				const { x, y } = getRandomPosition(container);
				resetButton.style.left = x + 'px';
				resetButton.style.top = y + 'px';
				resetButton.style.opacity = '1';
				moveButtonRandomlyAndChangeForm();
			}, 500);
		}
	});

	resetButton.addEventListener('mousemove', (e) => {
		if (!e.ctrlKey) {
			const rect = resetButton.getBoundingClientRect();
			const distance = Math.hypot(
				e.clientX - (rect.left + rect.width / 2),
				e.clientY - (rect.top + rect.height / 2)
			);
			if (distance < 50) {
				moveButtonRandomlyAndChangeForm();
			}
		}
	});

	let savedLanguage = await new Promise((resolve) => {
		chrome.storage.local.get('language', (data) => {
			resolve(data.language || 'en');
		});
	});
	languageSelect.value = savedLanguage;
	updateUILanguage(savedLanguage);

	loadServers();
});
