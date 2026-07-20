# Release packaging

- Before creating a package for store publication, increment `version` in `public/manifest.json`. The uploaded version must be strictly greater than the latest published version; never reuse an already published version.
- Use a patch increment by default unless the user requests a specific release version.
- Create the publication archive with `npm run build:zip`.
- After packaging, verify that `extension.zip` contains `manifest.json` at its root and that its version matches `public/manifest.json`.
