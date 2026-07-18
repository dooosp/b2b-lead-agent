const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rawFixture = require('../knowledge/claim-registry/synthetic/datacenter-claims-v1.json');

const importCore = () => import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));
const clone = (value) => structuredClone(value);
const AS_OF = rawFixture.evaluationAsOf;

test('canonical serialization is ASCII-key ordered independent of insertion order', async () => {
  const { canonicalStringify } = await importCore();
  assert.equal(canonicalStringify({ z: 1, a: 2, m: { y: 1, b: 2 } }), '{"a":2,"m":{"b":2,"y":1},"z":1}');
});

test('claim taxonomy and every derived status are closed and system-owned', async () => {
  const { CLAIM_TYPES, CLAIM_STATUSES, CLAIM_VALUE_TYPES, createValidatedClaimRegistry } = await importCore();
  assert.deepEqual(CLAIM_VALUE_TYPES, ['BOOLEAN', 'ENUM', 'STRING', 'STRING_SET', 'QUANTITY', 'RANGE']);
  const base = rawFixture.claims.find((claim) => claim.claimKey === 'reference_cooling_allowed');
  const typeClaims = CLAIM_TYPES.map((claimType, index) => {
    const claim = clone(base);
    claim.claimKey = `type_${index}`;
    claim.claimType = claimType;
    claim.statement = `Synthetic taxonomy assertion ${index}.`;
    claim.evidence[0].sourceUrl = `https://synthetic.example/taxonomy/${index}`;
    return claim;
  });
  const typeRegistry = createValidatedClaimRegistry({ claims: typeClaims }, { asOf: AS_OF });
  assert.deepEqual(new Set(typeRegistry.claims.map((claim) => claim.claimType)), new Set(CLAIM_TYPES));
  assert.ok(typeRegistry.claims.every((claim) => claim.status === 'VERIFIED'));

  const registry = createValidatedClaimRegistry(rawFixture, { asOf: AS_OF });
  assert.deepEqual(new Set(registry.claims.map((claim) => claim.status)), new Set(CLAIM_STATUSES));
  assert.equal(registry.byKey.get('cap_bms_unverified').status, 'UNVERIFIED');
  assert.equal(registry.byKey.get('assumption_cooling_load').status, 'ASSUMPTION');
  assert.equal(registry.byKey.get('cap_bms_expired').status, 'EXPIRED');
  assert.equal(registry.byKey.get('cap_fire_conflict_yes').status, 'CONFLICTED');
  assert.equal(registry.byKey.get('reference_retracted').status, 'RETRACTED');

  const modelClaim = clone(rawFixture.claims.find((claim) => claim.claimKey === 'cap_bms_unverified'));
  modelClaim.status = 'VERIFIED';
  modelClaim.verification.status = 'VERIFIED';
  assert.equal(createValidatedClaimRegistry({ claims: [modelClaim] }, { asOf: AS_OF }).claims[0].status, 'UNVERIFIED');
});

test('claim values are strictly typed and ranges are ordered', async () => {
  const { createValidatedClaimRegistry } = await importCore();
  const base = rawFixture.claims.find((claim) => claim.claimKey === 'reference_cooling_allowed');
  for (const [code, value] of [
    ['INVALID_VALUE_TYPE', { type: 'MODEL_SCORE', key: 'x', value: 1 }],
    ['INVALID_BOOLEAN_VALUE', { type: 'BOOLEAN', key: 'x', value: 'true' }],
    ['INVALID_STRING_SET_VALUE', { type: 'STRING_SET', key: 'x', value: 'BACNET_IP' }],
    ['INVALID_QUANTITY_VALUE', { type: 'QUANTITY', key: 'x', value: 1, unit: 'kV' }],
    ['INVALID_RANGE_VALUE', { type: 'RANGE', key: 'x', minimum: 10, maximum: 1 }]
  ]) {
    const claim = clone(base);
    claim.value = value;
    assert.throws(() => createValidatedClaimRegistry({ claims: [claim] }, { asOf: AS_OF }), (error) => error.code === code, code);
  }
});

