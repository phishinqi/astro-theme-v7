import raw from '../site.config.json';
import categories from '../data/categories.json';
import authors from '../data/authors.json';
import photoTags from '../data/photo-tags.json';
import { z } from 'astro/zod';
import { licensePresets } from './lib/licenses';

export type Locale = 'zh-CN' | 'en';
export type Localized = Record<Locale, string>;
const localizedSchema = z.object({ 'zh-CN': z.string(), en: z.string() });
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const safeLink = z
  .string()
  .refine(
    (value) => /^(\/(?!\/)|https?:\/\/|mailto:)/.test(value),
    'Use a local path, HTTP(S) URL or email link.',
  );
const nav = z.array(z.object({ href: safeLink, label: localizedSchema }));
const categorySchema = z.object({
  title: localizedSchema,
  description: localizedSchema,
  parent: z.preprocess((value) => (value === '' ? undefined : value), id.optional()),
});
export type Category = z.infer<typeof categorySchema>;
const authorSchema = z.object({
  name: z.string().min(1),
  bio: localizedSchema,
  avatar: z.string().default(''),
  links: z.array(z.object({ label: z.string(), href: safeLink })).default([]),
});
if (new Set(authors.authors.map((a) => a.id)).size !== authors.authors.length)
  throw new Error('Duplicate author ID.');
if (new Set(categories.categories.map((a) => a.id)).size !== categories.categories.length)
  throw new Error('Duplicate category ID.');
export const authorRegistry = z
  .record(id, authorSchema)
  .parse(Object.fromEntries(authors.authors.map(({ id, ...value }) => [id, value])));
if (new Set(photoTags.tags.map((t) => t.id)).size !== photoTags.tags.length)
  throw new Error('Duplicate photo tag ID.');
export const photoTagRegistry = z
  .record(id, localizedSchema)
  .parse(Object.fromEntries(photoTags.tags.map((t) => [t.id, t.label])));
export const categoryRegistry = z
  .record(id, categorySchema)
  .parse(Object.fromEntries(categories.categories.map(({ id, ...value }) => [id, value])));
export function validateCategoryTree(registry: Record<string, Category>) {
  for (const key of Object.keys(registry)) {
    const seen = new Set<string>();
    let current: string | undefined = key;
    while (current) {
      if (seen.has(current)) throw new Error(`Category cycle: ${key}`);
      seen.add(current);
      if (!Object.hasOwn(registry, current)) throw new Error(`Unknown parent category: ${current}`);
      current = registry[current]!.parent;
    }
  }
}
validateCategoryTree(categoryRegistry);
const parsed = z
  .object({
    title: z.string().min(1),
    siteURL: z.url(),
    locale: z.enum(['zh-CN', 'en']),
    timeZone: z.string(),
    description: localizedSchema,
    intro: z.object({ title: localizedSchema, description: localizedSchema }),
    defaultAuthor: id,
    nav,
    moreNav: nav,
    socialLinks: z.array(z.object({ label: z.string(), href: safeLink })),
    home: z.object({
      featuredLimit: z.number().int().nonnegative(),
      recentLimit: z.number().int().nonnegative(),
    }),
    postsPerPage: z.number().int().positive(),
    defaultOgImage: z.string(),
    startedAt: z.iso.date(),
    features: z.object({
      friends: z.boolean(),
      moments: z.boolean(),
      timeline: z.boolean(),
      roadmap: z.boolean(),
      albums: z.boolean(),
      stats: z.boolean(),
    }),
    links: z.object({ externalNewTab: z.boolean() }),
    media: z.object({
      provider: z.enum(['github', 'r2']),
      exifPrefill: z.boolean().default(true),
      license: z.enum(licensePresets).default('all-rights-reserved'),
      licenseText: z.string().default(''),
    }),
    // Whether the theme builds the editor page and links to it. Everything else about the editor
    // lives in cms.config.json, which the editor itself reads.
    cms: z.object({ enabled: z.boolean() }),
  })
  .parse(raw);
if (!Object.hasOwn(authorRegistry, parsed.defaultAuthor))
  throw new Error('Unknown default author.');
const origin = new URL(parsed.siteURL);
if (
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('siteURL must be an HTTP(S) origin.');
new Intl.DateTimeFormat(parsed.locale, { timeZone: parsed.timeZone });
export const siteConfig = {
  ...parsed,
  categories: categoryRegistry,
  author: authorRegistry[parsed.defaultAuthor]!,
};
export type SiteConfig = typeof siteConfig;
export function localized(value: Localized): string {
  return value[siteConfig.locale];
}
export function categoryAncestors(key: string): string[] {
  const result: string[] = [];
  let current: string | undefined = key;
  while (current) {
    result.unshift(current);
    current = categoryRegistry[current]?.parent;
  }
  return result;
}
export function isInCategory(actual: string, parent: string): boolean {
  return categoryAncestors(actual).includes(parent);
}
export function enabledHref(href: string): boolean {
  const segment = href.split('/')[1];
  // The photo wall belongs to the albums module.
  const key = segment === 'photos' ? 'albums' : segment;
  return (
    !key ||
    !(key in siteConfig.features) ||
    siteConfig.features[key as keyof typeof siteConfig.features]
  );
}
