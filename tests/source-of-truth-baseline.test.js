const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const expectedBaseline = 'd7a45257b9aa48d2975db9852a993d79f70972bf';

const documents = [
  {
    file: 'HARDENING_PLAN.md',
    headerLines: 6,
  },
  {
    file: 'NEXT_SESSION_PROMPT.md',
    headerLines: 10,
  },
  {
    file: 'docs/roadmap/current-pr-train.md',
    headerLines: 25,
  },
  {
    file: 'docs/roadmap/production-proof-boundaries.md',
    headerLines: 75,
  },
];

function readDocument(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

test('canonical source-of-truth headers bind the shipped PR #209 baseline', () => {
  for (const { file, headerLines } of documents) {
    const header = readDocument(file).split('\n').slice(0, headerLines).join('\n');

    assert.match(header, /PR #209/, `${file} must identify PR #209`);
    assert.ok(
      header.includes(expectedBaseline),
      `${file} must bind the exact shipped PR #209 SHA`,
    );
  }
});

test('canonical source-of-truth docs preserve the production HOLD boundary', () => {
  for (const { file } of documents) {
    const content = readDocument(file);

    assert.match(content, /Issue #165/, `${file} must retain the Issue #165 gate`);
    assert.match(content, /\bHOLD\b/, `${file} must retain an explicit HOLD state`);
    assert.match(
      content,
      /productionReady.{0,40}false/s,
      `${file} must retain productionReady false`,
    );
  }
});
