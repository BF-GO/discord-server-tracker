document.addEventListener('DOMContentLoaded', () => {
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

	function sendMessage(message) {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(message, (response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
				} else if (response.error) {
					reject(new Error(response.error));
				} else {
					resolve(response.data || response.success);
				}
			});
		});
	}

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
							name: name || 'Неизвестный сервер',
							mainLink: mainLink || `${getSiteURL(site)}${serverId}`,
							joinLink: joinLink || `${getSiteURL(site)}${serverId}/join`,
							lastVisited: lastVisited,
						});
					}
				}
			}

			servers.sort((a, b) => b.lastVisited - a.lastVisited);
			filteredServers = [...servers];
			currentPage = 1;
			calculateTotalPages();
			renderServerList();
		} catch (error) {}
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
			serverList.innerHTML = '<li>Нет отслеживаемых серверов.</li>';
		} else {
			for (const server of serversToDisplay) {
				const listItem = document.createElement('li');
				listItem.className = 'server-item';

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
				countSpan.textContent = `Нажатий: ${server.count}`;

				const linkElement = document.createElement('a');
				linkElement.className = 'server-link';
				linkElement.textContent = 'Перейти';
				linkElement.href = server.joinLink;
				linkElement.target = '_blank';
				linkElement.addEventListener('click', () => {
					updateLastVisited(server.site, server.id);
				});

				const deleteButton = document.createElement('button');
				deleteButton.className = 'delete-button';
				deleteButton.title = 'Удалить сервер';
				deleteButton.innerHTML = '&times;';
				deleteButton.addEventListener('click', (e) => {
					e.stopPropagation();
					deleteServer(server.site, server.id);
				});

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
		pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
		prevPageButton.disabled = currentPage === 1;
		nextPageButton.disabled = currentPage === totalPages;
	}

	async function resetCounters() {
		if (confirm('Вы уверены, что хотите сбросить все счетчики?')) {
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
			} catch (error) {}
		}
	}

	async function updateLastVisited(site, serverId) {
		const timestamp = Date.now();
		try {
			const key = `${site}_${serverId}`;
			const result = await sendMessage({ action: 'getStorage', keys: [key] });
			if (result && result[key]) {
				const updatedData = { ...result[key], lastVisited: timestamp };
				await sendMessage({
					action: 'setStorage',
					data: { [key]: updatedData },
				});
				loadServers();
			}
		} catch (error) {}
	}

	async function deleteServer(site, serverId) {
		if (confirm('Вы уверены, что хотите удалить этот сервер из списка?')) {
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
			} catch (error) {}
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
			alert('Не удалось экспортировать данные.');
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
					throw new Error('Неверный формат файла.');
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
				alert('Данные успешно импортированы.');
				loadServers();
				chrome.runtime.sendMessage({ action: 'storageChanged' });
			} catch (error) {
				alert(
					'Не удалось импортировать данные. Убедитесь, что файл имеет правильный формат.'
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
	closeModal.addEventListener('click', () => {
		settingsModal.style.display = 'none';
	});
	window.addEventListener('click', (event) => {
		if (event.target === settingsModal) {
			settingsModal.style.display = 'none';
		}
	});
	languageSelect.addEventListener('change', (event) => {
		const selectedLanguage = event.target.value;
		chrome.storage.local.set({ language: selectedLanguage }, () => {
			console.log('Выбранный язык:', selectedLanguage);
			settingsModal.style.display = 'none';
		});
	});

	resetButton.addEventListener('click', resetCounters);

	loadServers();
});
