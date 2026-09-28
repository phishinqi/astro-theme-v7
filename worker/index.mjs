const MAX_BYTES = 16 * 1024 * 1024;
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
async function repositoryAccess(token, env) {
  if (!token) return false;
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'v7-content-services',
    },
  });
  return response.ok && (await response.json()).permissions?.push === true;
}
async function limitedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty upload');
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error('Upload exceeds 16 MB');
    }
    chunks.push(value);
  }
  return new Blob(chunks, { type: request.headers.get('Content-Type') || '' });
}
export async function handle(request, env) {
  const url = new URL(request.url);
  const origin = new URL(env.SITE_ORIGIN).origin;
  if (url.pathname === '/auth' && request.method === 'GET') {
    const state = crypto.randomUUID();
    const github = new URL('https://github.com/login/oauth/authorize');
    github.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    github.searchParams.set('scope', 'repo');
    github.searchParams.set('state', state);
    github.searchParams.set('redirect_uri', `${url.origin}/callback`);
    return new Response(null, {
      status: 302,
      headers: {
        Location: github.href,
        'Set-Cookie': `v7-oauth-state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=600`,
        'Cache-Control': 'no-store',
      },
    });
  }
  if (url.pathname === '/callback' && request.method === 'GET') {
    const state = request.headers.get('Cookie')?.match(/(?:^|;\s*)v7-oauth-state=([^;]+)/)?.[1];
    if (!state || state !== url.searchParams.get('state') || !url.searchParams.get('code'))
      return json({ error: 'Invalid OAuth state' }, 400);
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: url.searchParams.get('code'),
        redirect_uri: `${url.origin}/callback`,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.access_token || !(await repositoryAccess(result.access_token, env)))
      return json({ error: 'GitHub repository write access is required' }, 403);
    const message = JSON.stringify(
      `authorization:github:success:${JSON.stringify({ token: result.access_token, provider: 'github' })}`,
    ).replace(/</g, '\\u003c');
    const target = JSON.stringify(origin);
    const nonce = crypto.randomUUID();
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>GitHub authorization</title><p>Returning to the editor…</p><script nonce="${nonce}">const target=${target};window.addEventListener('message',function receive(e){if(e.origin!==target||e.source!==window.opener)return;window.removeEventListener('message',receive);window.opener.postMessage(${message},target);window.close();});window.opener?.postMessage('authorizing:github',target);</script>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
          'Set-Cookie':
            'v7-oauth-state=; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=0',
        },
      },
    );
  }
  if (url.pathname !== '/media') return json({ error: 'Not found' }, 404);
  if (request.headers.get('Origin') !== origin) return json({ error: 'Origin not allowed' }, 403);
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!(await repositoryAccess(request.headers.get('Authorization')?.replace(/^Bearer /, ''), env)))
    return json({ error: 'Repository write access required' }, 403, cors);
  if (!env.MEDIA || !env.PUBLIC_MEDIA_URL)
    return json({ error: 'R2 is not configured' }, 503, cors);
  if (request.method === 'GET') {
    const page = await env.MEDIA.list({
      prefix: 'meta/',
      limit: 30,
      cursor: url.searchParams.get('cursor') || undefined,
    });
    const assets = await Promise.all(
      page.objects.map(async (object) => {
        const entry = await env.MEDIA.get(object.key);
        return entry ? entry.json() : null;
      }),
    );
    return json(
      { assets: assets.filter(Boolean), cursor: page.truncated ? page.cursor : null },
      200,
      cors,
    );
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  try {
    const form = await new Response(await limitedBody(request), {
      headers: { 'Content-Type': request.headers.get('Content-Type') },
    }).formData();
    const metadata = JSON.parse(form.get('metadata'));
    const sizes = metadata.sizes;
    if (
      !Array.isArray(sizes) ||
      !sizes.length ||
      sizes.length > 4 ||
      new Set(sizes.map((s) => s.width)).size !== sizes.length
    )
      throw new Error('Invalid image variants');
    const files = [];
    for (const size of sizes) {
      if (
        !Number.isInteger(size.width) ||
        size.width < 1 ||
        size.width > 2400 ||
        !Number.isInteger(size.height) ||
        size.height < 1 ||
        size.height > 40000 ||
        size.field !== `file-${size.width}`
      )
        throw new Error('Invalid image dimensions');
      const file = form.get(size.field);
      if (!(file instanceof Blob) || file.size > MAX_BYTES || file.type !== 'image/webp')
        throw new Error('Expected WebP image');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (
        String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' ||
        String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP'
      )
        throw new Error('Invalid WebP file');
      files.push({ ...size, bytes });
    }
    files.sort((a, b) => a.width - b.width);
    const id = crypto.randomUUID();
    const base = env.PUBLIC_MEDIA_URL.replace(/\/$/, '');
    const saved = [];
    try {
      for (const file of files) {
        const key = `images/${id}/${file.width}.webp`;
        await env.MEDIA.put(key, file.bytes, {
          httpMetadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
          },
        });
        saved.push(key);
        file.url = `${base}/${key}`;
      }
      const main = files.at(-1);
      const asset = {
        src: main.url,
        width: main.width,
        height: main.height,
        name: String(metadata.name || 'Image').slice(0, 180),
        srcset: files.map((f) => `${f.url} ${f.width}w`).join(', '),
      };
      await env.MEDIA.put(`meta/${id}.json`, JSON.stringify(asset), {
        httpMetadata: { contentType: 'application/json' },
      });
      return json(asset, 201, cors);
    } catch (error) {
      await env.MEDIA.delete(saved);
      throw error;
    }
  } catch (error) {
    return json({ error: error.message || 'Invalid upload' }, 400, cors);
  }
}
export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch {
      return json({ error: 'Content service unavailable' }, 503);
    }
  },
};
