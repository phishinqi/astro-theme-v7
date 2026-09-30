import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  validateCategoryTree,
  categoryAncestors,
  isInCategory,
  siteConfig,
} from '../../src/site.config';
import { postSchema } from '../../src/lib/post-schema';
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
  it('describes every content folder the theme has', () => {
    const cms = JSON.parse(readFileSync('cms.config.json', 'utf8')) as {
      collections: Array<{ name: string; kind: string; folder?: string }>;
    };
    const folders = cms.collections
      .filter((collection) => collection.kind === 'fields' && collection.folder)
      .map((collection) => collection.folder!);
    for (const folder of folders) {
      expect(existsSync(folder), `${folder} is named in cms.config.json but does not exist`).toBe(
        true,
      );
    }
    // The album collection is the reason this editor exists; losing it would be silent otherwise.
    expect(cms.collections.some((collection) => collection.name === 'albums')).toBe(true);
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

describe('the template guard', () => {
  it('is present, because a copy that skips setup would publish under someone else', async () => {
    // The failure this prevents is invisible locally and permanent once deployed: a copy arrives
    // with the template author's siteURL, so its canonical URLs, RSS and sitemap would all name
    // that domain, and the editor would write to their repository.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve('src/site.config.ts'), 'utf8');
    expect(source).toContain('has not been set up yet');
    // The override exists so the template itself can be built from an export with no remote.
    expect(source).toContain('V7_TEMPLATE_BUILD');
    // Two signals, and the reason for each is not obvious — the remote alone blocked a copy whose
    // owner had pointed it at their own repository, and the marker alone blocked this repository.
    expect(source).toContain('MARKER');
    expect(source).toContain('TEMPLATE_REMOTE');
    expect(source).toContain('remoteIsThisRepository');
  });

  it('ships the marker that makes the guard apply to copies', async () => {
    // Committed, so every copy has one; `pnpm setup` deletes it. Without the file in the
    // repository, a copy would have nothing to trip the guard.
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    expect(existsSync(resolve('this-repository-is-a-template'))).toBe(true);
  });

  it('ships a setup script that rewrites identity and clears the guard', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const script = await readFile(resolve('scripts/setup.mjs'), 'utf8');
    // Every field a copy inherits from the template.
    for (const field of ['siteURL', 'defaultAuthor', 'socialLinks']) {
      expect(script, `setup must rewrite ${field}`).toContain(field);
    }
    // Content names authors explicitly and the schema rejects an unknown one, so a rename without
    // this leaves posts pointing at an id that no longer exists.
    expect(script).toContain('authors:');
    // Deleting the marker is what lets the build run; without it a configured site stays blocked.
    expect(script).toContain('rm(resolve(MARKER)');
    // The sample author links to this template's repository, and that link reaches every copy's
    // author page — a link back to the template presented as the site owner's own.
    expect(script).toContain('astro-theme-v7');
  });

  it('documents how to obtain the theme', async () => {
    // The README used to start at `pnpm install`, which presumes you already have the repository.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const readme = await readFile(resolve('README.md'), 'utf8');
    expect(readme).toContain('Use this template');
    expect(readme).toContain('pnpm setup');
  });
});
