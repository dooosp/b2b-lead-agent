import { assertSafeArtifact, ClaimValidationError } from '../../knowledge/claim-registry/index.mjs';

export function validateClaimAuditReport(report) {
  assertSafeArtifact(report, '$.claimAuditReport');
  if (
    !['EVIDENCE_CLAIM_AUDIT_PASS', 'EVIDENCE_CLAIM_AUDIT_FAIL'].includes(report?.documentStatus)
    || report?.schemaVersion !== 'evidence-claim-audit-v1'
    || report?.productionReady !== false
    || report?.issue165Status !== 'HOLD'
    || !Number.isInteger(report?.summary?.totalClaimCandidates)
    || !Number.isInteger(report?.summary?.violations)
  ) throw new ClaimValidationError('CLAIM_AUDIT_REPORT_INVALID', '$.claimAuditReport');
  return report;
}

export function validateSpecFitEvaluationReport(report) {
  assertSafeArtifact(report, '$.specFitEvaluationReport');
  if (
    !['SPECIFICATION_FIT_EVALUATION_PASS', 'SPECIFICATION_FIT_EVALUATION_FAIL'].includes(report?.documentStatus)
    || report?.schemaVersion !== 'specification-fit-evaluation-report-v0'
    || report?.productionReady !== false
    || report?.issue165Status !== 'HOLD'
    || !Number.isInteger(report?.summary?.scenarioCount)
    || !Number.isInteger(report?.summary?.passed)
    || !Number.isInteger(report?.summary?.failed)
    || report.summary.passed + report.summary.failed !== report.summary.scenarioCount
  ) throw new ClaimValidationError('SPEC_FIT_EVALUATION_REPORT_INVALID', '$.specFitEvaluationReport');
  return report;
}