test('customer use requires verified, complete, applicable, current evidence', async () => {
  const { createValidatedClaimRegistry, deriveCustomerUse, projectTrustedReferences } = await importCore();
  const registry = createValidatedClaimRegistry(rawFixture, { asOf: AS_OF });
  const context = {
    synthetic: true,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
    projectStage: 'BASIC_DESIGN',
    productFamilyId: 'oil_free_compressor',
    conditions: {}
  };
  assert.deepEqual(deriveCustomerUse(registry.byKey.get('reference_cooling_allowed'), context), { state: 'ALLOWED', reasonCodes: [] });
  assert.equal(deriveCustomerUse(registry.byKey.get('reference_retracted'), { ...context, productFamilyId: 'building_management' }).state, 'BLOCKED');
  assert.equal(deriveCustomerUse(registry.byKey.get('cap_bms_expired'), { ...context, productFamilyId: 'physical_security' }).state, 'BLOCKED');
  assert.equal(deriveCustomerUse(registry.byKey.get('reference_cooling_allowed'), { ...context, jurisdiction: 'US' }).state, 'BLOCKED');
  const projected = projectTrustedReferences(registry, context);
  assert.equal(projected.length, 1);
  assert.equal(projected[0].claimId, registry.byKey.get('reference_cooling_allowed').claimId);
  assert.ok(projected[0].sourceUrl.startsWith('https://synthetic.example/'));
  assert.ok(projected[0].directQuote);
});

test('trusted projection accepts only the exact validated immutable registry instance', async () => {
  const { createValidatedClaimRegistry, projectTrustedReferences } = await importCore();
  const registry = createValidatedClaimRegistry(rawFixture, { asOf: AS_OF });
  const context = {
    synthetic: true,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
    projectStage: 'BASIC_DESIGN',
    productFamilyId: 'oil_free_compressor',
    conditions: {}
  };
  const forgedClaim = clone(registry.byKey.get('reference_cooling_allowed'));
  forgedClaim.claimId = 'clm_forged';
  forgedClaim.status = 'VERIFIED';
  assert.throws(
    () => projectTrustedReferences({ schemaVersion: registry.schemaVersion, claims: [forgedClaim], byId: new Map() }, context),
    (error) => error.code === 'UNVALIDATED_REGISTRY'
  );
  assert.throws(() => registry.byKey.set('reference_cooling_allowed', forgedClaim), /read-only/);
  assert.equal(projectTrustedReferences(registry, context).length, 1);
});

