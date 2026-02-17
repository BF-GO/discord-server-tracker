const AdmZip = require('adm-zip');
const fs = require('node:fs');
const path = require('node:path');

const distFolder = path.join(__dirname, 'dist');
const outputZip = path.join(__dirname, 'extension.zip');

if (!fs.existsSync(distFolder)) {
	console.error("Error: 'dist' folder not found. Run `npm run build` first.");
	process.exit(1);
}

const files = fs.readdirSync(distFolder);
if (files.length === 0) {
	console.error("Error: 'dist' folder is empty.");
	process.exit(1);
}

const zip = new AdmZip();
zip.addLocalFolder(distFolder);
zip.writeZip(outputZip);

console.log(`Archive created: ${outputZip}`);
