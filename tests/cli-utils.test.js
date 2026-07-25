const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

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
