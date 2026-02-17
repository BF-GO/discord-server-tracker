export async function loadTranslations(language) {
	const response = await fetch(`locales/${language}.json`);
	if (!response.ok) {
		throw new Error(`Failed to load translations for language: ${language}`);
	}

	return response.json();
}

export function translate(translations, key, fallback) {
	return translations[key] || fallback;
}

export function applyTranslationsToDocument(translations) {
	document.querySelectorAll('[data-i18n-key]').forEach((element) => {
		const key = element.getAttribute('data-i18n-key');
		if (!key || !translations[key]) {
			return;
		}

		if (element instanceof HTMLInputElement && element.type === 'text') {
			element.placeholder = translations[key];
			return;
		}

		element.textContent = translations[key];
	});
}
