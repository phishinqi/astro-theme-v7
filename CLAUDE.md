# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

V7 is a static Astro 7 blog theme (React islands, Tailwind 4, Decap CMS) published as a reusable theme repository (`phishinqi/astro-theme-v7`). User-facing docs and most UI copy are in Chinese; `docs/README.en.md` is the English README.

## Commands

Toolchain is pinned: Node 24.16.0, pnpm 12.5.1 (`pnpm install --frozen-lockfile`).

```sh
pnpm dev:cms        # astro dev + loopback Decap proxy; editor at http://localhost:4321/admin/
pnpm dev            # site only
pnpm build          # prepare-admin (copies Decap bundle to public/admin/vendor) + astro build + Pagefind index
pnpm preview        # serve dist/ — search only works after build + preview
pnpm check          # astro check (types)
pnpm lint           # eslint, --max-warnings 0
pnpm format:check   # prettier (pnpm format to fix)
pnpm test           # vitest unit tests (tests/unit)
pnpm test:e2e       # playwright; starts preview + CMS proxy itself, needs a prior build
pnpm verify         # check + lint + format:check + test + build + test:e2e (what CI runs)
pnpm test:variants  # rebuilds with features disabled / English / R2; temporarily rewrites site.config.json
pnpm new:post <slug> [folder] [title]   # new draft in content/posts/
pnpm images:demo    # regenerates demo album images in public/images/albums/
```

Single tests: `pnpm exec vitest run tests/unit/photos.test.ts -t "licenses"`, `pnpm exec playwright test tests/e2e/photos.spec.ts:75`.

E2E ports: `V7_TEST_PORT` (preview, default 4321) and `DECAP_PROXY_PORT` (proxy, default 8081). `DECAP_PROXY_PORT` must also be set at **build** time, because it is baked into the admin page's `local_backend.url`. Playwright reuses servers already listening on those ports (outside CI), so a dev server or proxy from another checkout gets reused silently. The CMS e2e tests write real files through the proxy; `tests/fixtures/cms.ts` refuses to run them unless the proxy serves the current directory. Only one `astro preview` per project root can run at a time (lock file).

`pnpm format:check` covers everything, including `content/`, so an unformatted post fails CI.

## Architecture

**Content is separate from code.** Everything editorial lives in `content/` (`posts/`, `pages/`, `moments/`, `timeline/`, `roadmap/`, `albums/`). Registries live in `data/` (authors, categories with `parent`, article tag suggestions, photo tags, friends), and site settings in `site.config.json`. The Decap editor edits all three through the same files. `src/content.config.ts` defines the collections (glob loaders). Post folder location never determines a post's URL or category: URLs come from the stable frontmatter `slug`, and the category comes from frontmatter.

**Validation happens at build time and is strict.** `src/site.config.ts` parses `site.config.json` and the `data/` registries with zod. It throws on duplicate IDs, category cycles and unknown default authors. Schemas are in `src/lib/post-schema.ts` (the `contentDate` helper requires ISO dates with explicit timezones) and `src/lib/module-schema.ts` (albums and photos; blank CMS values `''`/`null` are stripped before validation). Unknown tags, authors or licenses fail the build. Draft and future-dated entries are excluded everywhere: `src/lib/content.ts`, `src/lib/posts.ts` and `moduleEntries()` in `src/lib/modules.ts`.

**Feature flags.** `features.*` in `site.config.json` removes a module's routes, nav entries, home previews, CMS collections and sitemap entries. `enabledHref()` maps nav hrefs to flags; `/photos/` belongs to `albums`. `cms.enabled: false` removes `/admin/` and the footer "写作" link. `scripts/check-variants.mjs` asserts these removals.

**i18n swaps text on the client at one URL.** The HTML is rendered in `siteConfig.locale`. `src/i18n/client.ts` `applyLocale()` then walks the DOM and swaps any text node matching a string in `src/i18n/ui.ts` dictionaries or a `{ 'zh-CN', en }` value in config and registries. Elements marked `data-no-translate`, `data-content`, `#article-body` or `[data-locale-content]` are skipped; `[data-localized]` holds JSON, and `[data-i18n]` holds a dictionary key. Articles are never translated. When you add UI strings, add the key to both `zh` and `en` in `ui.ts`, and keep user content inside `data-content` so it cannot collide with a dictionary string. Languages for the switcher come from `languages` in `ui.ts`.

**Albums pipeline.** `src/lib/photos.ts` `getAlbums()` resolves each photo in this order:

