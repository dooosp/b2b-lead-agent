import { createServer } from 'node:http';
import { mkdir, lstat, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildPortfolioDemo } from './lib/portfolio-v1.mjs';
import { renderPortfolioPage } from './lib/portfolio-v1-page.mjs';

export function createPortfolioPreview(html, json) {
  const server = createServer((request, response) => {
    const body = request.url === '/' ? html : request.url === '/demo.json' ? json : null;
    if (request.method !== 'GET' || body === null) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, { 'Content-Type': request.url === '/' ? 'text/html; charset=utf-8' : 'application/json',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  });
  return server;
}

// Fixed output files only. Refuse symlink parents and non-regular targets.
// No arbitrary file path, uploaded data, or network input is accepted.
async function writeOutputs(files) {
  let dir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const part of ['tmp', 'codex', 'portfolio-v1']) {
    dir = join(dir, part);
    try { await mkdir(dir); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe demo output directory');
  }
  for (const [name, body] of files) {
    const target = join(dir, name);
    try {
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('Unsafe demo output file');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const temporary = join(dir, '.' + name + '.' + randomUUID());
    try { await writeFile(temporary, body, { flag: 'wx' }); await rename(temporary, target); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    console.log(target);
  }
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--serve') || process.argv.slice(2).length > 1) throw new Error('Usage: node scripts/portfolio-v1.mjs [--serve]');
  const demo = buildPortfolioDemo();
  const html = renderPortfolioPage(demo);
  const json = JSON.stringify(demo, null, 2) + '\n';
  await writeOutputs([['index.html', html], ['demo.json', json]]);
  console.log('R1 FIT → R2 INSUFFICIENT_EVIDENCE → R3 NOT_FIT; synthetic/local only.');
  if (process.argv.includes('--serve')) {
    const server = createPortfolioPreview(html, json);
    server.listen(0, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + server.address().port));
    process.once('SIGINT', () => server.close());
    process.once('SIGTERM', () => server.close());
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
