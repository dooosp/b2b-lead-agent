import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCandidate,
  extractDeterministicCandidates,
  validateCandidate
} from '../evidence-claim-workbench/domain/candidates.mjs';
import { normalizeSourceDocumentBundle } from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDocument
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';

function normalizedDocument(key, text, productFamilies = ['medium_voltage_switchgear'], language = 'en') {
  return normalizeSourceDocumentBundle(createSyntheticDocument({ key, pages: [text], productFamilies, language }), {
    asOf: SYNTHETIC_BENCHMARK_AS_OF
  });
}

function anchorFor(document, quote, occurrenceIndex) {
  const pageCodePoints = [...document.pages[0].text];
  const quoteCodePoints = [...quote];
  let startCodePoint = -1;
  for (let index = 0; index <= pageCodePoints.length - quoteCodePoints.length; index += 1) {
    if (pageCodePoints.slice(index, index + quoteCodePoints.length).join('') === quote) {
      startCodePoint = index;
      break;
    }
  }
  assert.notEqual(startCodePoint, -1);
  return createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + quoteCodePoints.length,
    quote,
    ...(occurrenceIndex ? { occurrenceIndex } : {})
  });
}

function manualCandidate(overrides = {}) {
  const base = {
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic: true,
    documentId: `doc_${'a'.repeat(64)}`,
    evidenceAnchorId: `anc_${'b'.repeat(64)}`,
    claimType: 'PRODUCT_CAPABILITY',
    subject: { type: 'PRODUCT_FAMILY', id: 'medium_voltage_switchgear', displayName: 'Medium-voltage Switchgear' },
    statement: 'Medium-voltage Switchgear 공식 문서 검토 후보: rated_voltage = 24 kV.',
    value: { type: 'QUANTITY', key: 'rated_voltage', value: 24, unit: 'kV', quantityKind: 'voltage' },
    applicability: {
      vertical: 'datacenter',
      domain: 'electrical_power',
      productFamily: 'medium_voltage_switchgear',
      jurisdiction: 'KR',
      projectStages: ['SPECIFICATION'],
      conditions: []
    },
    validity: { type: 'NOT_STATED', validUntil: null },
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: ['HUMAN_SELECTED_EXACT_EVIDENCE'],
    reviewState: 'REVIEW_REQUIRED'
  };
  return createCandidate({ ...base, ...overrides });
}

test('deterministic, non-LLM rules extract exact four typed classes and all four claim types', () => {
  const cases = [
    {
      key: 'candidate-quantity',
      text: 'Context line. Rated voltage: 24 kV. End line.',
      quote: 'Rated voltage: 24 kV.',
      family: ['medium_voltage_switchgear'],
      expected: ['PRODUCT_CAPABILITY', 'QUANTITY', 'rated_voltage']
    },
    {
      key: 'candidate-range',
      text: 'Context line. Ambient temperature range: -25 to 40 degC. End line.',
      quote: 'Ambient temperature range: -25 to 40 degC.',
      family: ['transformer'],
      expected: ['PRODUCT_CAPABILITY', 'RANGE', 'ambient_temperature']
    },
    {
      key: 'candidate-performance',
      text: 'Context line. Efficiency class: Tier_A. End line.',
      quote: 'Efficiency class: Tier_A.',
      family: ['transformer'],
      expected: ['PERFORMANCE', 'ENUM', 'efficiency_class']
    },
    {
      key: 'candidate-certification',
      text: 'Context line. Certification: IEC 62271-200. End line.',
      quote: 'Certification: IEC 62271-200.',
      family: ['medium_voltage_switchgear'],
      expected: ['CERTIFICATION', 'STRING_SET', 'certification']
    },
    {
      key: 'candidate-requirement',
      text: 'Context line. Required rated voltage: 24 kV. End line.',
      quote: 'Required rated voltage: 24 kV.',
      family: ['medium_voltage_switchgear'],
      expected: ['TECHNICAL_REQUIREMENT', 'QUANTITY', 'rated_voltage']
    }
  ];
  for (const fixture of cases) {
    const document = normalizedDocument(fixture.key, fixture.text, fixture.family);
    const anchor = anchorFor(document, fixture.quote);
    const candidates = extractDeterministicCandidates({ document, anchors: [anchor] });
    const found = candidates.find((candidate) => candidate.value.key === fixture.expected[2]);
    assert.ok(found, fixture.key);
    assert.equal(found.claimType, fixture.expected[0]);
    assert.equal(found.value.type, fixture.expected[1]);
    assert.equal(found.reviewState, 'REVIEW_REQUIRED');
    assert.equal(found.extractionMethod, 'DETERMINISTIC_RULE');
    assert.ok(found.extractionReasons.includes('CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW'));
    assert.doesNotMatch(JSON.stringify(found), /\b(?:VERIFIED|ALLOWED)\b/);
  }
});

