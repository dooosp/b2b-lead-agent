const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('single CLI options retain the first match and the literal following argument', async () => {
  const { optionValue } = await import('../scripts/lib/cli-utils.mjs');

  assert.equal(optionValue('--output', ['--output', ' first.json ', '--output', 'second.json']), ' first.json ');
  assert.equal(optionValue('--output', ['--output', '--json']), '--json');
  assert.equal(optionValue('--output', ['--output=first.json']), '');
  assert.equal(optionValue('--output', ['--output']), '');
  assert.equal(optionValue('--output', ['--output', '', '--output', 'second.json']), '');
});

test('repeated CLI options preserve ordering and whitespace while dropping empty values', async () => {
  const { optionValues, hasFlag } = await import('../scripts/lib/cli-utils.mjs');
  const argv = ['--url', ' first ', '--url', ' \t ', '--url', '', '--url', '--json', '--url', 'first', '--url'];

  assert.deepEqual(optionValues('--url', argv), [' first ', '--json', 'first']);
  assert.deepEqual(optionValues('--missing', argv), []);
  assert.equal(hasFlag('--json', argv), true);
  assert.equal(hasFlag('--json', ['--json=true']), false);
});

test('JSON input preserves parsed values and propagates missing or malformed file errors', async () => {
  const { readJsonArtifact } = await import('../scripts/lib/cli-utils.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'cli-json-input-'));
  const inputPath = join(dir, 'input.json');

  try {
    writeFileSync(inputPath, '  {"label":"한글", "items":[null,false,0]}\n');
    assert.deepEqual(readJsonArtifact(inputPath), { label: '한글', items: [null, false, 0] });
    writeFileSync(inputPath, 'null');
    assert.equal(readJsonArtifact(inputPath), null);
    writeFileSync(inputPath, '{not-json}');
    assert.throws(() => readJsonArtifact(inputPath), SyntaxError);
    assert.throws(() => readJsonArtifact(join(dir, 'missing.json')), { code: 'ENOENT' });
    assert.throws(() => readJsonArtifact(''), { code: 'ENOENT' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('text artifacts create parent directories and preserve existing trailing newlines', async () => {
  const { writeTextArtifact } = await import('../scripts/lib/cli-utils.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'cli-text-output-'));
  const outputPath = join(dir, 'nested', 'artifact.md');

  try {
    for (const [input, expected] of [['한글', '한글\n'], ['', '\n'], ['line\n\n', 'line\n\n']]) {
      writeTextArtifact(outputPath, input);
      assert.equal(readFileSync(outputPath, 'utf8'), expected);
    }
    assert.throws(() => writeTextArtifact('', 'text'), { code: 'ENOENT' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON artifacts distinguish optional output from a required path', async () => {
  const { writeJsonArtifact, writeRequiredJsonArtifact, writeJsonArtifactIfMateriallyChanged } = await import('../scripts/lib/cli-utils.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'cli-json-output-'));
  const optionalPath = join(dir, 'optional', 'artifact.json');
  const requiredPath = join(dir, 'required', 'artifact.json');
  const value = { label: '한글', items: [false, null] };

  try {
    writeJsonArtifact(optionalPath, value);
    writeRequiredJsonArtifact(requiredPath, value);
    assert.equal(readFileSync(optionalPath, 'utf8'), readFileSync(requiredPath, 'utf8'));
    assert.equal(readFileSync(requiredPath, 'utf8'), '{\n  "label": "한글",\n  "items": [\n    false,\n    null\n  ]\n}\n');
    assert.equal(writeJsonArtifact('', value), undefined);
    assert.deepEqual(writeJsonArtifactIfMateriallyChanged('', value), {
      written: false,
      reason: 'no_output_path',
      artifact: value,
    });
    assert.throws(() => writeRequiredJsonArtifact('', value), { code: 'ENOENT' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('semantic JSON writer ignores only a top-level generatedAt change', async () => {
  const { writeJsonArtifactIfMateriallyChanged } = await import('../scripts/lib/cli-utils.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'semantic-json-writer-'));
  const outputPath = join(dir, 'artifact.json');
  const original = {
    generatedAt: '2026-07-25T00:00:00.000Z',
    status: 'PASS',
    nested: {
      generatedAt: '2026-07-25T00:00:00.000Z',
    },
  };

  try {
    writeFileSync(outputPath, `${JSON.stringify(original, null, 2)}\n`);

    const timestampOnly = writeJsonArtifactIfMateriallyChanged(outputPath, {
      ...original,
      generatedAt: '2026-07-25T00:00:01.000Z',
    });

    assert.equal(timestampOnly.written, false);
    assert.equal(timestampOnly.reason, 'materially_unchanged');
    assert.deepEqual(timestampOnly.artifact, original);
    assert.deepEqual(JSON.parse(readFileSync(outputPath, 'utf8')), original);

    const nestedTimestampChange = writeJsonArtifactIfMateriallyChanged(outputPath, {
      ...original,
      generatedAt: '2026-07-25T00:00:02.000Z',
      nested: {
        generatedAt: '2026-07-25T00:00:02.000Z',
      },
    });

    assert.equal(nestedTimestampChange.written, true);
    assert.equal(
      nestedTimestampChange.reason,
      'materially_changed_or_missing'
    );
    assert.equal(
      JSON.parse(readFileSync(outputPath, 'utf8')).nested.generatedAt,
      '2026-07-25T00:00:02.000Z'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('semantic JSON writer replaces missing, malformed, and materially changed artifacts', async () => {
  const { writeJsonArtifactIfMateriallyChanged } = await import('../scripts/lib/cli-utils.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'semantic-json-writer-repair-'));
  const outputPath = join(dir, 'artifact.json');

  try {
    const missing = writeJsonArtifactIfMateriallyChanged(outputPath, {
      generatedAt: '2026-07-25T00:00:00.000Z',
      status: 'PASS',
    });
    assert.equal(missing.written, true);

    const changed = writeJsonArtifactIfMateriallyChanged(outputPath, {
      generatedAt: '2026-07-25T00:00:01.000Z',
      status: 'HOLD',
    });
    assert.equal(changed.written, true);
    assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).status, 'HOLD');

    writeFileSync(outputPath, `${JSON.stringify({ status: 'PASS' }, null, 2)}\n`);
    const missingTimestamp = writeJsonArtifactIfMateriallyChanged(outputPath, {
      generatedAt: '2026-07-25T00:00:02.000Z',
      status: 'PASS',
    });
    assert.equal(missingTimestamp.written, true);
    assert.equal(
      JSON.parse(readFileSync(outputPath, 'utf8')).generatedAt,
      '2026-07-25T00:00:02.000Z'
    );

    writeFileSync(outputPath, `${JSON.stringify({
      generatedAt: 'not-an-iso-timestamp',
      status: 'PASS',
    }, null, 2)}\n`);
    const invalidTimestamp = writeJsonArtifactIfMateriallyChanged(outputPath, {
      generatedAt: '2026-07-25T00:00:02.000Z',
      status: 'PASS',
    });
    assert.equal(invalidTimestamp.written, true);
    assert.equal(
      JSON.parse(readFileSync(outputPath, 'utf8')).generatedAt,
      '2026-07-25T00:00:02.000Z'
    );

    writeFileSync(outputPath, '{not-json}\n');
    const malformed = writeJsonArtifactIfMateriallyChanged(outputPath, {
      generatedAt: '2026-07-25T00:00:03.000Z',
      status: 'PASS',
    });
    assert.equal(malformed.written, true);
    assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).status, 'PASS');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
