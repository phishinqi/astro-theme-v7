import { describe, it, expect } from 'vitest';
import { photoId } from '../../src/lib/photo-id';
import { resolveLicense } from '../../src/lib/licenses';
import { albumSchema, photoSchema } from '../../src/lib/module-schema';
import { cmsConfig, adminSettings } from '../../src/lib/cms-config';

const image = { src: '/images/a.jpg', alt: 'An image', width: 1200, height: 800 };

describe('photo ids', () => {
  it('uses the file name, or a stable hash for generated names', () => {
    expect(photoId('/images/albums/city/Window Grid.JPG')).toBe('window-grid');
    expect(photoId('/images/uploads/evening-walk-abc123.webp')).toBe('evening-walk-abc123');
    const r2 = 'https://img.example.com/images/4f1c2b7e-0a1b-4c2d-8e9f-0123456789ab/2400.webp';
    expect(photoId(r2)).toMatch(/^p-[0-9a-f]{8}$/);
    expect(photoId(r2)).toBe(photoId(r2));
    expect(photoId('/images/a.jpg', 'chosen')).toBe('chosen');
  });
});

describe('licenses', () => {
  const site = { preset: 'all-rights-reserved' as const, text: '' };
  it('falls back to the site default and lets a photo override it', () => {
    expect(resolveLicense(undefined, undefined, site).label['zh-CN']).toBe('保留所有权利');
    const cc = resolveLicense('cc-by-nc-4.0', undefined, site);
    expect(cc.href).toBe('https://creativecommons.org/licenses/by-nc/4.0/');
    expect(resolveLicense('custom', ' 仅限个人使用 ', site).label.en).toBe('仅限个人使用');
  });
  it('rejects a custom license without text', () => {
    expect(() => resolveLicense('custom', '', site)).toThrow();
  });
});

describe('album schema', () => {
  it('accepts a full photo and treats blank optional fields as unset', () => {
    const photo = photoSchema.parse({
      ...image,
      title: '',
      location: '示例城市',
      date: '2026-05-04',
      tags: ['night'],
      photo: { camera: 'Demo', iso: 400, lens: '' },
      artwork: {},
      license: null,
    });
    expect(photo.title).toBeUndefined();
    expect(photo.kind).toBe('photo');
    expect(photo.photo).toEqual({ camera: 'Demo', iso: 400 });
    expect(photo.license).toBeUndefined();
    expect(photo.date?.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });
  it('rejects unknown tags, authors, licences and malformed colours', () => {
    expect(() => photoSchema.parse({ ...image, tags: ['not-a-tag'] })).toThrow(/photo tag/);
    expect(() => photoSchema.parse({ ...image, author: 'nobody' })).toThrow(/author/);
    expect(() => photoSchema.parse({ ...image, license: 'gpl' })).toThrow();
    expect(() => photoSchema.parse({ ...image, color: 'red' })).toThrow();
    expect(() => photoSchema.parse({ ...image, alt: '' })).toThrow();
  });
  it('requires album basics and keeps photo order', () => {
    const album = albumSchema.parse({
      title: 'Album',
      slug: 'album',
      date: '2026-09-01',
      images: [image, { ...image, src: '/images/b.jpg' }],
    });
    expect(album.images.map((i) => i.src)).toEqual(['/images/a.jpg', '/images/b.jpg']);
    expect(() =>
      albumSchema.parse({ title: 'Album', slug: 'Not A Slug', date: '2026-09-01' }),
    ).toThrow();
  });
});

describe('editor configuration', () => {
  const collections = cmsConfig().collections as Array<{
    name: string;
    fields?: Array<Record<string, unknown>>;
    files?: Array<{ name: string; file: string }>;
  }>;
  it('offers albums with the photo list and separate photo tags', () => {
    const albums = collections.find((c) => c.name === 'albums')!;
    const images = albums.fields!.find((f) => f.name === 'images')!;
    expect(images.widget).toBe('v7-media-list');
    expect(images.v7_prefill).toBe(true);
    const names = (images.fields as Array<{ name: string }>).map((f) => f.name);
    for (const name of ['src', 'alt', 'kind', 'location', 'tags', 'license', 'photo', 'artwork'])
      expect(names).toContain(name);
    const data = collections.find((c) => c.name === 'data')!;
    expect(data.files!.find((f) => f.name === 'photoTags')?.file).toBe('data/photo-tags.json');
  });
  it('authenticates through the same-origin Pages Function', () => {
    const config = cmsConfig() as { backend: { auth_endpoint: string; base_url: string } };
    expect(config.backend.auth_endpoint).toBe('api/auth');
    expect(config.backend.base_url).toBe('');
    expect(adminSettings()).toEqual({ provider: 'github', exifPrefill: true, locale: 'zh_Hans' });
  });
  it('registers the interface language the config asks for', () => {
    // Decap reads its `locale` from the config; public/admin/locale.js supplies the phrases.
    expect((cmsConfig() as { locale: string }).locale).toBe('zh_Hans');
    expect(adminSettings().locale).toBe((cmsConfig() as { locale: string }).locale);
  });
});