test('Korean, condition, and limitation cues stay visible as structured review context', () => {
  const document = normalizedDocument(
    'candidate-ko-condition',
    '합성 문맥. 정격 전압: 24 kV, 옥내용, 고도 최대 1000 m 이하. 끝.',
    ['medium_voltage_switchgear'],
    'ko'
  );
  const quote = '정격 전압: 24 kV, 옥내용, 고도 최대 1000 m 이하.';
  const [candidate] = extractDeterministicCandidates({ document, anchors: [anchorFor(document, quote)] });
  assert.equal(candidate.value.key, 'rated_voltage');
  assert.deepEqual(candidate.applicability.conditions, [
    { id: 'altitude', value: 'maximum_1000_m' },
    { id: 'installation_condition', value: 'indoor_only' }
  ]);
  assert.ok(candidate.extractionReasons.includes('EXPLICIT_LIMITATION_OR_EXCLUSION'));
  assert.match(candidate.statement, /공식 문서 검토 후보/);
});

test('ambiguous units and marketing text make no candidate; ambiguous families fail closed', () => {
  for (const [key, text] of [
    ['candidate-no-unit', 'Context. Rated voltage: 24. End.'],
    ['candidate-wrong-unit', 'Context. Rated voltage: 24 kg. End.'],
    ['candidate-marketing', 'Context. A revolutionary world-class power solution. End.']
  ]) {
    const document = normalizedDocument(key, text);
    const quote = text.split('Context. ')[1]?.replace(' End.', '') || text;
    assert.deepEqual(extractDeterministicCandidates({ document, anchors: [anchorFor(document, quote)] }), []);
  }
  const ambiguous = normalizedDocument('candidate-ambiguous-family', 'Context. Rated voltage: 24 kV. End.', ['medium_voltage_switchgear', 'transformer']);
  assert.throws(
    () => extractDeterministicCandidates({ document: ambiguous, anchors: [anchorFor(ambiguous, 'Rated voltage: 24 kV.')] }),
    (error) => error.code === 'EXACT_PRODUCT_FAMILY_REQUIRED'
  );
});

