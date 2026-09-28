import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('all navigation, pagination and metadata work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of [
    '/',
    '/posts/',
    '/posts/page/2/',
    '/categories/',
    '/categories/technology/',
    '/tags/',
    '/tags/数学/',
    '/archives/',
    '/about/',
    '/search/',
    '/404/',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://example.com${path.replace('数学', '%E6%95%B0%E5%AD%A6')}`,
    );
  }
  await page.goto('/posts/');
  await expect(page.locator('.post-item')).toHaveCount(10);
  await page.getByRole('link', { name: /下一页/ }).click();
  await expect(page.locator('.post-item')).toHaveCount(2);
  await page.goto('/posts/start-here/');
  expect(
    JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerText())[
      '@type'
    ],
  ).toBe('BlogPosting');
  expect(errors).toEqual([]);
});

test('theme follows system, persists manual choice and updates across navigation', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/posts/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('v7-theme'))).toBe('light');
});

test('mobile menu works with keyboard and Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const toggle = page.locator('#mobile-nav summary');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-menu')).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator('.mobile-menu').getByRole('link', { name: '归档', exact: true }).click();
  await expect(page).toHaveURL(/archives/);
});

for (const width of [375, 768, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      '/posts/long-lines/',
      '/posts/math-and-diagrams/',
      '/posts/image-and-space/',
    ]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (path.includes('long-lines')) {
        await expect(page.locator(width >= 1280 ? '.desktop-toc' : '.mobile-toc')).toBeVisible();
      }
    }
  });
}

test('math, lazy diagrams, theme rerender and clipboard', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/posts/math-and-diagrams/');
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.locator('.mermaid-figure').scrollIntoViewIfNeeded();
  const svg = page.locator('.mermaid-output svg');
  await expect(svg).toBeVisible({ timeout: 20000 });
  const oldId = await svg.getAttribute('id');
  await page.locator('#theme-toggle').click();
  await expect(svg).not.toHaveAttribute('id', oldId!);
  await expect(svg).toBeVisible();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/long-lines/');
  await page.locator('.copy-button').first().click();
  await expect(page.locator('.copy-button').first()).toHaveText('已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('const');
  expect(errors).toEqual([]);
});

test('diagram load failure preserves readable source', async ({ page }) => {
  await page.route('**/_astro/mermaid*.js', (route) => route.abort());
  await page.goto('/posts/math-and-diagrams/');
  await page.locator('.mermaid-figure').scrollIntoViewIfNeeded();
  await expect(page.locator('.diagram-error')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.mermaid-source pre')).toContainText('flowchart LR');
  await expect(page.locator('.mermaid-source pre')).toBeVisible();
});

test('no JavaScript keeps content, navigation, TOC and diagram source', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto('/posts/math-and-diagrams/');
  await expect(page.locator('#article-body')).toContainText('线性模型');
  await expect(page.locator('code[data-mermaid-source]')).toContainText('flowchart LR');
  await expect(page.locator('#theme-toggle')).not.toBeVisible();
  await page.locator('#mobile-nav summary').click();
  await page.locator('.mobile-menu').getByRole('link', { name: '分类', exact: true }).click();
  await expect(page).toHaveURL(/categories/);
  await page.goto('/search/');
  await expect(page.locator('.no-script')).toContainText('JavaScript');
  await context.close();
});

test('reduced motion retains visible content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.hero h1')).toBeVisible();
  expect(await page.locator('.hero h1').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`no serious or critical accessibility issues in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const path of ['/', '/posts/long-lines/', '/posts/math-and-diagrams/', '/search/']) {
      await page.goto(path);
      if (path.includes('math')) {
        await page.locator('.mermaid-figure').scrollIntoViewIfNeeded();
        await expect(page.locator('.mermaid-output svg')).toBeVisible({ timeout: 20000 });
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((item) => ['serious', 'critical'].includes(item.impact || '')),
      ).toEqual([]);
    }
  });
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`diagram labels remain legible with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/posts/math-and-diagrams/');
    await page.locator('.mermaid-figure').scrollIntoViewIfNeeded();
    const svg = page.locator('.mermaid-output svg');
    await expect(svg).toBeVisible({ timeout: 20000 });
    const dimensions = await svg.evaluate((element) => {
      const graph = element as SVGSVGElement;
      const label = graph.querySelector('.nodeLabel')!;
      return {
        width: graph.viewBox.baseVal.width,
        height: graph.viewBox.baseVal.height,
        scale: graph.getBoundingClientRect().width / graph.viewBox.baseVal.width,
        labelHeight: label.getBoundingClientRect().height,
      };
    });
    expect(dimensions.width).toBeGreaterThan(400);
    expect(dimensions.width).toBeLessThan(1600);
    expect(dimensions.height).toBeLessThan(300);
    expect(dimensions.scale).toBeCloseTo(1, 1);
    expect(dimensions.labelHeight).toBeGreaterThan(15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const output = page.locator('.mermaid-output');
    await output.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => output.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });
}
