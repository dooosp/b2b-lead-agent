import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

export const REQUIRED_SENSITIVITY_LABELS = Object.freeze([
  'non-loopback',
  'arbitrary-path',
  'document-hash',
  'page-hash',
  'quote-presence',
  'quote-offsets',
  'credentialed-url',
  'private-url',
  'imported-model-verified',
  'review-to-verified',
  'review-to-allowed',
  'disabled-conflicts',
  'superseded-treated-current',
  'full-page-patch',
  'absolute-path-patch',
  'reviewer-identity-patch',
  'html-escaping',
  'external-browser-requests',
  'local-storage',
  'canonical-ordering',
  'candidate-id-content-reuse',
  'third-party-pdf-staged-by-default'
]);

class SensitivityHarnessError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SensitivityHarnessError';
    this.code = code;
  }
}

class StaticGuardProbeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'StaticGuardProbeError';
    this.code = code;
  }
}

function requireSourceIncludes(source, fragments, failureCode) {
  if (fragments.some((fragment) => !source.includes(fragment))) {
    throw new StaticGuardProbeError(failureCode);
  }
}

function requireLoopbackOnly(source) {
  requireSourceIncludes(source, [
    "value !== '127.0.0.1'",
    "value !== '::1'",
    "fail('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', '$.host')"
  ], 'NON_LOOPBACK_GUARD_MISSING');
}

function requireClosedRouteSet(source) {
  requireSourceIncludes(source, [
    "rawUrl.includes('%')",
    "rawUrl.includes('\\\\')",
    "rawUrl.includes('?')",
    "rawUrl.includes('#')",
    "rawUrl.includes('..')",
    '!SAFE_ROUTE.test(rawUrl)',
    "return { kind: 'UNKNOWN' }"
  ], 'ARBITRARY_PATH_GUARD_MISSING');
}

function requireDocumentHash(source) {
  requireSourceIncludes(source, [
    "typeof raw.sha256 !== 'string'",
    '!SHA256_HEX_PATTERN.test(raw.sha256)',
    "fail('INVALID_FILE_SHA256', `${path}.sha256`)"
  ], 'DOCUMENT_HASH_GUARD_MISSING');
}

function requirePageHash(source) {
  requireSourceIncludes(source, [
    'page.textSha256 !== undefined && page.textSha256 !== textSha256',
    "fail('PAGE_TEXT_SHA256_MISMATCH', `${pagePath}.textSha256`)"
  ], 'PAGE_HASH_GUARD_MISSING');
}

function requireQuotePresence(source) {
  requireSourceIncludes(source, [
    'const selected = pageCodePoints.slice(input.startCodePoint, input.endCodePoint).join',
    'selected !== quote',
    "fail('PAGE_QUOTE_MISMATCH', `${path}.quote`)"
  ], 'QUOTE_PRESENCE_GUARD_MISSING');
}

function requireQuoteOffsets(source) {
  requireSourceIncludes(source, [
    'input.endCodePoint !== input.startCodePoint + quoteLength',
    "fail('QUOTE_OFFSET_LENGTH_MISMATCH', path)",
    'input.endCodePoint > pageCodePoints.length'
  ], 'QUOTE_OFFSET_GUARD_MISSING');
}

function requireCredentiallessUrl(source) {
  requireSourceIncludes(source, [
    'parsed.username || parsed.password',
    "throw new ClaimValidationError('SOURCE_CREDENTIALS_REFUSED', path)"
  ], 'CREDENTIALED_URL_GUARD_MISSING');
}

function requirePublicUrl(source) {
  requireSourceIncludes(source, [
    "hostname === 'localhost'",
    'isPrivateIpv4(hostname)',
    'isPrivateIpv6(hostname)',
    "throw new ClaimValidationError('PRIVATE_SOURCE_URL_REFUSED', path)"
  ], 'PRIVATE_URL_GUARD_MISSING');
}

function requireCandidateAuthorityRefusal(source) {
  requireSourceIncludes(source, [
    'const FORBIDDEN_AUTHORITY_VALUE = /',
    'assertNoAuthorityFields(rawCandidate);',
    "throw new CandidateValidationError('AUTHORITY_VALUE_REFUSED', path)"
  ], 'IMPORTED_MODEL_VERIFIED_GUARD_MISSING');
}

