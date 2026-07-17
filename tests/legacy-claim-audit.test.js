const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const inventory = require('../knowledge/claim-registry/managed-profile-legacy-inventory.json');
const importCore = () => import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));

test('managed-profile inventory is current, deterministic, complete, and non-destructive', async () => {
  const { canonicalStringify } = await importCore();
  const { buildLegacyClaimInventory } = await import(path.resolve(__dirname, '../scripts/generate-legacy-claim-inventory.mjs'));
  const profilePaths = ['danfoss', 'ls-electric', 'siemens'].map((id) => path.resolve(__dirname, `../profiles/${id}.js`));
  const before = await Promise.all(profilePaths.map((file) => readFile(file, 'utf8')));
  const currentOne = buildLegacyClaimInventory();
  const currentTwo = buildLegacyClaimInventory();
  const after = await Promise.all(profilePaths.map((file) => readFile(file, 'utf8')));
  assert.equal(canonicalStringify(currentOne), canonicalStringify(inventory));
  assert.equal(canonicalStringify(currentOne), canonicalStringify(currentTwo));
  assert.deepEqual(after, before);
  assert.deepEqual(currentOne.summary.byProfile, { danfoss: 52, 'ls-electric': 53, siemens: 55 });
  assert.equal(currentOne.summary.referenceSeedObjectCount, 36);
  assert.equal(currentOne.candidates.length, 160);
});

test('every legacy candidate has source location and unsourced claims remain blocked', async () => {
  const { auditLegacyInventory } = await importCore();
  const report = auditLegacyInventory(inventory);
  assert.deepEqual({
    total: report.totalClaimCandidates,
    verified: report.verified,
    unverified: report.unverified,
    assumption: report.assumption,
    blocked: report.customerUseBlocked,
    violations: report.violations.length
  }, { total: 160, verified: 0, unverified: 139, assumption: 21, blocked: 160, violations: 0 });
  assert.ok(inventory.candidates.every((candidate) => candidate.sourcePath && candidate.sourceField));
  assert.ok(inventory.candidates.every((candidate) => !candidate.sourceAvailability && !candidate.directQuoteAvailability && !candidate.verificationDateAvailability));
  assert.ok(inventory.candidates.every((candidate) => candidate.currentTrustClassification !== 'VERIFIED' && candidate.derivedCustomerUse === 'BLOCKED'));
  for (const prefix of ['productKnowledge.', 'globalReferences.', 'categoryConfig.', 'competitors', 'searchQueries', 'reference_library.seed.']) {
    assert.ok(inventory.candidates.some((candidate) => candidate.sourceField.startsWith(prefix)), prefix);
  }
});

test('managed profiles still load while source-empty reference seeds have no trusted proposal projection', async () => {
  for (const profileId of ['danfoss', 'ls-electric', 'siemens']) {
    const profile = require(`../profiles/${profileId}`);
    assert.equal(profile.id, profileId);
    assert.ok(Object.keys(profile.productKnowledge).length > 0);
    assert.ok(Object.keys(profile.globalReferences).length > 0);
  }
  const { getReferencesForProposal, addReference, deleteReference } = await import(path.resolve(__dirname, '../worker/db/references.js'));
  const db = { prepare() { throw new Error('legacy D1 must not be consulted for trusted projection'); } };
  assert.deepEqual(await getReferencesForProposal(db, 'siemens', ['bms', 'esco']), []);
  assert.equal(await addReference(null, {}), null);
  assert.equal(await deleteReference(null, 1), false);
});
