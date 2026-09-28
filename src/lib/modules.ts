import { getCollection } from 'astro:content';
import { siteConfig } from '../site.config';
import friends from '../../data/friends.json';
import { z } from 'astro/zod';
export type ModuleName = 'moments' | 'timeline' | 'roadmap' | 'albums';
export async function moduleEntries(name: ModuleName) {
  if (!siteConfig.features[name]) return [];
  const entries = await getCollection(name);
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (slugs.has(entry.data.slug)) throw new Error(`Duplicate ${name} slug: ${entry.data.slug}`);
    slugs.add(entry.data.slug);
  }
  return entries
    .filter((e) => !e.data.draft && e.data.date <= new Date())
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
export const friendEntries = z
  .array(
    z.object({
      name: z.string().min(1),
      url: z.url().refine((s) => /^https?:/.test(s)),
      description: z.string(),
      avatar: z.string().default(''),
      group: z.string().default('Friends'),
    }),
  )
  .parse(friends.friends);
