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
	return `${Math.floor(Math.random() * 60) + 40}px`;
}

function getRandomPosition(container) {
	const containerRect = container.getBoundingClientRect();
	const maxX = Math.max(0, containerRect.width - 100);
	const maxY = Math.max(0, containerRect.height - 100);

	return {
		x: Math.random() * maxX,
		y: Math.random() * maxY,
	};
}

function resetButtonStyles(resetButton) {
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

function moveButtonRandomly(resetButton, container) {
	const { x, y } = getRandomPosition(container);

	resetButton.style.position = 'absolute';
	resetButton.style.left = `${x}px`;
	resetButton.style.top = `${y}px`;
	resetButton.style.borderRadius = '0';
	resetButton.style.clipPath = getRandomShape();
	resetButton.style.width = getRandomSize();
	resetButton.style.height = getRandomSize();
}

export function wireInteractiveResetButton({ resetButton, modalContent, onConfirmReset }) {
	if (!resetButton || !modalContent || typeof onConfirmReset !== 'function') {
		return { resetVisualState: () => {} };
	}

	resetButton.addEventListener('mouseenter', (event) => {
		if (event.ctrlKey) {
			return;
		}

		resetButton.style.transition = 'transform 0.3s ease-in-out';
		resetButton.style.transform = `rotate(${Math.random() * 360}deg)`;
	});

	resetButton.addEventListener('mousemove', (event) => {
		if (event.ctrlKey) {
			return;
		}

		const rect = resetButton.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);

		if (distance < 50) {
			moveButtonRandomly(resetButton, modalContent);
		}
	});

	resetButton.addEventListener('click', async (event) => {
		if (event.ctrlKey) {
			await onConfirmReset();
			return;
		}

		resetButton.style.opacity = '0';
		setTimeout(() => {
			moveButtonRandomly(resetButton, modalContent);
			resetButton.style.opacity = '1';
		}, 350);
	});

	return {
		resetVisualState: () => resetButtonStyles(resetButton),
	};
}