test('negated English and Korean evidence never becomes a positive capability or inverted condition', () => {
  const cases = [
    ['candidate-negated-protocol', 'Context. This model does not support IEC 61850. End.', 'This model does not support IEC 61850.', 'en'],
    ['candidate-negated-certification', 'Context. This model does not conform to IEC 62271-200. End.', 'This model does not conform to IEC 62271-200.', 'en'],
    ['candidate-negated-outdoor', 'Context. Not suitable for outdoor installation. End.', 'Not suitable for outdoor installation.', 'en'],
    ['candidate-negated-ko-protocol', '문맥. 이 모델은 IEC 61850을 지원하지 않음. 끝.', '이 모델은 IEC 61850을 지원하지 않음.', 'ko'],
    ['candidate-negated-ko-certification', '문맥. 이 모델은 IEC 62271-200 인증되지 않음. 끝.', '이 모델은 IEC 62271-200 인증되지 않음.', 'ko'],
    ['candidate-unsupported-protocol', 'Context. IEC 61850 protocol is unsupported. End.', 'IEC 61850 protocol is unsupported.', 'en'],
    ['candidate-uncertified-standard', 'Context. This switchgear is uncertified to IEC 62271-200. End.', 'This switchgear is uncertified to IEC 62271-200.', 'en'],
    ['candidate-excludes-protocol', 'Context. This switchgear excludes IEC 61850 protocol. End.', 'This switchgear excludes IEC 61850 protocol.', 'en'],
    ['candidate-ko-not-supported-spaced', '문맥. 이 모델은 IEC 61850 지원 안 함. 끝.', '이 모델은 IEC 61850 지원 안 함.', 'ko'],
    ['candidate-ko-unsupported-prefix', '문맥. 이 모델은 IEC 61850 비지원. 끝.', '이 모델은 IEC 61850 비지원.', 'ko'],
    ['candidate-no-support', 'Context. No support for IEC 61850 protocol. End.', 'No support for IEC 61850 protocol.', 'en'],
    ['candidate-fails-support', 'Context. This model fails to support IEC 61850. End.', 'This model fails to support IEC 61850.', 'en'],
    ['candidate-support-unavailable', 'Context. IEC 61850 protocol support is unavailable. End.', 'IEC 61850 protocol support is unavailable.', 'en'],
    ['candidate-certification-absent', 'Context. IEC 62271-200 certification is absent. End.', 'IEC 62271-200 certification is absent.', 'en'],
    ['candidate-has-no-certification', 'Context. This switchgear has no IEC 62271-200 certification. End.', 'This switchgear has no IEC 62271-200 certification.', 'en'],
    ['candidate-ko-support-none', '문맥. 이 모델은 IEC 61850 지원 없음. 끝.', '이 모델은 IEC 61850 지원 없음.', 'ko'],
    ['candidate-ko-certification-none', '문맥. 이 모델은 IEC 62271-200 인증 없음. 끝.', '이 모델은 IEC 62271-200 인증 없음.', 'ko'],
    ['candidate-certification-revoked', 'Context. IEC 62271-200 certification was revoked. End.', 'IEC 62271-200 certification was revoked.', 'en'],
    ['candidate-certification-expired', 'Context. Certification to IEC 62271-200 has expired. End.', 'Certification to IEC 62271-200 has expired.', 'en'],
    ['candidate-no-longer-certified', 'Context. This model is no longer certified to IEC 62271-200. End.', 'This model is no longer certified to IEC 62271-200.', 'en'],
    ['candidate-support-discontinued', 'Context. Support for IEC 61850 was discontinued. End.', 'Support for IEC 61850 was discontinued.', 'en'],
    ['candidate-support-removed', 'Context. IEC 61850 protocol support has been removed. End.', 'IEC 61850 protocol support has been removed.', 'en'],
    ['candidate-ko-certification-expired', '문맥. 이 모델은 IEC 62271-200 인증 만료. 끝.', '이 모델은 IEC 62271-200 인증 만료.', 'ko'],
    ['candidate-ko-support-ended', '문맥. 이 모델은 IEC 61850 지원 종료. 끝.', '이 모델은 IEC 61850 지원 종료.', 'ko'],
    ['candidate-support-disabled', 'Context. IEC 61850 protocol support is disabled. End.', 'IEC 61850 protocol support is disabled.', 'en'],
    ['candidate-support-has-ceased', 'Context. IEC 61850 protocol support has ceased. End.', 'IEC 61850 protocol support has ceased.', 'en'],
    ['candidate-certification-lapsed', 'Context. Certification IEC 62271-200 has lapsed. End.', 'Certification IEC 62271-200 has lapsed.', 'en'],
    ['candidate-certification-pending', 'Context. Certification to IEC 62271-200 is pending. End.', 'Certification to IEC 62271-200 is pending.', 'en'],
    ['candidate-certification-under-review', 'Context. IEC 62271-200 certification is under review. End.', 'IEC 62271-200 certification is under review.', 'en'],
    ['candidate-certification-application', 'Context. Application submitted for IEC 62271-200 certification. End.', 'Application submitted for IEC 62271-200 certification.', 'en'],
    ['candidate-protocol-roadmap', 'Context. IEC 61850 protocol support is on the roadmap. End.', 'IEC 61850 protocol support is on the roadmap.', 'en'],
    ['candidate-protocol-future', 'Context. IEC 61850 will be supported in a future release. End.', 'IEC 61850 will be supported in a future release.', 'en'],
    ['candidate-tentative-numeric', 'Context. Proposed rated voltage: 24 kV. End.', 'Proposed rated voltage: 24 kV.', 'en'],
    ['candidate-tentative-numeric-ko', '문맥. 예상 정격 전압: 24 kV. 끝.', '예상 정격 전압: 24 kV.', 'ko'],
    ['candidate-mixed-protocol-negative', 'Context. Supports Modbus TCP, not IEC 61850. End.', 'Supports Modbus TCP, not IEC 61850.', 'en'],
    ['candidate-protocol-no-field', 'Context. Protocols: Modbus TCP; IEC 61850: No. End.', 'Protocols: Modbus TCP; IEC 61850: No.', 'en'],
    ['candidate-certification-na', 'Context. IEC 62271-200 certification: N/A. End.', 'IEC 62271-200 certification: N/A.', 'en'],
    ['candidate-support-ko-x', '문맥. IEC 61850 지원: X. 끝.', 'IEC 61850 지원: X.', 'ko'],
    ['candidate-certification-denied', 'Context. IEC 62271-200 certification was denied. End.', 'IEC 62271-200 certification was denied.', 'en'],
    ['candidate-support-off', 'Context. IEC 61850 protocol support is off. End.', 'IEC 61850 protocol support is off.', 'en'],
    ['candidate-certification-denied-ko', '문맥. IEC 62271-200 인증 거부. 끝.', 'IEC 62271-200 인증 거부.', 'ko'],
    ['candidate-support-blocked-ko', '문맥. IEC 61850 지원 차단. 끝.', 'IEC 61850 지원 차단.', 'ko']
  ];
  for (const [key, text, quote, language] of cases) {
    const document = normalizedDocument(key, text, ['medium_voltage_switchgear'], language);
    assert.deepEqual(extractDeterministicCandidates({ document, anchors: [anchorFor(document, quote)] }), [], key);
  }
});

