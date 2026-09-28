import { expect, type APIRequestContext } from '@playwright/test';
import { basename } from 'node:path';

/**
 * CMS tests write real files through the local proxy. Refuse to run unless that proxy serves
 * this checkout, so a proxy left running for another folder is never written to by mistake.
 */
export async function expectOwnProxy(request: APIRequestContext) {
  const port = Number(process.env.DECAP_PROXY_PORT || 8081);
  const response = await request.post(`http://127.0.0.1:${port}/api/v1`, {
    data: { action: 'info' },
  });
  expect((await response.json()).repo, `proxy on ${port} serves another folder`).toBe(
    basename(process.cwd()),
  );
}