function requireReviewCannotVerify(source) {
  requireSourceIncludes(source, [
    'rawPatch.automaticVerification !== false',
    "throw new ReviewPatchValidationError('PATCH_BOUNDARY_INVALID')"
  ], 'REVIEW_TO_VERIFIED_GUARD_MISSING');
}

function requireReviewCannotAllow(source) {
  requireSourceIncludes(source, [
    'rawPatch.customerUseAllowed !== false',
    "throw new ReviewPatchValidationError('PATCH_BOUNDARY_INVALID')"
  ], 'REVIEW_TO_ALLOWED_GUARD_MISSING');
}

function requireMaterialConflictBlocking(source) {
  requireSourceIncludes(source, [
    "type === 'EXACT_DUPLICATE_EVIDENCE' || type === 'MATERIAL_CONFLICT' || type === 'SUPERSEDES'",
    "['CONFLICTING_DOCUMENT']"
  ], 'MATERIAL_CONFLICT_GUARD_MISSING');
}

function requireSupersessionBlocking(source) {
  requireSourceIncludes(source, [
    "type === 'EXACT_DUPLICATE_EVIDENCE' || type === 'MATERIAL_CONFLICT' || type === 'SUPERSEDES'",
    'supersededCandidateId:',
    'successorCandidateId:'
  ], 'SUPERSESSION_GUARD_MISSING');
}

function requireBoundedPatchQuote(source) {
  requireSourceIncludes(source, [
    'anchor.selection.quote === page.text',
    "throw new ReviewPatchValidationError('FULL_PAGE_EXCERPT_REFUSED'"
  ], 'FULL_PAGE_PATCH_GUARD_MISSING');
}

function requireNoAbsolutePatchPath(source) {
  requireSourceIncludes(source, [
    'ABSOLUTE_LOCAL_PATH.test(representation)',
    "throw new ReviewPatchValidationError('LOCAL_ABSOLUTE_PATH_REFUSED', path)"
  ], 'ABSOLUTE_PATH_PATCH_GUARD_MISSING');
}

function requireNoReviewerIdentity(source) {
  requireSourceIncludes(source, [
    "rawPatch.reviewerIdentity !== 'NOT_COLLECTED'",
    "reviewerIdentity: 'NOT_COLLECTED'"
  ], 'REVIEWER_IDENTITY_PATCH_GUARD_MISSING');
}

function requireHtmlEscaping(source) {
  requireSourceIncludes(source, [
    ".replaceAll('&', '&amp;')",
    ".replaceAll('<', '&lt;')",
    ".replaceAll('>', '&gt;')",
    ".replaceAll('\"', '&quot;')",
    `.replaceAll("'", '&#39;')`
  ], 'HTML_ESCAPING_GUARD_MISSING');
}

