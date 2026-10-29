import { createServer } from 'node:http';
import { mkdir, lstat, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export function parsePilotArguments(args) {
  if (args.length === 0) return { serve: false };
  if (args.length === 1 && args[0] === '--serve') return { serve: true };
  throw new Error('Usage: node scripts/pilot-review-workspace.mjs [--serve]');
}

export function createPilotPreview(html, json) {
  return createServer((request, response) => {
    const body = request.url === '/' ? html : request.url === '/workspace.json' ? json : null;
    if (request.method !== 'GET' || body === null) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': request.url === '/' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  });
}

// The executable always supplies its repository root. No path or data source
// can be supplied on the command line, and the preview never serves the disk.
export async function writePilotOutputs(repoRoot, html, json) {
  let dir = resolve(repoRoot);
  for (const part of ['tmp', 'codex', 'pilot-review']) {
    dir = join(dir, part);
    try { await mkdir(dir); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe pilot output directory');
  }
  const files = [['index.html', html], ['workspace.json', json]];
  for (const [name] of files) {
    try {
      const info = await lstat(join(dir, name));
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('Unsafe pilot output file');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const [name, body] of files) {
    const temporary = join(dir, '.' + name + '.' + randomUUID());
    try {
      await writeFile(temporary, body, { flag: 'wx' });
      await rename(temporary, join(dir, name));
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  return files.map(([name]) => join(dir, name));
}

async function main() {
  const { serve } = parsePilotArguments(process.argv.slice(2));
  const [{ buildPilotReviewWorkspace }, { renderPilotReviewPage }] = await Promise.all([
    import('./lib/pilot-review-workspace.mjs'), import('./lib/pilot-review-page.mjs'),
  ]);
  const workspace = buildPilotReviewWorkspace();
  const html = renderPilotReviewPage(workspace);
  const json = JSON.stringify(workspace, null, 2) + '\n';
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const path of await writePilotOutputs(root, html, json)) console.log(path);
  console.log(workspace.cases.length + ' synthetic review cases; NOT_PRODUCTION_EVIDENCE.');
  if (serve) {
    const server = createPilotPreview(html, json);
    server.listen(0, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + server.address().port));
    process.once('SIGINT', () => server.close());
    process.once('SIGTERM', () => server.close());
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