test('protocol extraction requires bounded affirmative grammar', () => {
  const cases = [
    ['candidate-protocol-field', 'Supported protocols: IEC 61850, Modbus TCP.'],
    ['candidate-protocol-verb', 'This model supports IEC 61850.'],
    ['candidate-protocol-passive', 'IEC 61850 is supported.'],
    ['candidate-protocol-field-ko', '지원 프로토콜: IEC 61850.']
  ];
  for (const [key, quote] of cases) {
    const document = normalizedDocument(key, `Context. ${quote} End.`, ['medium_voltage_switchgear']);
    const anchor = anchorFor(document, quote);
    const candidates = extractDeterministicCandidates({ document, anchors: [anchor] });
    assert.ok(candidates.some((candidate) => candidate.value.key === 'communication_protocol'), key);
  }
});

test('candidate refuses authority, confidence, identity, private/freeform, unsupported types, and forged IDs', () => {
  const candidate = manualCandidate();
  assert.equal(validateCandidate(candidate).candidateId, candidate.candidateId);
  assert.throws(
    () => createCandidate({ ...candidate, statement: 'VERIFIED' }),
    (error) => error.code === 'AUTHORITY_VALUE_REFUSED'
  );
  for (const statement of [
    'Medium-voltage Switchgear is VeRiFiEd for repository use.',
    'Medium-voltage Switchgear is customer use ALLOWED.',
    'Medium-voltage Switchgear is VERIFIED_FOR_USE.',
    'Medium-voltage Switchgear is ALLOWED_FOR_CUSTOMER.',
    'Medium-voltage Switchgear is ＶＥＲＩＦＩＥＤ for repository use.',
    'Medium-voltage Switchgear is ＡＬＬＯＷＥＤ for customer use.',
    'Medium-voltage Switchgear is ＶERIFIED and AＬＬＯＷＥＤ.',
    'Customer use is approved.',
    'Commercially approved product.',
    'Legally approved for production.',
    'Approved for customer-use.',
    'Commercial approval granted.',
    'Legal approval granted.',
    'Production approval granted.',
    'Customer-use authorized.',
    '고객 사용 승인 제품.',
    '고객용 승인 제품.',
    '법률 승인 제품.',
    'Production ready product.'
  ]) {
    assert.throws(
      () => createCandidate({ ...candidate, statement }),
      (error) => error.code === 'AUTHORITY_VALUE_REFUSED'
    );
  }
  const disallowedCandidate = structuredClone(candidate);
  delete disallowedCandidate.candidateId;
  disallowedCandidate.applicability.conditions = [{ id: 'configuration', value: 'explicitly_disallowed' }];
  assert.doesNotThrow(() => createCandidate(disallowedCandidate));
  assert.throws(
    () => createCandidate({ ...candidate, statement: 'Innocent but arbitrary narrative.' }),
    (error) => error.code === 'CANDIDATE_STATEMENT_MISMATCH'
  );
  assert.throws(
    () => createCandidate({
      ...candidate,
      applicability: {
        ...candidate.applicability,
        conditions: [{ id: 'configuration', value: 'customer use allowed' }]
      }
    }),
    (error) => error.code === 'AUTHORITY_VALUE_REFUSED'
  );
  for (const [field, value, code] of [
    ['status', 'VERIFIED', 'AUTHORITY_FIELD_REFUSED'],
    ['customerUse', 'ALLOWED', 'AUTHORITY_FIELD_REFUSED'],
    ['confidence', 0.99, 'AUTHORITY_FIELD_REFUSED'],
    ['claimId', 'clm_forged', 'AUTHORITY_FIELD_REFUSED'],
    ['reviewerIdentity', 'person@example.test', 'AUTHORITY_FIELD_REFUSED'],
    ['notes', 'arbitrary free text', 'AUTHORITY_FIELD_REFUSED']
  ]) {
    assert.throws(() => createCandidate({ ...candidate, [field]: value }), (error) => error.code === code, field);
  }
  assert.throws(
    () => createCandidate({ ...candidate, candidateId: `cand_${'0'.repeat(64)}` }),
    (error) => error.code === 'CANDIDATE_ID_MISMATCH'
  );
  assert.throws(
    () => createCandidate({ ...candidate, value: { type: 'STRING', key: 'rated_voltage', value: '24 kV' } }),
    (error) => error.code === 'UNSUPPORTED_VALUE_TYPE'
  );
});

test('extraction validates the complete anchor against the document and exposes failure injection', () => {
  const document = normalizedDocument('candidate-anchor-integrity', 'Context. Rated voltage: 24 kV. End.');
  const anchor = anchorFor(document, 'Rated voltage: 24 kV.');
  const forged = structuredClone(anchor);
  forged.selection.quote = 'Rated voltage: 36 kV.';
  assert.throws(
    () => extractDeterministicCandidates({ document, anchors: [forged] }),
    (error) => ['PAGE_QUOTE_MISMATCH', 'QUOTE_OFFSET_LENGTH_MISMATCH'].includes(error.code)
  );
  assert.throws(
    () => extractDeterministicCandidates({ document, anchors: [{ ...anchor, anchorId: `anc_${'0'.repeat(64)}` }] }),
    (error) => error.code === 'ANCHOR_ID_MISMATCH'
  );
  assert.throws(
    () => extractDeterministicCandidates({ document, anchors: [anchor] }, {
      inject: { beforeCandidateGeneration() { throw Object.assign(new Error('injected'), { code: 'INJECTED_CANDIDATE_FAILURE' }); } }
    }),
    (error) => error.code === 'INJECTED_CANDIDATE_FAILURE'
  );
});
