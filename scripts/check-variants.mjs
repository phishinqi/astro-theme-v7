import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const original = fs.readFileSync('site.config.json', 'utf8');
let written = original;
const build = (name, config) => {
  written = JSON.stringify(config, null, 2) + '\n';
  fs.writeFileSync('site.config.json', written);
  const output = `test-results/variants/${name}`;
  const result = spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return output;
};
try {
  const disabled = JSON.parse(original);
  for (const key of Object.keys(disabled.features)) disabled.features[key] = false;
  disabled.cms.enabled = false;
  const output = build('disabled', disabled);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  for (const module of ['friends', 'moments', 'timeline', 'roadmap', 'albums']) {
    assert(!fs.existsSync(path.join(output, module, 'index.html')), `${module} route remains`);
    assert(!html.includes(`href="/${module}/"`), `${module} entry remains`);
  }
  assert(!fs.existsSync(path.join(output, 'admin/index.html')));
  assert(!html.includes('class="site-stats"'));
  const sitemap = fs.readFileSync(path.join(output, 'sitemap-0.xml'), 'utf8');
  assert(!/\/(friends|moments|timeline|roadmap|albums|admin)\//.test(sitemap));
  const english = JSON.parse(original);
  english.locale = 'en';
  english.media.provider = 'r2';
  english.media.workerURL = 'https://worker.example.com';
  english.media.publicURL = 'https://img.example.com';
  const second = build('english-r2', english);
  const home = fs.readFileSync(path.join(second, 'index.html'), 'utf8');
  assert(home.includes('<html lang="en"'));
  assert(home.includes('Selected writing'));
  const admin = fs.readFileSync(path.join(second, 'admin/index.html'), 'utf8');
  assert(admin.includes('v7-r2'));
  assert(admin.includes('https://worker.example.com'));
  console.log(
    'Verified: disabled modules/admin have no routes or entries; default English and optional R2 CMS configuration build successfully.',
  );
} finally {
  if (fs.readFileSync('site.config.json', 'utf8') !== written) {
    console.error('Configuration changed externally; original configuration was not overwritten.');
    process.exitCode = 1;
  } else fs.writeFileSync('site.config.json', original);
}
