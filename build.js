const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const folderToZip = path.join(__dirname, 'Extension');
const outputZip = path.join(__dirname, 'extension.zip');

if (!fs.existsSync(folderToZip)) {
	console.error("Error: 'Extension' folder not found!");
	process.exit(1);
}

const files = fs.readdirSync(folderToZip);
if (files.length === 0) {
	console.error("Error: 'Extension' folder is empty!");
	process.exit(1);
}

console.log('Files to archive:', files);

const zip = new AdmZip();
zip.addLocalFolder(folderToZip);
zip.writeZip(outputZip);

console.log(`✅ Archive created: ${outputZip}`);
