// Makes this theme yours.
//
// A clone starts out configured as the repository it came from: `siteURL` is the original author's
// domain, and the editor would sign in to their repository. That is invisible until it is
// published — your RSS, canonical URLs and sitemap would all point at somebody else's site — so
// this rewrites the places identity lives, and the build refuses to run unconfigured.
//
//   pnpm setup -- --url https://example.com --title "My blog" --repo me/my-blog --author me
//
// Every flag is optional; anything omitted keeps its current value or is derived.
import { glob, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const args = parseArgs({
  options: {
    url: { type: 'string' },
    title: { type: 'string' },
    repo: { type: 'string' },
    author: { type: 'string' },
    'author-name': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

if (args.values.help) {
  console.log(`Usage: pnpm setup -- [options]

  --url <origin>        Public origin, e.g. https://example.com   (required to publish)
  --title <name>        Site title
  --repo <owner/repo>   GitHub repository the editor writes to
  --author <id>         Author id, lowercase, used in content frontmatter
  --author-name <name>  Author display name
`);
  process.exit(0);
}

/** Committed with every copy; the build refuses while it exists. Keep in step with src/site.config.ts. */
const MARKER = 'this-repository-is-a-template';

const read = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const write = async (path, value) =>
  writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`);

const site = await read('site.config.json');
const authors = await read('data/authors.json');
const cms = await read('cms.config.github.json');

// ---- origin ---------------------------------------------------------------------------------
if (args.values.url) {
  const origin = args.values.url.replace(/\/$/, '');
  if (!/^https?:\/\//.test(origin)) {
    console.error(`--url must be an absolute http(s) origin, got "${args.values.url}"`);
    process.exit(1);
  }
  site.siteURL = origin;
}

// ---- title ----------------------------------------------------------------------------------
if (args.values.title) site.title = args.values.title;

// ---- repository the editor writes to ---------------------------------------------------------
if (args.values.repo) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(args.values.repo)) {
    console.error(`--repo must be owner/repo, got "${args.values.repo}"`);
    process.exit(1);
  }
  // The backend is derived by scripts/cms-config-github.mjs from these env vars, so the source of
  // truth is the generator's defaults rather than the generated file. Rewriting both keeps a
  // `pnpm setup` and a later build consistent.
  const generator = resolve('scripts/cms-config-github.mjs');
  const source = await readFile(generator, 'utf8');
  const [owner, repo] = args.values.repo.split('/');
  await writeFile(
    generator,
    source
      .replace(
        /const REPO = process\.env\.CMS_REPO \?\? '[^']*'/,
        `const REPO = process.env.CMS_REPO ?? '${owner}/${repo}'`,
      )
      .replace(
        /const AUTH_BASE = process\.env\.CMS_AUTH_BASE \?\? '[^']*'/,
        `const AUTH_BASE = process.env.CMS_AUTH_BASE ?? '${site.siteURL}'`,
      ),
  );
  cms.backend = { ...cms.backend, repo: args.values.repo };
}

// ---- author ---------------------------------------------------------------------------------
let renamedAuthor;
if (args.values.author) {
  const previous = site.defaultAuthor;
  const id = args.values.author;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    console.error(`--author must be lowercase words separated by hyphens, got "${id}"`);
    process.exit(1);
  }
  site.defaultAuthor = id;
  renamedAuthor = { from: previous, to: id };
  const entry = authors.authors.find((a) => a.id === previous);
  if (entry) entry.id = id;
  else authors.authors.push({ id, name: id, bio: site.description, avatar: '', links: [] });
}
if (args.values['author-name']) {
  const entry = authors.authors.find((a) => a.id === site.defaultAuthor);
  if (entry) entry.name = args.values['author-name'];
}

/**
 * The sample author links to this template's repository, which would otherwise appear on every
 * copy's author page — a link back to the template presented as the site owner's own. Cleared
 * rather than guessed at; the author adds their own links.
 */
for (const entry of authors.authors) {
  entry.links = (entry.links ?? []).filter((link) => !String(link.href).includes('astro-theme-v7'));
}

/**
 * Content names authors explicitly, and the schema rejects an unknown one, so renaming the author
 * without this leaves every post referencing an id that no longer exists — the build fails with
 * "Unknown author" and the message points at the data file rather than at the content.
 *
 * `guest` is a second sample author. A single-author site does not want a byline for somebody who
 * does not exist, so its references are dropped rather than repointed.
 */
if (renamedAuthor) {
  const { from, to } = renamedAuthor;
  // `fs.promises.glob` yields an async iterator, so it is collected before iterating twice.
  const posts = await Array.fromAsync(glob('content/**/*.{md,mdx}'));
  for (const path of posts) {
    const text = await readFile(resolve(path), 'utf8');
    const rewritten = text.replace(/^(authors:\s*)(.*)$/m, (_match, prefix, rest) => {
      const ids = rest
        .replace(/[[\]'"]/g, ' ')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id && id !== 'guest')
        .map((id) => (id === from ? to : id));
      return ids.length
        ? `${prefix}[${ids.map((id) => `'${id}'`).join(', ')}]`
        : `${prefix}[${to}]`;
    });
    if (rewritten !== text) await writeFile(resolve(path), rewritten);
  }
}

// The starter content is the original author's; leaving it makes a new site look like a copy.
site.socialLinks = [];

await write('site.config.json', site);
await write('data/authors.json', authors);
await write('cms.config.github.json', cms);

// Deleted last, so a run that fails part-way leaves the guard in place rather than a
// half-configured site that would publish under the wrong identity.
await rm(resolve(MARKER), { force: true });

console.log(`siteURL      ${site.siteURL}`);
console.log(`title        ${site.title}`);
console.log(`author       ${site.defaultAuthor}`);
console.log(`editor repo  ${cms.backend.repo}`);
console.log('');
console.log('Next: rewrite content/posts/ with your own writing, then run `pnpm build`.');
