import {
  GOLDEN_AUDIT_BOUNDARY,
  GOLDEN_AUDIT_SCHEMA_VERSION,
} from '../../knowledge/golden-dataset/index.mjs';
import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';

export function validateGoldenDatasetAuditReport(report) {
  assertSafeArtifact(report, '$.goldenDatasetAuditReport');
  const requiredCountFields = [
    'projectCandidateCount',
    'publicSourceDocumentCandidateCount',
    'capabilityClaimCandidateCount',
    'requirementCapabilityPairCandidateCount',
    'productFamilyCount',
    'candidateStageCount',
    'revisionLinkCandidateCount',
    'humanConfirmedProjectCount',
    'humanConfirmedCapabilityClaimCount',
    'humanConfirmedPairCount',
    'humanConfirmedRevisionLinkCount',
    'humanConfirmedStageCount',
    'pendingProjectCount',
    'pendingCapabilityClaimCount',
    'pendingPairCount',
    'pendingRevisionLinkCount',
    'provisionalLabelLeakage',
  ];
  const {
    canonicalSha256,
    ...reportWithoutHash
  } = report || {};
  if (
    !['PURSUIT_GOLDEN_DATASET_AUDIT_PASS', 'PURSUIT_GOLDEN_DATASET_AUDIT_FAIL']
      .includes(report?.documentStatus)
    || report?.schemaVersion !== GOLDEN_AUDIT_SCHEMA_VERSION
    || report?.boundary !== GOLDEN_AUDIT_BOUNDARY
    || report?.productionReady !== false
    || typeof report?.goldenReady !== 'boolean'
    || !['CANDIDATE_INTAKE', 'PARTIALLY_ADJUDICATED', 'HUMAN_CONFIRMED', 'INVALID']
      .includes(report?.datasetState)
    || !requiredCountFields.every((field) => (
      Number.isInteger(report?.summary?.[field]) && report.summary[field] >= 0
    ))
    || !Array.isArray(report?.summary?.thresholdGaps)
    || !Array.isArray(report?.violations)
    || typeof canonicalSha256 !== 'string'
  ) {
    throw new ClaimValidationError('GOLDEN_DATASET_AUDIT_REPORT_INVALID', '$.goldenDatasetAuditReport');
  }
  if (report.goldenReady && report.datasetState !== 'HUMAN_CONFIRMED') {
    throw new ClaimValidationError(
      'GOLDEN_DATASET_READY_STATE_MISMATCH',
      '$.goldenDatasetAuditReport',
    );
  }
  if (
    (report.documentStatus === 'PURSUIT_GOLDEN_DATASET_AUDIT_PASS')
      !== (report.violations.length === 0)
    || (report.datasetState === 'INVALID') !== (report.violations.length > 0)
    || (report.goldenReady && (
      report.summary.thresholdGaps.length > 0
      || report.summary.provisionalLabelLeakage !== 0
      || report.summary.pendingProjectCount !== 0
      || report.summary.pendingCapabilityClaimCount !== 0
      || report.summary.pendingPairCount !== 0
      || report.summary.pendingRevisionLinkCount !== 0
    ))
  ) {
    throw new ClaimValidationError(
      'GOLDEN_DATASET_AUDIT_STATE_MISMATCH',
      '$.goldenDatasetAuditReport',
    );
  }
  if (sha256(canonicalStringify(reportWithoutHash)) !== canonicalSha256) {
    throw new ClaimValidationError(
      'GOLDEN_DATASET_AUDIT_HASH_MISMATCH',
      '$.goldenDatasetAuditReport.canonicalSha256',
    );
  }
  const datasetHash = report.datasetCanonicalSha256;
  if (
    (report.documentStatus === 'PURSUIT_GOLDEN_DATASET_AUDIT_PASS'
      && (typeof datasetHash !== 'string' || !/^[a-f0-9]{64}$/.test(datasetHash)))
    || (report.documentStatus === 'PURSUIT_GOLDEN_DATASET_AUDIT_FAIL'
      && datasetHash !== null)
  ) {
    throw new ClaimValidationError(
      'GOLDEN_DATASET_CANONICAL_HASH_INVALID',
      '$.goldenDatasetAuditReport.datasetCanonicalSha256',
    );
  }
  return report;
}
