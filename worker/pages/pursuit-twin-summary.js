const ALLOWED_BOUNDARIES = new Set([
  'LOCAL_TEST_SYNTHETIC_ONLY',
  'NOT_PRODUCTION_EVIDENCE',
]);

const PURSUIT_TWIN_SUMMARY_BODY = {
  schemaVersion: 'pursuit-twin-summary/v0',
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  synthetic: true,
  productionReady: false,
  issue165ProductionProof: 'HOLD',
  finalHumanPursuitDecision: 'NOT_MADE',
  opportunity: {
    id: 'synthetic-dc-kr-001',
    label: '합성 KR 데이터센터 전력 인프라 기회',
  },
  specDelta: {
    state: 'CHANGED',
    previous: {
      revisionId: 'SPEC-R1',
      stage: 'BASIC_DESIGN',
      requirement: '수전 전압 22.9 kV',
      fit: 'FIT',
      specificationWindow: 'OPEN',
    },
    current: {
      revisionId: 'SPEC-R2',
      stage: 'TENDER',
      requirement: '수전 전압 확인 필요',
      fit: 'INSUFFICIENT_EVIDENCE',
      specificationWindow: 'CLOSING',
    },
    priorDecisionReview: {
      previousDecision: 'PURSUE',
      status: 'REVIEW_REQUIRED',
      carryForwardAllowed: false,
      replacementDecision: 'NOT_MADE',
    },
  },
  minimumEvidenceToAdvance: {
    outcome: 'REEVALUATION_ONLY',
    notGuaranteeOfFit: true,
    items: [
      {
        order: 1,
        evidence: '최신 단선결선도(SLD)의 수전 전압과 단락전류',
        responsibleSide: 'PROJECT',
        resolvesBlocker: '프로젝트 수전 조건의 UNKNOWN 상태',
      },
    ],
  },
};

export const PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256 = '9bddb4b8ae4a3fc53cd0ab634d11e94ecea82b324bd2cd35b70966c85d636d21';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function canonicalizePursuitTwinSummary(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Pursuit Twin summary numbers must be finite');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizePursuitTwinSummary).join(',')}]`;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('Pursuit Twin summary must contain JSON object values only');
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizePursuitTwinSummary(value[key])}`).join(',')}}`;
}

const EXPECTED_CANONICAL_BODY = canonicalizePursuitTwinSummary(PURSUIT_TWIN_SUMMARY_BODY);

export const PURSUIT_TWIN_SUMMARY_SAMPLE = deepFreeze({
  ...PURSUIT_TWIN_SUMMARY_BODY,
  canonicalSha256: PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256,
});

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

export function validatePursuitTwinSummary(viewModel) {
  assertObject(viewModel, 'Pursuit Twin summary');
  if (!ALLOWED_BOUNDARIES.has(viewModel.boundary)) {
    throw new Error('Pursuit Twin summary boundary must be local/test-only');
  }
  if (viewModel.synthetic !== true) {
    throw new Error('Pursuit Twin summary must be explicitly synthetic');
  }
  if (viewModel.productionReady !== false) {
    throw new Error('Pursuit Twin summary cannot claim production readiness');
  }
  if (viewModel.finalHumanPursuitDecision !== 'NOT_MADE') {
    throw new Error('Pursuit Twin summary cannot carry a final human pursuit decision');
  }
  if (viewModel.issue165ProductionProof !== 'HOLD') {
    throw new Error('Pursuit Twin summary must preserve Issue #165 HOLD');
  }

  const review = viewModel.specDelta?.priorDecisionReview;
  if (review?.status !== 'REVIEW_REQUIRED' || review?.carryForwardAllowed !== false) {
    throw new Error('Changed specification input must require review and refuse decision carry-forward');
  }
  if (review?.replacementDecision !== 'NOT_MADE') {
    throw new Error('Pursuit Twin summary cannot replace the prior human decision');
  }

  const minimumEvidence = viewModel.minimumEvidenceToAdvance;
  if (minimumEvidence?.outcome !== 'REEVALUATION_ONLY' || minimumEvidence?.notGuaranteeOfFit !== true) {
    throw new Error('Minimum Evidence must permit reevaluation only and never guarantee FIT');
  }
  if (!Array.isArray(minimumEvidence.items) || minimumEvidence.items.length === 0) {
    throw new Error('Minimum Evidence must contain at least one ordered evidence item');
  }
  minimumEvidence.items.forEach((item, index) => {
    if (item?.order !== index + 1) {
      throw new Error('Minimum Evidence items must use a contiguous review order');
    }
  });

  if (viewModel.canonicalSha256 !== PURSUIT_TWIN_SUMMARY_CANONICAL_SHA256) {
    throw new Error('Pursuit Twin summary canonical hash is not the checked-in hash');
  }
  const { canonicalSha256: _canonicalSha256, ...body } = viewModel;
  if (canonicalizePursuitTwinSummary(body) !== EXPECTED_CANONICAL_BODY) {
    throw new Error('Pursuit Twin summary does not match the hash-bound checked-in view model');
  }
  return viewModel;
}