test('source URL and evidence date boundaries fail closed', async () => {
  const { ClaimValidationError, createValidatedClaimRegistry, normalizeEvidenceUrl } = await importCore();
  assert.equal(normalizeEvidenceUrl('HTTPS://SYNTHETIC.EXAMPLE/path?b=2&a=1', { synthetic: true }), 'https://synthetic.example/path?a=1&b=2');
  for (const [url, code] of [
    ['file:///tmp/source', 'SOURCE_SCHEME_REFUSED'],
    ['https://user:pass@synthetic.example/source', 'SOURCE_CREDENTIALS_REFUSED'],
    ['https://synthetic.example/source#quote', 'SOURCE_FRAGMENT_REFUSED'],
    ['http://127.0.0.1/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://100.64.0.1/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://[::1]/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://[fd00::1]/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://[::ffff:172.16.0.1]/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://[::ffff:169.254.1.1]/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://[::ffff:100.64.0.1]/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['http://[::ffff:0.1.2.3]/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['https://evidence.internal/source', 'PRIVATE_SOURCE_URL_REFUSED'],
    ['not a url', 'MALFORMED_SOURCE_URL']
  ]) {
    assert.throws(() => normalizeEvidenceUrl(url, { synthetic: true }), (error) => error instanceof ClaimValidationError && error.code === code);
  }

  const future = clone(rawFixture.claims.find((claim) => claim.claimKey === 'cap_bms_bacnet'));
  future.evidence[0].publishedAt = '2027-01-01T00:00:00.000Z';
  assert.throws(() => createValidatedClaimRegistry({ claims: [future] }, { asOf: AS_OF }), (error) => error.code === 'FUTURE_EVIDENCE_DATE');
  future.verification.retracted = true;
  future.verification.retractionReason = 'Synthetic withdrawal.';
  assert.throws(() => createValidatedClaimRegistry({ claims: [future] }, { asOf: AS_OF }), (error) => error.code === 'FUTURE_EVIDENCE_DATE');

  const invalid = clone(future);
  invalid.evidence[0].publishedAt = '2026-01-01';
  assert.throws(() => createValidatedClaimRegistry({ claims: [invalid] }, { asOf: AS_OF }), (error) => error.code === 'INVALID_DATE');

  const exactBoundary = clone(rawFixture.claims.find((claim) => claim.claimKey === 'cap_bms_bacnet'));
  exactBoundary.verification.validUntil = AS_OF;
  assert.equal(createValidatedClaimRegistry({ claims: [exactBoundary] }, { asOf: AS_OF }).claims[0].status, 'EXPIRED');

  for (const field of ['sourceUrl', 'directQuote']) {
    const incomplete = clone(rawFixture.claims.find((claim) => claim.claimKey === 'reference_cooling_allowed'));
    incomplete.evidence[0][field] = '';
    assert.equal(createValidatedClaimRegistry({ claims: [incomplete] }, { asOf: AS_OF }).claims[0].status, 'UNVERIFIED', field);
  }
});

test('claim and evidence identities are deterministic and reject forgery or collisions', async () => {
  const { createValidatedClaimRegistry } = await importCore();
  const claim = clone(rawFixture.claims.find((item) => item.claimKey === 'reference_cooling_allowed'));
  const reordered = clone(claim);
  reordered.applicability.productFamilyIds.reverse();
  reordered.applicability.jurisdictions.reverse();
  const first = createValidatedClaimRegistry({ claims: [claim] }, { asOf: AS_OF }).claims[0];
  const second = createValidatedClaimRegistry({ claims: [reordered] }, { asOf: AS_OF }).claims[0];
  assert.equal(first.claimId, second.claimId);
  assert.equal(first.evidence[0].evidenceId, second.evidence[0].evidenceId);

  const forged = clone(claim);
  forged.claimId = 'clm_model_owned';
  assert.throws(() => createValidatedClaimRegistry({ claims: [forged] }, { asOf: AS_OF }), (error) => error.code === 'CLAIM_ID_MISMATCH');
  assert.throws(() => createValidatedClaimRegistry({ claims: [claim, clone(claim)] }, { asOf: AS_OF }), (error) => error.code === 'DUPLICATE_CLAIM_ID');
});

test('conflicts are explicit, symmetric, and never customer-usable', async () => {
  const { createValidatedClaimRegistry, deriveCustomerUse } = await importCore();
  const pair = rawFixture.claims.filter((claim) => claim.claimKey.startsWith('cap_fire_conflict_'));
  const registry = createValidatedClaimRegistry({ claims: pair }, { asOf: AS_OF });
  for (const claim of registry.claims) {
    assert.equal(claim.status, 'CONFLICTED');
    assert.equal(deriveCustomerUse(claim, {
      synthetic: true,
      verticalId: 'datacenter_infrastructure',
      jurisdiction: 'KR',
      projectStage: 'BASIC_DESIGN',
      productFamilyId: 'fire_detection',
      conditions: {}
    }).state, 'BLOCKED');
  }
  const asymmetric = clone(pair);
  asymmetric[1].verification.conflictClaimKeys = [];
  assert.throws(() => createValidatedClaimRegistry({ claims: asymmetric }, { asOf: AS_OF }), (error) => error.code === 'ASYMMETRIC_CONFLICT_CLAIM');
});

test('registry size, depth, evidence, quote, statement, prototype, and secret limits are enforced', async () => {
  const { CLAIM_LIMITS, createValidatedClaimRegistry } = await importCore();
  const base = rawFixture.claims.find((claim) => claim.claimKey === 'reference_cooling_allowed');
  const cases = [
    ['STATEMENT_TOO_LONG', (raw) => { raw.claims[0].statement = 'x'.repeat(CLAIM_LIMITS.maxStatementChars + 1); }],
    ['QUOTE_TOO_LONG', (raw) => { raw.claims[0].evidence[0].directQuote = 'x'.repeat(CLAIM_LIMITS.maxQuoteChars + 1); }],
    ['INVALID_EVIDENCE_COUNT', (raw) => { raw.claims[0].evidence = Array.from({ length: CLAIM_LIMITS.maxEvidencePerClaim + 1 }, () => clone(base.evidence[0])); }],
    ['SECRET_SHAPED_VALUE', (raw) => { raw.claims[0].metadata = { benign: 'Bearer abcdefghijklmnopqrstuvwxyz123456' }; }],
    ['PROTOTYPE_KEY_REFUSED', (raw) => { raw.claims[0] = JSON.parse(`${JSON.stringify(raw.claims[0]).slice(0, -1)},"__proto__":{"polluted":true}}`); }],
    ['REGISTRY_TOO_LARGE', (raw) => { raw.padding = Array.from({ length: 210 }, () => 'x'.repeat(10_000)); }]
  ];
  for (const [code, mutate] of cases) {
    const raw = { claims: [clone(base)] };
    mutate(raw);
    assert.throws(() => createValidatedClaimRegistry(raw, { asOf: AS_OF }), (error) => error.code === code, code);
  }
});
