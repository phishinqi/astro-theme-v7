import { copyFile, mkdir, readdir } from 'node:fs/promises';
await mkdir('public/admin/vendor', { recursive: true });
for (const file of await readdir('node_modules/decap-cms/dist')) {
  if (/(^decap-cms\.js$|\.decap-cms\.js$|\.wasm$|\.css$|LICENSE\.txt$)/.test(file))
    await copyFile(`node_modules/decap-cms/dist/${file}`, `public/admin/vendor/${file}`);
}
// The interface language is a plain ES module here, so the admin page can import it directly.
const locales = 'node_modules/decap-cms-locales/dist/esm';
for (const locale of await readdir(locales)) {
  const source = `${locales}/${locale}/index.js`;
  try {
    await copyFile(source, `public/admin/vendor/locales-${locale}.js`);
  } catch {
    /* Directories such as __tests__ have no index.js. */
  }
}
