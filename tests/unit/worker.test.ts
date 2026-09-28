import { it, expect, vi, afterEach } from 'vitest';
import { handle } from '../../worker/index.mjs';
const env = {
  SITE_ORIGIN: 'https://example.com',
  GITHUB_REPO: 'owner/repo',
  GITHUB_CLIENT_ID: 'demo',
  PUBLIC_MEDIA_URL: 'https://img.example.com',
};
afterEach(() => vi.unstubAllGlobals());
it('binds OAuth state to an HttpOnly callback cookie', async () => {
  const response = await handle(new Request('https://worker.example/auth'), env);
  expect(response.status).toBe(302);
  expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  const redirect = new URL(response.headers.get('Location')!);
  expect(redirect.origin).toBe('https://github.com');
  expect(redirect.searchParams.get('state')).toBeTruthy();
  const denied = await handle(
    new Request('https://worker.example/callback?state=wrong&code=test'),
    env,
  );
  expect(denied.status).toBe(400);
});
it('rejects unauthorized origins before contacting GitHub', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const response = await handle(
    new Request('https://worker.example/media', {
      headers: { Origin: 'https://attacker.example' },
    }),
    env,
  );
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('requires repository write access to list images', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ permissions: { push: false } })),
  );
  const response = await handle(
    new Request('https://worker.example/media', {
      headers: { Origin: env.SITE_ORIGIN, Authorization: 'Bearer test' },
    }),
    env,
  );
  expect(response.status).toBe(403);
});
it('rejects fake image bytes without writing R2 objects', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ permissions: { push: true } })));
  const put = vi.fn();
  const form = new FormData();
  form.append(
    'metadata',
    JSON.stringify({ sizes: [{ field: 'file-480', width: 480, height: 320 }] }),
  );
  form.append(
    'file-480',
    new Blob(['<script>alert(1)</script>'], { type: 'image/webp' }),
    'fake.webp',
  );
  const response = await handle(
    new Request('https://worker.example/media', {
      method: 'POST',
      headers: { Origin: env.SITE_ORIGIN, Authorization: 'Bearer test' },
      body: form,
    }),
    { ...env, MEDIA: { put } },
  );
  expect(response.status).toBe(400);
  expect(put).not.toHaveBeenCalled();
});
it('stores authorized image variants and publishes a responsive manifest', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ permissions: { push: true } })));
  const put = vi.fn().mockResolvedValue({});
  const form = new FormData();
  form.append(
    'metadata',
    JSON.stringify({ name: 'test.webp', sizes: [{ field: 'file-480', width: 480, height: 320 }] }),
  );
  form.append('file-480', new Blob(['RIFF0000WEBPdata'], { type: 'image/webp' }), 'test.webp');
  const response = await handle(
    new Request('https://worker.example/media', {
      method: 'POST',
      headers: { Origin: env.SITE_ORIGIN, Authorization: 'Bearer test' },
      body: form,
    }),
    { ...env, MEDIA: { put } },
  );
  expect(response.status).toBe(201);
  const result = await response.json();
  expect(result.src).toMatch(/^https:\/\/img.example.com\/images\/[^/]+\/480.webp$/);
  expect(result.srcset).toContain('480w');
  expect(put).toHaveBeenCalledTimes(2);
});
