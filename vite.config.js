const path = require('node:path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
	publicDir: 'public',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				popup: path.resolve(__dirname, 'popup.html'),
				background: path.resolve(__dirname, 'src/background/main.js'),
				content: path.resolve(__dirname, 'src/content/main.js'),
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'chunks/[name].js',
				assetFileNames: (assetInfo) => {
					if ((assetInfo.name || '').endsWith('.css')) {
						return 'popup.css';
					}

					return 'assets/[name][extname]';
				},
			},
		},
	},
});

