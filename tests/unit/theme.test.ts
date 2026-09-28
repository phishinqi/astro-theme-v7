import { describe, it, expect } from 'vitest';
import {
  validateCategoryTree,
  categoryAncestors,
  isInCategory,
  siteConfig,
} from '../../src/site.config';
import { postSchema } from '../../src/lib/post-schema';
import { cmsConfig } from '../../src/lib/cms-config';
import { moduleSchema } from '../../src/lib/module-schema';
const label = { 'zh-CN': '示例', en: 'Example' };
describe('theme content contract', () => {
  it('rejects category cycles and dangling parents', () => {
    const item = { title: label, description: label };
    expect(() =>
      validateCategoryTree({ a: { ...item, parent: 'b' }, b: { ...item, parent: 'a' } }),
    ).toThrow(/cycle/);
    expect(() => validateCategoryTree({ a: { ...item, parent: 'missing' } })).toThrow(
      /Unknown parent/,
    );
    expect(() => validateCategoryTree({ a: { ...item, parent: 'constructor' } })).toThrow(
      /Unknown parent/,
    );
    expect(() =>
      validateCategoryTree({ a: item, b: { ...item, parent: 'a' }, c: { ...item, parent: 'b' } }),
    ).not.toThrow();
  });
  it('preserves category identity independently of file directories', () => {
    expect(categoryAncestors('technology')).toEqual(['technology']);
    expect(isInCategory('technology', 'technology')).toBe(true);
    expect(isInCategory('journal', 'technology')).toBe(false);
  });
  it('validates authors and supports remote cover images', () => {
    const base = {
      title: 'Test',
      description: 'Test',
      slug: 'test',
      pubDate: '2026-01-01',
      category: 'technology',
    };
    expect(postSchema.parse(base).authors).toEqual([siteConfig.defaultAuthor]);
    expect(() => postSchema.parse({ ...base, authors: ['missing'] })).toThrow();
    expect(() => postSchema.parse({ ...base, authors: ['constructor'] })).toThrow();
    expect(() => postSchema.parse({ ...base, authors: ['v7', 'v7'] })).toThrow();
    expect(
      postSchema.parse({
        ...base,
        cover: {
          src: 'https://img.example.com/test.webp',
          alt: 'Example',
          width: 1200,
          height: 800,
        },
      }).cover?.focal,
    ).toBe('50% 50%');
    expect(() =>
      postSchema.parse({
        ...base,
        cover: { src: 'javascript:alert(1)', alt: 'Example', width: 1200, height: 800 },
      }),
    ).toThrow();
  });
  it('configures root content, dual storage and explicit MDX source editing', () => {
    const config = cmsConfig();
    expect(config.media_folder).toBe('public/images/uploads');
    const posts = config.collections.filter((c) => c.name.startsWith('posts-')) as Array<{
      folder: string;
      fields: Array<{ name: string; widget: string }>;
    }>;
    expect(posts).toHaveLength(2);
    expect(posts.every((c) => c.folder === 'content/posts')).toBe(true);
    expect(posts[1]?.fields.find((f) => f.name === 'body')?.widget).toBe('text');
  });
  it('requires valid module dates, statuses and gallery descriptions', () => {
    expect(() =>
      moduleSchema.parse({ title: 'Example', slug: 'example', date: 'invalid' }),
    ).toThrow();
    expect(() =>
      moduleSchema.parse({
        title: 'Example',
        slug: 'example',
        date: '2026-01-01',
        status: 'unknown',
      }),
    ).toThrow();
    expect(() =>
      moduleSchema.parse({
        title: 'Example',
        slug: 'example',
        date: '2026-01-01',
        images: [{ src: '/image.png', alt: '', width: 1, height: 1 }],
      }),
    ).toThrow();
  });
});
