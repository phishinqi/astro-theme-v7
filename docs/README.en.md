# V7

A reading-focused Astro theme with warm paper colors, dark mode, Markdown/MDX, Git-based editing and optional content modules.

## Start

Use Node 24.16.0 and pnpm 12.5.1. Run `pnpm install --frozen-lockfile` and `pnpm dev`. In another terminal run `pnpm cms:local`, then open `http://localhost:4321/admin/`. The local editor writes directly to the working directory; do not expose its proxy to the Internet.

Use `pnpm build` and `pnpm preview` to test real Pagefind search. Run `pnpm verify` for the complete checks.

## Content and settings

All editorial content lives in `content/`: articles in `content/posts/` (nested folders, spaces and Unicode filenames are fine), independent pages such as About in `content/pages/`, and moments, timeline, roadmap and albums in their own subfolders. Application code stays under `src/`.

Folder organization is independent of frontmatter categories. Public article URLs use the stable slug. Use `pnpm new:post stable-slug folder "Title"` to create a draft. MDX component imports can use `@components/Note.astro` and `@components/Gallery.astro` regardless of folder depth.

Edit `site.config.json` or the CMS settings form. Both use the same data: title, descriptions, default locale, time zone, navigation, social links, pagination, module switches, CMS and media settings. Set a real siteURL before deployment. Author/category/friend registries live in `data/`; tags.json supplies editorial suggestions without restricting article tags.

A post has one category, multiple tags and one or more author IDs. Missing authors fall back to defaultAuthor. Parent categories aggregate descendant posts. Changing category parents or file paths does not change stable public IDs. Invalid parents, cycles, authors and duplicate slugs fail the build.

Use explicit ISO dates with time zones. Draft and future content is excluded from public routes, feeds, sitemap and search. Future content still needs a later rebuild.

## Editing and media

Decap is bundled locally and only loaded by the admin page. Plain Markdown supports source and visual editing. Complex markup, equations and Mermaid use source mode; MDX always uses source editing and is not executed inside the CMS preview.

GitHub media is the default: uploads live in public/images/uploads. R2 is optional and uses the supplied Worker for GitHub OAuth and authorized media access. Set media.provider to github or r2. Switching providers does not migrate old images. Never put secrets in site.config.json.

R2 accepts JPEG/PNG/WebP up to 20 MB and 40 megapixels, creates responsive WebP versions in the browser, and stores web-sized images rather than archival originals. Upload packages are limited to 16 MB. Public image URLs remain accessible even while their article is a draft. The authenticated media library supports selection and pagination; it intentionally has no object deletion control.

Local covers and galleries use Astro image optimization. Covers support focal positioning, captions and responsive variants. Galleries provide keyboard navigation, Escape and focus restoration. Images in ordinary Markdown retain their original URL; upload appropriately sized images.

See [CMS integration](cms.md) for OAuth, editorial workflow, Worker configuration and storage details. The production workflow saves drafts to branches and merges on publication. The draft frontmatter flag is an additional exclusion rule: clear and save it before publishing. Local proxy mode does not emulate Git branches.

## Reading experience

Readers switch Chinese/English interface text at the same URL. Articles are not translated; the About page selects its corresponding language. Search engines and no-JavaScript browsers receive the default locale. All new modules can be individually disabled, removing their routes and entry points.

Theme colors transition softly. Native cross-document View Transitions provide page fades where supported, with normal navigation elsewhere. Reduced-motion preferences disable nonessential animation. Statistics describe published content only; no visitor tracking is installed.

## License and delivery boundary

Theme code and technical documentation use MIT. Article and editorial content is excluded; see [content licensing](../CONTENT-LICENSE.md). The provided implementation is local: real GitHub OAuth and R2 credentials, remote repository creation and deployment are not performed. Mocked service tests do not substitute for a live integration check.
