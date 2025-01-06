// popup.js

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

			for (const serverId in result) {
				if (result.hasOwnProperty(serverId)) {
					const serverData = result[serverId];
					let { count, name, link, lastVisited } = serverData;

					if (count > 0) {
						if (typeof lastVisited !== 'number') {
							lastVisited = 0;
							await sendMessage({
								action: 'setStorage',
								data: { [serverId]: { ...serverData, lastVisited } },
							});
							console.log(`Initialized lastVisited for server ID ${serverId}.`);
						}

						servers.push({
							id: serverId,
							count: count,
							name: name || 'Неизвестный сервер',
							link: link || `https://server-discord.com/${serverId}`,
							lastVisited: lastVisited,
						});
					}
				}
			}

			servers.sort((a, b) => b.lastVisited - a.lastVisited);
			console.log('Отсортированные серверы:', servers);

			filteredServers = servers;
			currentPage = 1;
			calculateTotalPages();
			renderServerList();
		} catch (error) {
			console.error('Ошибка при загрузке серверов:', error);
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
			filteredServers = servers;
		}
		filteredServers.sort((a, b) => b.lastVisited - a.lastVisited);
		console.log('Отсортированные отфильтрованные серверы:', filteredServers);

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

				const nameSpan = document.createElement('span');
				nameSpan.className = 'server-name';
				nameSpan.title = server.name;
				nameSpan.textContent = server.name;

				const countSpan = document.createElement('span');
				countSpan.className = 'server-count';
				countSpan.textContent = `Нажатий: ${server.count}`;

				const linkElement = document.createElement('a');
				linkElement.className = 'server-link';
				linkElement.textContent = 'Перейти';
				linkElement.href = server.link;
				linkElement.target = '_blank';
				linkElement.addEventListener('click', () => {
					updateLastVisited(server.id);
				});

				const deleteButton = document.createElement('button');
				deleteButton.className = 'delete-button';
				deleteButton.title = 'Удалить сервер';
				deleteButton.innerHTML = '&times;';
				deleteButton.addEventListener('click', (e) => {
					e.stopPropagation();
					deleteServer(server.id);
				});

				listItem.appendChild(nameSpan);
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
				}
			} catch (error) {
				console.error('Ошибка при очистке хранилища:', error);
			}
		}
	}

	async function updateLastVisited(serverId) {
		const timestamp = Date.now();

		try {
			const result = await sendMessage({
				action: 'getStorage',
				keys: [serverId],
			});
			if (result && result[serverId]) {
				const updatedData = {
					...result[serverId],
					lastVisited: timestamp,
				};
				await sendMessage({
					action: 'setStorage',
					data: { [serverId]: updatedData },
				});
				loadServers();
			}
		} catch (error) {
			console.error('Ошибка при обновлении lastVisited:', error);
		}
	}

	async function deleteServer(serverId) {
		if (confirm('Вы уверены, что хотите удалить этот сервер из списка?')) {
			try {
				const success = await sendMessage({
					action: 'removeStorage',
					keys: [serverId],
				});

				if (success) {
					servers = servers.filter((server) => server.id !== serverId);
					filteredServers = filteredServers.filter(
						(server) => server.id !== serverId
					);
					calculateTotalPages();
					if (currentPage > totalPages) {
						currentPage = totalPages;
					}
					renderServerList(searchInput.value.trim().toLowerCase());

					chrome.runtime.sendMessage({ action: 'storageChanged' });

					console.log(`Сервер с ID ${serverId} был удален.`);
				}
			} catch (error) {
				console.error('Ошибка при удалении сервера:', error);
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
			a.download = `discord_servers_backup_${new Date()
				.toISOString()
				.slice(0, 10)}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			console.log('Данные успешно экспортированы.');
		} catch (error) {
			console.error('Ошибка при экспорте данных:', error);
			alert('Не удалось экспортировать данные.');
		}
	}

	function importData(event) {
		const file = event.target.files[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const content = e.target.result;
				const data = JSON.parse(content);

				// Валидация структуры данных
				if (typeof data !== 'object' || data === null) {
					throw new Error('Неверный формат файла.');
				}

				for (const serverId in data) {
					if (data.hasOwnProperty(serverId)) {
						if (typeof data[serverId].lastVisited !== 'number') {
							data[serverId].lastVisited = 0;
						}
					}
				}

				await sendMessage({
					action: 'setStorage',
					data: data,
				});

				alert('Данные успешно импортированы.');
				loadServers();

				chrome.runtime.sendMessage({ action: 'storageChanged' });
			} catch (error) {
				console.error('Ошибка при импорте данных:', error);
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

	resetButton.addEventListener('click', resetCounters);

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

	loadServers();

	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === 'storageChanged') {
			console.log('Popup received storageChanged message.');
			loadServers();
		}
	});
});
