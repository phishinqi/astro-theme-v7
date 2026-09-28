// One command for local writing: the Astro dev server and the loopback-only CMS proxy together.
import { spawn } from 'node:child_process';

const run = (script) =>
  spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
const children = [run('dev'), run('cms:local')];
console.log('\n写作后台 / Editor: http://localhost:4321/admin/  (Ctrl+C 结束 / to stop)\n');
const stop = () => {
  for (const child of children) if (!child.killed) child.kill();
};
for (const child of children)
  child.on('exit', (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