function requireSameOriginBrowserRequests(source) {
  const fetchTargets = [...source.matchAll(/\bfetch\(\s*(['"])([^'"]+)\1/g)].map((match) => match[2]);
  if (fetchTargets.length === 0
    || fetchTargets.some((target) => !target.startsWith('/api/') || target.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(target))) {
    throw new StaticGuardProbeError('EXTERNAL_BROWSER_REQUEST_GUARD_MISSING');
  }
}

function requireMemoryOnlyBrowserState(source) {
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(source)) {
    throw new StaticGuardProbeError('BROWSER_PERSISTENCE_GUARD_MISSING');
  }
}

function requireCanonicalOrdering(source) {
  const canonicalizeStart = source.indexOf('function canonicalize(value)');
  const canonicalStringifyStart = source.indexOf('export function canonicalStringify', canonicalizeStart);
  const canonicalizeSource = canonicalizeStart >= 0 && canonicalStringifyStart > canonicalizeStart
    ? source.slice(canonicalizeStart, canonicalStringifyStart)
    : '';
  requireSourceIncludes(canonicalizeSource, [
    'Object.keys(value)',
    '.sort(compareAscii)',
    '.map((key) => [key, canonicalize(value[key])])'
  ], 'CANONICAL_ORDERING_GUARD_MISSING');
}

function requireCandidateIdContentBinding(source) {
  requireSourceIncludes(source, [
    'rawCandidate.candidateId !== candidateId',
    "throw new CandidateValidationError('CANDIDATE_ID_MISMATCH'"
  ], 'CANDIDATE_ID_CONTENT_REUSE_GUARD_MISSING');
}

function requirePdfRefusal(source) {
  requireSourceIncludes(source, [
    "entry.mediaType === 'application/pdf'",
    "extension === '.pdf'",
    "entry.documentType === 'PDF'",
    "fail('RAW_PDF_PARSER_UNAVAILABLE', `${entryPath}.mediaType`)"
  ], 'PDF_DEFAULT_STAGING_GUARD_MISSING');
}

const RELATIONSHIP_BLOCKING_LINE = "    blocking: type === 'EXACT_DUPLICATE_EVIDENCE' || type === 'MATERIAL_CONFLICT' || type === 'SUPERSEDES',";

export const MUTATION_CASES = Object.freeze([
  {
    label: 'non-loopback',
    target: 'evidence-claim-workbench/server.mjs',
    mutation: 'allow a non-loopback server host',
    probeId: 'STATIC_LOOPBACK_BINDING',
    expectedFailure: 'NON_LOOPBACK_GUARD_MISSING',
    existingTest: 'tests/official-evidence-workbench-server.test.mjs',
    from: "  if (value !== '127.0.0.1' && value !== '::1') fail('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', '$.host');",
    to: "  if (false) fail('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', '$.host');",
    probe: requireLoopbackOnly
  },
  {
    label: 'arbitrary-path',
    target: 'evidence-claim-workbench/server.mjs',
    mutation: 'remove parent-segment route refusal',
    probeId: 'STATIC_CLOSED_ROUTE_SET',
    expectedFailure: 'ARBITRARY_PATH_GUARD_MISSING',
    existingTest: 'tests/official-evidence-workbench-server.test.mjs',
    from: "    || rawUrl.includes('..')",
    to: '    || false',
    probe: requireClosedRouteSet
  },
  {
    label: 'document-hash',
    target: 'evidence-claim-workbench/domain/document-bundle.mjs',
    mutation: 'remove source-document SHA-256 validation',
    probeId: 'STATIC_DOCUMENT_HASH_BINDING',
    expectedFailure: 'DOCUMENT_HASH_GUARD_MISSING',
    existingTest: 'tests/official-evidence-document-bundle.test.mjs',
    from: "  if (typeof raw.sha256 !== 'string' || !SHA256_HEX_PATTERN.test(raw.sha256)) fail('INVALID_FILE_SHA256', `${path}.sha256`);",
    to: "  if (false) fail('INVALID_FILE_SHA256', `${path}.sha256`);",
    probe: requireDocumentHash
  },
  {
    label: 'page-hash',
    target: 'evidence-claim-workbench/domain/document-bundle.mjs',
    mutation: 'remove normalized page-text hash comparison',
    probeId: 'STATIC_PAGE_HASH_BINDING',
    expectedFailure: 'PAGE_HASH_GUARD_MISSING',
    existingTest: 'tests/official-evidence-document-bundle.test.mjs',
    from: "    if (page.textSha256 !== undefined && page.textSha256 !== textSha256) fail('PAGE_TEXT_SHA256_MISMATCH', `${pagePath}.textSha256`);",
    to: "    if (false) fail('PAGE_TEXT_SHA256_MISMATCH', `${pagePath}.textSha256`);",
    probe: requirePageHash
  },
  {
    label: 'quote-presence',
    target: 'evidence-claim-workbench/domain/evidence-anchor.mjs',
    mutation: 'remove direct-quote-to-page equality check',
    probeId: 'STATIC_QUOTE_PRESENCE_BINDING',
    expectedFailure: 'QUOTE_PRESENCE_GUARD_MISSING',
    existingTest: 'tests/official-evidence-anchor.test.mjs',
    from: "  if (selected !== quote) fail('PAGE_QUOTE_MISMATCH', `${path}.quote`);",
    to: "  if (false) fail('PAGE_QUOTE_MISMATCH', `${path}.quote`);",
    probe: requireQuotePresence
  },
  {
    label: 'quote-offsets',
    target: 'evidence-claim-workbench/domain/evidence-anchor.mjs',
    mutation: 'remove quote-length-to-offset binding',
    probeId: 'STATIC_QUOTE_OFFSET_BINDING',
    expectedFailure: 'QUOTE_OFFSET_GUARD_MISSING',
    existingTest: 'tests/official-evidence-anchor.test.mjs',
    from: "  if (input.endCodePoint !== input.startCodePoint + quoteLength) fail('QUOTE_OFFSET_LENGTH_MISMATCH', path);",
    to: "  if (false) fail('QUOTE_OFFSET_LENGTH_MISMATCH', path);",
    probe: requireQuoteOffsets
  },
  {
    label: 'credentialed-url',
    target: 'knowledge/claim-registry/index.mjs',
    mutation: 'allow credentials embedded in evidence URLs',
    probeId: 'STATIC_URL_CREDENTIAL_REFUSAL',
    expectedFailure: 'CREDENTIALED_URL_GUARD_MISSING',
    existingTest: 'tests/official-evidence-document-bundle.test.mjs',
    from: "  if (parsed.username || parsed.password) throw new ClaimValidationError('SOURCE_CREDENTIALS_REFUSED', path);",
    to: "  if (false) throw new ClaimValidationError('SOURCE_CREDENTIALS_REFUSED', path);",
    probe: requireCredentiallessUrl
  },
  {
    label: 'private-url',
    target: 'knowledge/claim-registry/index.mjs',
    mutation: 'stop refusing private evidence URL hosts',
    probeId: 'STATIC_PRIVATE_URL_REFUSAL',
    expectedFailure: 'PRIVATE_URL_GUARD_MISSING',
    existingTest: 'tests/official-evidence-document-bundle.test.mjs',
    from: "    throw new ClaimValidationError('PRIVATE_SOURCE_URL_REFUSED', path);",
    to: '    void path;',
    probe: requirePublicUrl
  },
  {
    label: 'imported-model-verified',
    target: 'evidence-claim-workbench/domain/candidates.mjs',
    mutation: 'permit an imported or model candidate to assert VERIFIED',
    probeId: 'STATIC_CANDIDATE_AUTHORITY_REFUSAL',
    expectedFailure: 'IMPORTED_MODEL_VERIFIED_GUARD_MISSING',
    existingTest: 'tests/official-evidence-candidate.test.mjs',
    from: '  assertNoAuthorityFields(rawCandidate);',
    to: '  void rawCandidate;',
    probe: requireCandidateAuthorityRefusal
  },
  {
    label: 'review-to-verified',
    target: 'evidence-claim-workbench/domain/review-patch.mjs',
    mutation: 'permit a human review patch to enable automatic verification',
    probeId: 'STATIC_REVIEW_VERIFICATION_BOUNDARY',
    expectedFailure: 'REVIEW_TO_VERIFIED_GUARD_MISSING',
    existingTest: 'tests/official-evidence-review-patch.test.mjs',
    from: '    || rawPatch.automaticVerification !== false',
    to: '    || false',
    probe: requireReviewCannotVerify
  },
  {
    label: 'review-to-allowed',
    target: 'evidence-claim-workbench/domain/review-patch.mjs',
    mutation: 'permit a review patch to authorize customer use',
    probeId: 'STATIC_REVIEW_CUSTOMER_USE_BOUNDARY',
    expectedFailure: 'REVIEW_TO_ALLOWED_GUARD_MISSING',
    existingTest: 'tests/official-evidence-review-patch.test.mjs',
    from: '    || rawPatch.customerUseAllowed !== false',
    to: '    || false',
    probe: requireReviewCannotAllow
  },
  {
    label: 'disabled-conflicts',
    target: 'evidence-claim-workbench/domain/relationships.mjs',
    mutation: 'make material conflicts non-blocking',
    probeId: 'STATIC_MATERIAL_CONFLICT_BLOCKING',
    expectedFailure: 'MATERIAL_CONFLICT_GUARD_MISSING',
    existingTest: 'tests/official-evidence-relationships.test.mjs',
    from: RELATIONSHIP_BLOCKING_LINE,
    to: "    blocking: type === 'EXACT_DUPLICATE_EVIDENCE' || type === 'SUPERSEDES',",
    probe: requireMaterialConflictBlocking
  },
  {
    label: 'superseded-treated-current',
    target: 'evidence-claim-workbench/domain/relationships.mjs',
    mutation: 'make superseded evidence non-blocking/current',
    probeId: 'STATIC_SUPERSESSION_BLOCKING',
    expectedFailure: 'SUPERSESSION_GUARD_MISSING',
    existingTest: 'tests/official-evidence-relationships.test.mjs',
    from: RELATIONSHIP_BLOCKING_LINE,
    to: "    blocking: type === 'EXACT_DUPLICATE_EVIDENCE' || type === 'MATERIAL_CONFLICT',",
    probe: requireSupersessionBlocking
  },
  {
    label: 'full-page-patch',
    target: 'evidence-claim-workbench/domain/review-patch.mjs',
    mutation: 'allow a full normalized page in a review patch',
    probeId: 'STATIC_BOUNDED_PATCH_QUOTE',
    expectedFailure: 'FULL_PAGE_PATCH_GUARD_MISSING',
    existingTest: 'tests/official-evidence-review-patch.test.mjs',
    from: "    if (page && anchor.selection.quote === page.text) {\n      throw new ReviewPatchValidationError('FULL_PAGE_EXCERPT_REFUSED', `$.anchors[${index}]`);\n    }",
    to: "    if (false) {\n      throw new ReviewPatchValidationError('FULL_PAGE_EXCERPT_REFUSED', `$.anchors[${index}]`);\n    }",
    probe: requireBoundedPatchQuote
  },
  {
    label: 'absolute-path-patch',
    target: 'evidence-claim-workbench/domain/review-patch.mjs',
    mutation: 'allow local absolute paths into patch output',
    probeId: 'STATIC_PATCH_PATH_PRIVACY',
    expectedFailure: 'ABSOLUTE_PATH_PATCH_GUARD_MISSING',
    existingTest: 'tests/official-evidence-review-patch.test.mjs',
    from: "    if (representations.some((representation) => ABSOLUTE_LOCAL_PATH.test(representation))) {\n      throw new ReviewPatchValidationError('LOCAL_ABSOLUTE_PATH_REFUSED', path);\n    }",
    to: "    if (false) {\n      throw new ReviewPatchValidationError('LOCAL_ABSOLUTE_PATH_REFUSED', path);\n    }",
    probe: requireNoAbsolutePatchPath
  },
  {
    label: 'reviewer-identity-patch',
    target: 'evidence-claim-workbench/domain/review-patch.mjs',
    mutation: 'permit reviewer identity in a patch',
    probeId: 'STATIC_PATCH_IDENTITY_PRIVACY',
    expectedFailure: 'REVIEWER_IDENTITY_PATCH_GUARD_MISSING',
    existingTest: 'tests/official-evidence-review-patch.test.mjs',
    from: "    || rawPatch.reviewerIdentity !== 'NOT_COLLECTED') {",
    to: '    || false) {',
    probe: requireNoReviewerIdentity
  },
  {
    label: 'html-escaping',
    target: 'evidence-claim-workbench/renderer.mjs',
    mutation: 'remove less-than escaping from server-rendered HTML',
    probeId: 'STATIC_CONTEXTUAL_HTML_ESCAPING',
    expectedFailure: 'HTML_ESCAPING_GUARD_MISSING',
    existingTest: 'tests/official-evidence-workbench-renderer.test.mjs',
    from: "    .replaceAll('<', '&lt;')\n",
    to: '',
    probe: requireHtmlEscaping
  },
  {
    label: 'external-browser-requests',
    target: 'evidence-claim-workbench/assets/app.js',
    mutation: 'replace a same-origin API call with an external browser request',
    probeId: 'STATIC_BROWSER_SAME_ORIGIN_REQUESTS',
    expectedFailure: 'EXTERNAL_BROWSER_REQUEST_GUARD_MISSING',
    existingTest: 'tests/official-evidence-workbench-server.test.mjs',
    from: "fetch('/api/catalog'",
    to: "fetch('https://external.invalid/catalog'",
    probe: requireSameOriginBrowserRequests
  },
  {
    label: 'local-storage',
    target: 'evidence-claim-workbench/assets/app.js',
    mutation: 'persist review state in browser storage',
    probeId: 'STATIC_BROWSER_MEMORY_ONLY_STATE',
    expectedFailure: 'BROWSER_PERSISTENCE_GUARD_MISSING',
    existingTest: 'tests/official-evidence-workbench-server.test.mjs',
    from: 'const state = {\n',
    to: "localStorage.setItem('oecrw-review', 'unsafe');\n\nconst state = {\n",
    probe: requireMemoryOnlyBrowserState
  },
  {
    label: 'canonical-ordering',
    target: 'knowledge/claim-registry/index.mjs',
    mutation: 'remove ASCII key ordering from canonical serialization',
    probeId: 'STATIC_CANONICAL_SERIALIZATION_ORDER',
    expectedFailure: 'CANONICAL_ORDERING_GUARD_MISSING',
    existingTest: 'tests/evidence-claim-registry.test.js',
    from: "      Object.keys(value)\n        .sort(compareAscii)\n        .map((key) => [key, canonicalize(value[key])])",
    to: "      Object.keys(value)\n        .map((key) => [key, canonicalize(value[key])])",
    probe: requireCanonicalOrdering
  },
  {
    label: 'candidate-id-content-reuse',
    target: 'evidence-claim-workbench/domain/candidates.mjs',
    mutation: 'accept one candidate ID with different content',
    probeId: 'STATIC_CANDIDATE_ID_CONTENT_BINDING',
    expectedFailure: 'CANDIDATE_ID_CONTENT_REUSE_GUARD_MISSING',
    existingTest: 'tests/official-evidence-candidate.test.mjs',
    from: '    if (rawCandidate.candidateId !== candidateId) throw new CandidateValidationError(\'CANDIDATE_ID_MISMATCH\', \'$.candidateId\');',
    to: '    if (false) throw new CandidateValidationError(\'CANDIDATE_ID_MISMATCH\', \'$.candidateId\');',
    probe: requireCandidateIdContentBinding
  },
  {
    label: 'third-party-pdf-staged-by-default',
    target: 'evidence-claim-workbench/domain/intake.mjs',
    mutation: 'stage a third-party PDF despite no parser/use approval',
    probeId: 'STATIC_PDF_DEFAULT_REFUSAL',
    expectedFailure: 'PDF_DEFAULT_STAGING_GUARD_MISSING',
    existingTest: 'tests/official-evidence-intake.test.mjs',
    from: "    if (entry.mediaType === 'application/pdf' || extension === '.pdf' || entry.documentType === 'PDF') fail('RAW_PDF_PARSER_UNAVAILABLE', `${entryPath}.mediaType`);",
    to: "    if (false) fail('RAW_PDF_PARSER_UNAVAILABLE', `${entryPath}.mediaType`);",
    probe: requirePdfRefusal
  }
]);

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function applySingleMutation(source, mutationCase) {
  const firstIndex = source.indexOf(mutationCase.from);
  if (firstIndex < 0) {
    throw new SensitivityHarnessError('MUTATION_TARGET_NOT_FOUND', mutationCase.label);
  }
  if (source.indexOf(mutationCase.from, firstIndex + mutationCase.from.length) >= 0) {
    throw new SensitivityHarnessError('MUTATION_TARGET_AMBIGUOUS', mutationCase.label);
  }
  return `${source.slice(0, firstIndex)}${mutationCase.to}${source.slice(firstIndex + mutationCase.from.length)}`;
}

function isolatedTestEnvironment() {
  return { NO_COLOR: '1', TZ: 'UTC', LANG: 'C.UTF-8' };
}

async function pathExists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function assertRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new SensitivityHarnessError('ABSOLUTE_REPOSITORY_ROOT_REQUIRED');
  }
  return path.resolve(repositoryRoot);
}

async function executeMutationCase({ repositoryRoot, temporaryRoot, mutationCase, index }) {
  const sourcePath = path.join(repositoryRoot, mutationCase.target);
  const source = await readFile(sourcePath, 'utf8');
  try {
    mutationCase.probe(source);
  } catch (error) {
    throw new SensitivityHarnessError('BASELINE_GUARD_PROBE_FAILED', `${mutationCase.label}:${error?.code || error?.message}`);
  }

  const caseRoot = path.join(temporaryRoot, `${String(index + 1).padStart(2, '0')}-${mutationCase.label}`);
  await mkdir(path.join(caseRoot, 'tests'), { recursive: true });
  await cp(path.join(repositoryRoot, 'evidence-claim-workbench'), path.join(caseRoot, 'evidence-claim-workbench'), { recursive: true });
  await cp(path.join(repositoryRoot, 'knowledge'), path.join(caseRoot, 'knowledge'), { recursive: true });
  await cp(path.join(repositoryRoot, mutationCase.existingTest), path.join(caseRoot, mutationCase.existingTest));
  const copiedPath = path.join(caseRoot, mutationCase.target);
  const mutated = applySingleMutation(await readFile(copiedPath, 'utf8'), mutationCase);
  await writeFile(copiedPath, mutated, { encoding: 'utf8', flag: 'w' });
  if (await readFile(sourcePath, 'utf8') !== source) {
    throw new SensitivityHarnessError('REAL_SOURCE_CHANGED_DURING_MUTATION', mutationCase.target);
  }

  let detectedFailure = null;
  let behavioralTestExitCode = null;
  try {
    mutationCase.probe(await readFile(copiedPath, 'utf8'));
  } catch (error) {
    detectedFailure = error?.code || error?.message || 'UNKNOWN_PROBE_FAILURE';
  }
  const behavioralTest = spawnSync(process.execPath, ['--test', mutationCase.existingTest], {
    cwd: caseRoot,
    encoding: 'utf8',
    env: isolatedTestEnvironment(),
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024
  });
  behavioralTestExitCode = behavioralTest.status;
  await rm(caseRoot, { recursive: true, force: true });
  const temporaryCopyRemoved = !(await pathExists(caseRoot));
  if (detectedFailure !== mutationCase.expectedFailure) {
    throw new SensitivityHarnessError(
      'MUTATION_NOT_DETECTED_AS_INTENDED',
      `${mutationCase.label}:${detectedFailure || 'NO_FAILURE'}:${mutationCase.expectedFailure}`
    );
  }
  if (!temporaryCopyRemoved) {
    throw new SensitivityHarnessError('TEMPORARY_CASE_CLEANUP_FAILED', mutationCase.label);
  }
  if (behavioralTest.error || behavioralTest.signal || behavioralTestExitCode === null) {
    throw new SensitivityHarnessError(
      'MUTATION_BEHAVIORAL_TEST_EXECUTION_FAILED',
      `${mutationCase.label}:${behavioralTest.error?.code || behavioralTest.signal || 'NO_EXIT_CODE'}`
    );
  }
  if (behavioralTestExitCode === 0) {
    throw new SensitivityHarnessError('MUTATION_BEHAVIORAL_TEST_DID_NOT_FAIL', mutationCase.label);
  }
  return {
    ordinal: index + 1,
    label: mutationCase.label,
    target: mutationCase.target,
    mutation: mutationCase.mutation,
    probeKind: 'STATIC_SOURCE_INVARIANT_AND_BEHAVIORAL_TEST',
    probeId: mutationCase.probeId,
    existingTest: mutationCase.existingTest,
    intendedFailure: mutationCase.expectedFailure,
    baselineGuardPassed: true,
    detected: true,
    behavioralTestFailed: true,
    behavioralTestExitCode,
    temporaryCopyRemoved: true
  };
}

export async function runSensitivityHarness({
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  temporaryParent = tmpdir()
} = {}) {
  const resolvedRepositoryRoot = await realpath(assertRepositoryRoot(repositoryRoot));
  if (typeof temporaryParent !== 'string' || !path.isAbsolute(temporaryParent)) {
    throw new SensitivityHarnessError('ABSOLUTE_TEMPORARY_PARENT_REQUIRED');
  }
  const resolvedTemporaryParent = await realpath(temporaryParent);
  const temporaryParentRelativeToRepository = path.relative(resolvedRepositoryRoot, resolvedTemporaryParent);
  if (temporaryParentRelativeToRepository === ''
    || (!temporaryParentRelativeToRepository.startsWith(`..${path.sep}`)
      && temporaryParentRelativeToRepository !== '..'
      && !path.isAbsolute(temporaryParentRelativeToRepository))) {
    throw new SensitivityHarnessError('TEMPORARY_PARENT_INSIDE_REPOSITORY_REFUSED');
  }
  const labels = MUTATION_CASES.map(({ label }) => label);
  if (JSON.stringify(labels) !== JSON.stringify(REQUIRED_SENSITIVITY_LABELS)) {
    throw new SensitivityHarnessError('SENSITIVITY_CASE_SET_MISMATCH');
  }
  if (new Set(labels).size !== labels.length) throw new SensitivityHarnessError('DUPLICATE_SENSITIVITY_LABEL');

  const targetFiles = [...new Set(MUTATION_CASES.map(({ target }) => target))].sort();
  const originalHashes = new Map();
  for (const target of targetFiles) {
    originalHashes.set(target, sha256Text(await readFile(path.join(resolvedRepositoryRoot, target), 'utf8')));
  }

  const temporaryRoot = await mkdtemp(path.join(resolvedTemporaryParent, 'oecrw-sensitivity-'));
  const results = [];
  let cleanupComplete = false;
  try {
    for (const [index, mutationCase] of MUTATION_CASES.entries()) {
      results.push(await executeMutationCase({
        repositoryRoot: resolvedRepositoryRoot,
        temporaryRoot,
        mutationCase,
        index
      }));
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
    cleanupComplete = !(await pathExists(temporaryRoot));
  }
  if (!cleanupComplete) throw new SensitivityHarnessError('TEMPORARY_ROOT_CLEANUP_FAILED');

  const sourceChanges = [];
  for (const target of targetFiles) {
    const after = sha256Text(await readFile(path.join(resolvedRepositoryRoot, target), 'utf8'));
    if (after !== originalHashes.get(target)) sourceChanges.push(target);
  }
  if (sourceChanges.length) {
    throw new SensitivityHarnessError('REAL_SOURCE_INTEGRITY_FAILED', sourceChanges.join(','));
  }

  const detected = results.filter((result) => result.detected).length;
  return {
    schemaVersion: 'official-evidence-claim-workbench-sensitivity-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    scope: {
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies: ['medium_voltage_switchgear', 'transformer'],
      languages: ['ko', 'en']
    },
    execution: {
      mode: 'ISOLATED_TEMPORARY_COPY_STATIC_AND_BEHAVIORAL_MUTATION',
      realSourceWrites: 0,
      temporaryMutationCopies: results.length,
      behavioralTestProcesses: results.length,
      productionSystemsTouched: false,
      stagingSystemsTouched: false,
      externalNetworkCalls: 0,
      loopbackTestTrafficOnly: true,
      browserRequestsExecuted: 0,
      browserPersistenceWrites: 0
    },
    metrics: {
      required: REQUIRED_SENSITIVITY_LABELS.length,
      executed: results.length,
      detected,
      escaped: results.length - detected,
      baselineProbeFailures: 0,
      targetFileCount: targetFiles.length
    },
    sourceIntegrity: {
      originalsUnchanged: sourceChanges.length === 0,
      changedFiles: sourceChanges
    },
    cleanup: {
      temporaryCaseCopiesRemoved: results.every((result) => result.temporaryCopyRemoved),
      temporaryRootRemoved: cleanupComplete
    },
    cases: results
  };
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectExecution()) {
  runSensitivityHarness()
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    })
    .catch((error) => {
      const code = error?.code || 'SENSITIVITY_HARNESS_FAILED';
      process.stderr.write(`${code}: ${error?.message || String(error)}\n`);
      process.exitCode = 1;
    });
}
