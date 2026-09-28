import { test, expect } from '@playwright/test';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expectOwnProxy } from '../fixtures/cms';

test('interface language persists at the same URL and search follows it', async ({ page }) => {
  await page.goto('/about/');
  await page.locator('#language-toggle').click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator('#language-toggle')).toBeFocused();
  await expect(page.locator('[data-language-code]')).toHaveText('EN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main h1')).toHaveText('About');
  await expect(page.locator('[data-locale-content="en"]')).toBeVisible();
  await expect(page.locator('[data-locale-content="zh-CN"]')).not.toBeVisible();
  await page.locator('[data-search-trigger]').click();
  await expect(page.locator('#search-dialog-title')).toHaveText('Search');
  await page.keyboard.press('Escape');
  await page.goto('/moments/');
  await expect(page.locator('main h1')).toHaveText('Moments');
  // Keyboard: ArrowDown opens on the current language; ArrowUp moves; Enter chooses.
  await page.locator('#language-toggle').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('main h1')).toHaveText('动态');
  await expect(page.locator('[data-locale="zh-CN"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#language-options')).toBeHidden();
});
test('nested files retain URLs, descendants aggregate, and coauthors match metadata', async ({
  page,
}) => {
  await page.goto('/categories/technology/');
  await expect(page.locator('.post-item a[href="/posts/astro-content/"]').last()).toBeVisible();
  await page.goto('/categories/astro/');
  await expect(page.locator('.post-item')).toHaveCount(1);
  await page.goto('/posts/small-components/');
  await expect(page.locator('.article-heading .post-authors a')).toHaveCount(2);
  const data = JSON.parse(
    await page.locator('script[type="application/ld+json"]').first().innerText(),
  );
  expect(data.author.map((a: { name: string }) => a.name)).toEqual(['V7', 'Guest']);
  await page.locator('.article-heading a[href="/authors/guest/"]').click();
  await expect(page.locator('.post-item')).toHaveCount(1);
});
test('cover variants and gallery keyboard interactions work', async ({ page }) => {
  await page.goto('/posts/image-and-space/');
  await expect(page.locator('.article-cover img')).toHaveAttribute('srcset', /640w/);
  await page.goto('/albums/paper/');
  const trigger = page.locator('[data-viewer-item]').first();
  await trigger.click();
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('.viewer-count')).toHaveText('1 / 7');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.viewer-count')).toHaveText('2 / 7');
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer')).not.toBeVisible();
  // Focus returns to the tile of the photo that was on screen.
  await expect(page.locator('[data-viewer-item]').nth(1)).toBeFocused();
});
test('new pages have headings, mobile layouts and accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [
    '/friends/',
    '/moments/',
    '/timeline/',
    '/roadmap/',
    '/albums/',
    '/albums/paper/',
    '/photos/',
    '/authors/v7/',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || '')),
    ).toEqual([]);
  }
});
test('permalink uses canonical origin and stays stable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/astro-content/');
  await page.locator('[data-copy-link]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'https://example.com/posts/astro-content/',
  );
  await expect(page.locator('[data-copy-link]')).toContainText('链接已复制');
});
for (const extension of ['md', 'mdx']) {
  test(`local CMS saves ${extension} without losing article source`, async ({ page, request }) => {
    await expectOwnProxy(request);
    const slug = `cms-test-${randomUUID()}`;
    const path = `content/posts/${slug}.${extension}`;
    const body =
      extension === 'mdx'
        ? 'import Note from \'@components/Note.astro\';\n\n<Note title="Test">Keep this component.</Note>\n'
        : '## A heading\n\nA **small** paragraph with a [link](https://astro.build).\n';
    const content = `---\ntitle: ${slug}\ndescription: Temporary integration test\nslug: ${slug}\npubDate: '2026-01-01T00:00:00Z'\ncategory: technology\nauthors: [v7]\nlang: zh-CN\ndraft: false\n---\n\n${body}`;
    await writeFile(path, content, { flag: 'wx' });
    try {
      await page.goto('/admin/');
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      if (extension === 'mdx')
        await page.getByText('文章 · MDX 源码', { exact: true }).first().click();
      await page.getByText(slug, { exact: true }).click();
      await page
        .getByRole('textbox', { name: '摘要', exact: true })
        .fill('Updated integration test');
      if (extension === 'md') {
        await expect(page.getByText('Rich Text', { exact: true })).toBeVisible();
        await page.getByText('Markdown', { exact: true }).click();
      } else {
        await expect(page.getByText('Rich Text', { exact: true })).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByText('Publish now', { exact: true }).click();
      await expect.poll(async () => readFile(path, 'utf8')).not.toBe(content);
      const saved = await readFile(path, 'utf8');
      expect(saved).toContain(`slug: ${slug}`);
      expect(saved).toContain(body.trim());
      expect(saved).not.toMatch(/cover:\s*\n\s+focal/);
    } finally {
      await unlink(path);
    }
  });
}
