// Generates cms.config.github.json from cms.config.json.
//
// The two files differ in exactly one key: `backend`. Keeping two hand-maintained copies of a
// 440-line config guarantees they drift, so the local file stays the single source and this script
// derives the hosted one. `pnpm build` runs it, and so does `pnpm cms:config`.
//
// The GitHub backend is what the deployed editor uses: the theme is static, so the only way to
// write to the repository from a phone or another machine is through GitHub's API.
import { readFile, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';

const SOURCE = 'cms.config.json';
const TARGET = 'cms.config.github.json';
/** Filled in by the deploy environment; the editor only needs it to find the OAuth relay. */
const AUTH_BASE = process.env.CMS_AUTH_BASE ?? 'https://v7.soyonagasaki.com';
/**
 * The relay's endpoint path. The theme serves its functions under `functions/api/`, so the relay
 * lives at `/api/auth`, not the `/auth` the editor asks for by default. Getting this wrong is a
 * 404 in the sign-in popup, so it is set explicitly rather than left to the default.
 */
const AUTH_ENDPOINT = process.env.CMS_AUTH_ENDPOINT ?? 'api/auth';
const REPO = process.env.CMS_REPO ?? 'phishinqi/astro-theme-v7';

const source = JSON.parse(await readFile(SOURCE, 'utf8'));

const hosted = {
  ...source,
  backend: {
    name: 'github',
    repo: REPO,
    branch: process.env.CMS_BRANCH ?? 'main',
    authBase: AUTH_BASE,
    authEndpoint: AUTH_ENDPOINT,
  },
};

// Validation happens in the editor, but a typo here would only surface after a deploy.
if (hosted.backend.repo !== REPO) throw new Error('repo was not applied');
if (!/^https?:\/\//.test(hosted.backend.authBase)) {
  throw new Error(`authBase must be an absolute URL, got "${hosted.backend.authBase}"`);
}

// Formatted with the project's prettier config, because `pnpm format:check` covers this file and a
// generator that emits something the formatter would rewrite fails the build it feeds. The config
// is resolved explicitly: `format()` alone does not pick up `prettier.config.mjs` from the cwd.
const options = (await resolveConfig(TARGET)) ?? {};
const text = await format(JSON.stringify(hosted), { ...options, filepath: TARGET });
await writeFile(TARGET, text);
console.log(`${TARGET} written (github backend → ${REPO}, relay ${AUTH_BASE}/${AUTH_ENDPOINT})`);
