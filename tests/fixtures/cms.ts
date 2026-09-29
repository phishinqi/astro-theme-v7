import { test } from '@playwright/test';

/**
 * Skips tests that need a running Decap proxy when there is none.
 *
 * CMS tests write real files through that proxy. Two rules follow:
 *
 * - Never write through a proxy serving a different folder, so one left running for another
 *   checkout is not modified by accident.
 * - Skip rather than fail where no proxy is running. CI has none, and a red build there would say
 *   nothing about the editor.
 *
 * This is a hook rather than a helper because Playwright only honours `test.skip` before the test
 * body has awaited anything.
 */
export function skipWithoutProxy(): void {
  test.beforeEach(async (_fixtures, testInfo) => {
    if (testInfo.title.startsWith('local CMS ') || testInfo.title.startsWith('album uploads')) {
      if (!(await proxyResponds())) {
        testInfo.skip(true, 'No Decap proxy is running; local CMS editing is not exercised.');
      }
    }
  });
}

async function proxyResponds(): Promise<boolean> {
  const port = Number(process.env.DECAP_PROXY_PORT || 8081);
  const response = await fetch(`http://127.0.0.1:${port}/api/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'info' }),
  }).catch(() => null);
  if (!response?.ok) return false;
  const info = (await response.json()) as { repo?: string };
  // A proxy serving someone else's checkout is worse than none: refuse rather than skip, so the
  // mistake is visible.
  const expected = process.cwd().split(/[\\/]/).pop();
  if (info.repo !== expected) {
    throw new Error(`The Decap proxy on ${port} serves "${info.repo}", not "${expected}".`);
  }
  return true;
}
