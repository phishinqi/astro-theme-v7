import { z } from 'astro/zod';
import { contentDate } from './post-schema';
export const imageSchema = z.object({
  src: z.string().regex(/^(\/(?!\/)|https:\/\/)/),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
  srcset: z.string().optional(),
});
export const moduleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  date: contentDate,
  draft: z.boolean().default(false),
  images: z.array(imageSchema).default([]),
  status: z.enum(['planned', 'active', 'done']).default('planned'),
});
