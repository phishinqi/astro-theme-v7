import { copyFile, mkdir, readdir } from 'node:fs/promises';
await mkdir('public/admin/vendor', { recursive: true });
for (const file of await readdir('node_modules/decap-cms/dist')) {
  if (/(^decap-cms\.js$|\.decap-cms\.js$|\.wasm$|\.css$|LICENSE\.txt$)/.test(file))
    await copyFile(`node_modules/decap-cms/dist/${file}`, `public/admin/vendor/${file}`);
}
