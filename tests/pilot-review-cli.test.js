const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, readFile, writeFile, symlink, link, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('pilot CLI accepts only a fixed local build or loopback preview', async () => {
  const { parsePilotArguments } = await import('../scripts/pilot-review-workspace.mjs');
  assert.deepEqual(parsePilotArguments([]), { serve: false });
  assert.deepEqual(parsePilotArguments(['--serve']), { serve: true });
  for (const args of [['--serve', '--serve'], ['--output', '/tmp/elsewhere'], ['--host', '0.0.0.0'], ['--registry', 'external.json'], ['--case', 'forged']]) {
    assert.throws(() => parsePilotArguments(args), /Usage:/);
  }
});

test('pilot preview exposes only in-memory artifacts and refuses file access and writes', async t => {
  const { createPilotPreview } = await import('../scripts/pilot-review-workspace.mjs');
  const server = createPilotPreview('<h1>synthetic workspace</h1>', '{"synthetic":true}');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const page = await fetch(origin);
  assert.equal(await page.text(), '<h1>synthetic workspace</h1>');
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(origin + '/workspace.json')).status, 200);
  for (const path of ['/package.json', '/.env', '/api/leads', '/?path=package.json']) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await fetch(origin, { method })).status, 404);
});

test('pilot artifact writer only replaces regular fixed files and rejects unsafe parents', async t => {
  const { writePilotOutputs } = await import('../scripts/pilot-review-workspace.mjs');
  const root = await mkdtemp(join(tmpdir(), 'pilot-output-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, 'tmp/codex/pilot-review');
  await writePilotOutputs(root, 'first html', '{"version":1}');
  await writePilotOutputs(root, 'second html', '{"version":2}');
  assert.equal(await readFile(join(output, 'index.html'), 'utf8'), 'second html');
  assert.equal(await readFile(join(output, 'workspace.json'), 'utf8'), '{"version":2}');
  const protectedFile = join(root, 'protected.txt');
  await writeFile(protectedFile, 'unchanged');
  await rm(join(output, 'index.html'));
  await symlink(protectedFile, join(output, 'index.html'));
  await assert.rejects(writePilotOutputs(root, 'unsafe', '{}'), /Unsafe/);
  assert.equal(await readFile(protectedFile, 'utf8'), 'unchanged');
  await rm(join(output, 'index.html'));
  await link(protectedFile, join(output, 'index.html'));
  await assert.rejects(writePilotOutputs(root, 'unsafe', '{}'), /Unsafe/);
  const second = join(root, 'second-root');
  await mkdir(second);
  await symlink(output, join(second, 'tmp'));
  await assert.rejects(writePilotOutputs(second, 'unsafe', '{}'), /Unsafe/);
});
