// Copies the built editor into public/cms/ so the blog can serve it.
//
// The editor is developed in its own repository and consumed here as a build artifact, which is
// what keeps this repo free of its toolchain. Point V7_CMS at a checkout to use a local build;
// otherwise the version pinned below is fetched from the CDN.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const destination = 'public/cms';
const local = process.env['V7_CMS'] ?? '../v7-cms/packages/cms/dist';

await mkdir(destination, { recursive: true });

if (existsSync(local)) {
  const files = await readdir(local);
  const wanted = files.filter((name) => /\.(js|css|map)$/.test(name));
  if (wanted.length === 0) throw new Error(`${local} has no build output. Run its build first.`);
  for (const name of wanted) await copyFile(join(local, name), join(destination, name));
  // The page imports `/cms/v7-cms.js`, so the entry keeps a stable name.
  const entry = wanted.find((name) => name.startsWith('v7-cms') && name.endsWith('.js'));
  if (!entry) throw new Error(`${local} is missing v7-cms.js.`);
  console.log(`Copied ${wanted.length} files from ${local} into ${destination}/`);
} else {
  console.log(
    `No local editor build at ${local}. Set V7_CMS to a checkout, or fetch a release from the CDN.`,
  );
}