1. ID: `photoId()` in `src/lib/photo-id.ts` uses the file name, or a hash for generated R2 names. IDs must be unique across all albums because they form the `#photo-<id>` deep links.
2. Author: the photo's own, else the album's, else the default author.
3. License: the photo's own, else `media.license`, via `src/lib/licenses.ts`.
4. Placeholder colour: sharp computes it at build time for local files.

`src/components/PhotoGrid.astro` renders the masonry list and embeds the viewer data as JSON (`script[data-viewer-items]`). `src/lib/image-sources.ts` builds srcsets for local images through `astro:assets`; R2 images already carry a srcset. Client code: `src/scripts/masonry.ts` does shortest-column absolute positioning (the no-JS fallback is CSS columns) plus the `?tag=` filter, and `src/scripts/viewer.ts` is a single shared `<dialog>` viewer that `register()`s any container with `[data-viewer-item]` links. `Gallery.astro` (MDX and moments) reuses the same viewer.

**Admin / Decap.** `src/pages/admin/[...path].astro` injects two JSON blobs: the Decap config from `src/lib/cms-config.ts` (collections are generated, not a static `config.yml`) and `adminSettings()`. `public/admin/init.js` is plain browser ESM that is served as-is and never bundled. It registers these custom widgets:

- `v7-body`: forces source mode for complex Markdown/MDX.
- `v7-image`: a single image object.
- `v7-media-list`: image lists. Decap only passes list-item values to an `object` field, so upload metadata is merged at the list level.
- The `v7-r2` media library.

In GitHub mode it intercepts Decap's file input `change` event and re-encodes uploads through `public/admin/image-pipeline.js`: canvas re-encode to WebP, which strips all metadata, then the dominant colour is computed. `public/admin/exif.js` parses EXIF only to prefill blank fields (`prefill.js`). Keep these three helpers dependency-free and pure, because the unit tests import them directly.

**Server side.** `functions/api/[[path]].js` (Cloudflare Pages Functions) delegates to `src/server/content-services.mjs`. It serves `/api/auth` and `/api/callback` (GitHub OAuth with a state cookie and a repo write-permission check) and `/api/media` (R2 list/upload, same-origin only, validated WebP variants). Env: `GITHUB_REPO`, `GITHUB_CLIENT_ID`, the secret `GITHUB_CLIENT_SECRET`, and for R2 the `MEDIA` binding plus `PUBLIC_MEDIA_URL`. The rest of the site is fully static (`output: 'static'`, no adapter).

**Diagrams and scores.** Fenced blocks whose language is listed in `diagramLanguages` (`src/lib/remark-mermaid.ts`) are rendered in the browser, not at build time: the remark plugin tags them with `data-diagram-lang` (and they are added to Shiki's `excludeLangs` in `astro.config.ts`), `src/scripts/article.ts` wraps each in a `<figure class="diagram diagram-<lang>">` with a `<details>` source fallback, and an IntersectionObserver renders only what is near the viewport. `renderers` in that file maps language name to a dynamic `import()`, so a page only downloads the renderers it uses; a failure keeps the source visible. Adding a language means one entry in each of those two places. Styling lives under `.diagram*` in `global.css`; abcjs paints with `fill`/`stroke: currentColor`, so scores follow the theme with no extra rules.

**Styling.** Everything is in `src/styles/global.css`: design tokens on `:root`, dark mode under `[data-theme='dark']` and `prefers-color-scheme`, plus component classes. The theme is set before paint by an inline script in `BaseLayout.astro`, which also adds the `.js` class that JS-only motion is keyed on. Every animation must respect `prefers-reduced-motion`, and a no-JavaScript e2e test covers navigation.

**Editor language and theme.** Decap's interface runs in Simplified Chinese: `src/lib/cms-config.ts` sets `locale: 'zh_Hans'`, and `public/admin/locale.js` registers that language before `CMS.init()` with a Chinese overlay for the ~47 keys `decap-cms-locales` still ships in English (notes, list/object controls, multi-select, newer buttons). `scripts/prepare-admin.mjs` copies the Decap bundle _and_ every locale module to `public/admin/vendor/` (git-ignored). `public/admin/theme.css` restyles the editor to the blog palette. Decap generates hashed class names, so that stylesheet targets element structure and Decap's own CSS variables; it is fragile across Decap upgrades, while the `v7-*` classes used by the custom widgets are stable. Any change here needs a rebuild before `pnpm preview` shows it — the preview server serves cached `dist/` files.