export function escapePursuitTwinHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRevision(label, revision) {
  return `
          <article class="pursuit-twin-revision">
            <span>${escapePursuitTwinHtml(label)}</span>
            <strong>${escapePursuitTwinHtml(revision.revisionId)} · ${escapePursuitTwinHtml(revision.stage)}</strong>
            <dl>
              <div><dt>Requirement</dt><dd>${escapePursuitTwinHtml(revision.requirement)}</dd></div>
              <div><dt>FIT</dt><dd>${escapePursuitTwinHtml(revision.fit)}</dd></div>
              <div><dt>Window</dt><dd>${escapePursuitTwinHtml(revision.specificationWindow)}</dd></div>
            </dl>
          </article>`;
}

export function renderPursuitTwinSummary(viewModel = PURSUIT_TWIN_SUMMARY_SAMPLE) {
  const model = validatePursuitTwinSummary(viewModel);
  const delta = model.specDelta;
  const decision = delta.priorDecisionReview;
  const evidenceItems = model.minimumEvidenceToAdvance.items
    .map((item) => `
              <li>
                <span class="pursuit-twin-evidence-order">${escapePursuitTwinHtml(item.order)}</span>
                <div>
                  <strong>${escapePursuitTwinHtml(item.evidence)}</strong>
                  <span>담당 side: ${escapePursuitTwinHtml(item.responsibleSide)}</span>
                  <span>해소 blocker: ${escapePursuitTwinHtml(item.resolvesBlocker)}</span>
                </div>
              </li>`)
    .join('');

  return `
        <section class="pursuit-twin-summary" data-testid="pursuit-twin-v0-summary" aria-labelledby="pursuit-twin-v0-heading">
          <div class="pursuit-twin-summary-head">
            <div>
              <span class="pursuit-twin-label">IMPLEMENTED · LOCAL/TEST SYNTHETIC CONTRACT</span>
              <h3 id="pursuit-twin-v0-heading">Pursuit Twin v0 — Spec Delta + Minimum Evidence to Advance</h3>
              <p>${escapePursuitTwinHtml(model.opportunity.label)}</p>
            </div>
            <span class="pursuit-twin-state">${escapePursuitTwinHtml(delta.state)}</span>
          </div>

          <div class="pursuit-twin-delta" data-testid="spec-delta-summary">
            ${renderRevision('PREVIOUS', delta.previous)}
            <span class="pursuit-twin-arrow" aria-hidden="true">→</span>
            ${renderRevision('CURRENT', delta.current)}
          </div>

          <div class="pursuit-twin-review-state">
            <strong>Prior decision: ${escapePursuitTwinHtml(decision.previousDecision)} → ${escapePursuitTwinHtml(decision.status)}</strong>
            <span>carry-forward: ${escapePursuitTwinHtml(String(decision.carryForwardAllowed))} · replacement decision: ${escapePursuitTwinHtml(decision.replacementDecision)}</span>
          </div>

          <div class="pursuit-twin-evidence" data-testid="minimum-evidence-summary">
            <h4>Minimum Evidence to Advance</h4>
            <ol>${evidenceItems}</ol>
            <p>이 최소 증거 집합은 기술 적합성 재평가를 가능하게 할 뿐, FIT를 보장하지 않습니다.</p>
          </div>

          <div class="pursuit-twin-contract-boundary" data-testid="pursuit-twin-boundary" data-boundary="${escapePursuitTwinHtml(model.boundary)}">
            <strong>SYNTHETIC · ${escapePursuitTwinHtml(model.boundary)}</strong>
            <span>Issue #165 production proof: ${escapePursuitTwinHtml(model.issue165ProductionProof)} · productionReady: ${escapePursuitTwinHtml(String(model.productionReady))} · final decision: ${escapePursuitTwinHtml(model.finalHumanPursuitDecision)}</span>
          </div>
        </section>`;
}
