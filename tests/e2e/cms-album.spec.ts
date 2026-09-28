import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tiff, withExif } from '../fixtures/exif';

const album = 'content/albums/paper.md';
const uploads = 'public/images/uploads';

test('album uploads are compressed, stripped of EXIF and prefill blank fields', async ({
  page,
}) => {
  const photo = withExif(
    new Uint8Array(
      await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#964630' } })
        .jpeg()
        .toBuffer(),
    ),
    tiff(
      [
        [0x010f, 2, 'Demo'],
        [0x0110, 2, 'Camera X1'],
        // ImageDescription stands in for any private metadata that must not be published.
        [0x010e, 2, 'PRIVATE-GPS-31.2304N'],
      ],
      [
        [0x829a, 5, [1, 250]],
        [0x829d, 5, [28, 10]],
        [0x8827, 3, 400],
        [0x9003, 2, '2026:05:04 18:22:10'],
        [0x920a, 5, [35, 1]],
      ],
    ),
  );
  const original = await readFile(album, 'utf8');
  const before = new Set(await readdir(uploads).catch(() => []));
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.goto('/admin/#/collections/albums/entries/paper');
    await expect(page.getByText('上传后从 EXIF 自动填入空白字段', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Add 图片/ }).click();
    await page
      .getByRole('button', { name: /Choose an image/i })
      .last()
      .click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'Evening Walk.JPG',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(photo),
    });
    await expect(page.getByText(/^evening-walk-[a-z0-9]{6}\.webp$/)).toBeVisible();
    await page.getByRole('button', { name: 'Choose selected' }).click();
    await expect(page.locator('input[id^="camera-field"]').last()).toHaveValue('Demo Camera X1');
    await expect(page.locator('input[id^="iso-field"]').last()).toHaveValue('400');
    await expect(page.locator('input[id^="width-field"]').last()).toHaveValue('2400');
    await page.locator('input[id^="alt-field"]').last().fill('A plain terracotta test image');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByText('Publish now', { exact: true }).click();
    await expect.poll(() => readFile(album, 'utf8')).toContain('A plain terracotta test image');
    const saved = await readFile(album, 'utf8');
    expect(saved).toMatch(/src: \/images\/uploads\/evening-walk-[a-z0-9]{6}\.webp/);
    expect(saved).toContain('shutter: 1/250s');
    expect(saved).toMatch(/date: '?2026-05-04'?/);
    expect(saved).toMatch(/color: '?"?#[0-9a-f]{6}/);
    expect(saved).not.toContain('PRIVATE-GPS');
    const added = (await readdir(uploads)).filter((f) => !before.has(f));
    expect(added).toHaveLength(1);
    const bytes = await readFile(`${uploads}/${added[0]}`);
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height, meta.exif]).toEqual([
      'webp',
      2400,
      1600,
      undefined,
    ]);
    expect(bytes.includes('PRIVATE-GPS')).toBe(false);
  } finally {
    await writeFile(album, original);
    for (const file of (await readdir(uploads).catch(() => [])).filter((f) => !before.has(f)))
      await unlink(`${uploads}/${file}`);
  }
});
