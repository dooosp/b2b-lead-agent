const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorkbenchDomain } = require('./helpers/pursuit-workbench');

function clone(value) {
  return structuredClone(value);
}

function expectCode(code) {
  return (error) => error?.code === code;
}

function rawTimeline(timeline, events) {
  return { ...clone(timeline), events };
}

function derivedEvent(base, overrides = {}) {
  return {
    schemaVersion: 'project-signal-event-v0',
    eventClass: 'DERIVED',
    eventType: 'DOSSIER_RECOMPUTED',
    opportunityId: base.opportunityId,
    occurredAt: base.asOf,
    observedAt: null,
    timeBasis: 'REGISTRY_AS_OF',
    title: 'Derived event',
    summary: 'Derived conclusion for deterministic timeline testing.',
    claimIds: [],
    evidenceIds: [],
    requirementIds: [],
    productFamilyIds: [],
    sourceState: null,
    evidenceUse: null,
    reasonCodes: [],
    state: null,
    ...overrides
  };
}

test('curated timelines distinguish evidence and derived events with complete traceability', async () => {
  const { scenarios } = await loadWorkbenchDomain();
  const catalog = await scenarios.listPursuitWorkbenchScenarios();
  for (const item of catalog) {
    const domain = await loadWorkbenchDomain(item.id);
    const vm = await scenarios.materializePursuitWorkbenchScenario(item.id);
    assert.ok(vm.timeline.length >= 1, item.id);
    assert.ok(vm.timeline.every((event) => event.opportunityId === vm.project.opportunityId));
    assert.ok(vm.timeline.filter((event) => event.eventClass === 'EVIDENCE').every((event) => event.claimIds.length > 0 && event.evidenceIds.length > 0));
    assert.ok(vm.timeline.filter((event) => event.eventClass === 'DERIVED').every((event) => event.observedAt === null && event.evidenceIds.length === 0));
    assert.doesNotThrow(() => domain.timeline.assertValidatedProjectSignalTimeline(domain.timelineResult.timeline));
  }
});

test('timeline ordering and hashes are stable for equal timestamps and reversed input', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain('multi_family_datacenter_opportunity');
  const reversed = timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [...clone(timelineResult.timeline.events)].reverse()), {
    registry: materialized.registry,
    opportunity: materialized.opportunity,
    verticalPack: inputs.verticalPack
  });
  assert.deepEqual(reversed, timelineResult.timeline);
  const sameTimestamp = reversed.events.filter((event) => event.occurredAt === reversed.asOf);
  assert.deepEqual(sameTimestamp, [...sameTimestamp].sort((left, right) => {
    const typeOrder = ['SPECIFICATION_FIT_EVALUATED', 'SPECIFICATION_WINDOW_EVALUATED', 'DOSSIER_RECOMPUTED'];
    return typeOrder.indexOf(left.eventType) - typeOrder.indexOf(right.eventType) || left.eventId.localeCompare(right.eventId);
  }));
  assert.equal((await import('../knowledge/claim-registry/index.mjs')).sha256(reversed), timelineResult.timelineSha256);
});

test('duplicate event content and differing content with a forged id fail closed', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain();
  const event = clone(timelineResult.timeline.events[0]);
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [event, clone(event)]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_EVENT_ID_DUPLICATE'));
  const forged = clone(event);
  forged.summary = 'Different content using a prior event identifier.';
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [forged]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_EVENT_ID_MISMATCH'));
});

test('timeline rejects missing claims, foreign opportunities, unknown requirements, and unknown families', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain();
  const evidence = clone(timelineResult.timeline.events.find((event) => event.eventClass === 'EVIDENCE'));
  const cases = [
    [{ ...evidence, eventId: '', claimIds: ['clm_deadbeef'] }, 'TIMELINE_CLAIM_UNKNOWN'],
    [{ ...evidence, eventId: '', opportunityId: 'foreign_opportunity' }, 'TIMELINE_FOREIGN_OPPORTUNITY'],
    [{ ...evidence, eventId: '', requirementIds: ['req_unknown'] }, 'TIMELINE_REQUIREMENT_UNKNOWN'],
    [{ ...evidence, eventId: '', productFamilyIds: ['unknown_family'] }, 'TIMELINE_PRODUCT_FAMILY_UNKNOWN']
  ];
  for (const [event, code] of cases) {
    assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [event]), {
      registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
    }), expectCode(code));
  }
});

test('evidence events require claims and derived events cannot masquerade as evidence', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain();
  const evidence = clone(timelineResult.timeline.events.find((event) => event.eventClass === 'EVIDENCE'));
  evidence.eventId = '';
  evidence.claimIds = [];
  evidence.evidenceIds = [];
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [evidence]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_EVIDENCE_TRACE_REQUIRED'));
  const derived = clone(timelineResult.timeline.events.find((event) => event.eventClass === 'DERIVED'));
  derived.eventId = '';
  derived.eventClass = 'EVIDENCE';
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [derived]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_EVENT_CLASS_MISMATCH'));
});

test('conflicts keep both claim ids visible and select neither statement', async () => {
  const { scenarios } = await loadWorkbenchDomain('conflicting_capability_claims');
  const vm = await scenarios.materializePursuitWorkbenchScenario('conflicting_capability_claims');
  const conflict = vm.timeline.find((event) => event.eventType === 'CLAIM_CONFLICT_RECOGNIZED');
  assert.equal(conflict.claimIds.length, 2);
  assert.ok(conflict.requirementIds.length > 0);
  assert.ok(conflict.productFamilyIds.length > 0);
  assert.equal(conflict.reasonCodes.includes('CLAIM_CONFLICT'), true);
  const blockedEvents = vm.timeline.filter((event) => event.eventClass === 'EVIDENCE' && event.sourceState === 'CONFLICTED');
  assert.equal(blockedEvents.length, 2);
  assert.ok(blockedEvents.every((event) => event.evidenceUse === 'BLOCKED' && /intentionally withheld/.test(event.summary)));
});

test('retracted evidence remains blocked and emits a derived recognition event', async () => {
  const { inputs, materialized, timeline } = await loadWorkbenchDomain();
  const opportunity = clone(materialized.opportunity);
  opportunity.requirements[0].evidenceClaimRefs = ['reference_retracted'];
  const domain = await import('../verticals/datacenter/index.mjs');
  const evaluation = domain.evaluateSpecificationFit(opportunity, materialized.registry, inputs.verticalPack);
  const built = timeline.buildProjectSignalTimeline(opportunity, evaluation, materialized.registry, inputs.verticalPack);
  const retraction = built.timeline.events.find((event) => event.eventType === 'CLAIM_RETRACTION_RECOGNIZED');
  const retractedStatement = materialized.registry.byKey.get('reference_retracted').statement;
  assert.ok(retraction);
  assert.ok(retraction.requirementIds.length > 0);
  assert.ok(retraction.productFamilyIds.length > 0);
  assert.ok(built.timeline.events.filter((event) => event.sourceState === 'RETRACTED').every((event) => event.evidenceUse === 'BLOCKED'));
  assert.equal(JSON.stringify(built.timeline).includes(retractedStatement), false);
});

test('stage progression is allowed while regression and future events are refused', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain();
  const progression = derivedEvent(timelineResult.timeline, {
    eventType: 'PROJECT_STAGE_CHANGED',
    title: 'Project stage changed',
    state: { dimension: 'PROJECT_STAGE', before: 'BASIC_DESIGN', after: 'TENDER' }
  });
  assert.equal(timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [progression]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }).events[0].state.after, 'TENDER');
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [{ ...progression, state: { dimension: 'PROJECT_STAGE', before: 'TENDER', after: 'BASIC_DESIGN' } }]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_STAGE_REGRESSION'));
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, [{ ...progression, occurredAt: '2027-01-01T00:00:00.000Z' }]), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_FUTURE_EVENT'));
});

test('timeline event count and aggregate byte limits are enforced', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain();
  const tooMany = Array.from({ length: 101 }, (_, index) => derivedEvent(timelineResult.timeline, { title: `Event ${index}` }));
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, tooMany), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_CONTRACT_INVALID'));
  const large = Array.from({ length: 100 }, (_, index) => derivedEvent(timelineResult.timeline, {
    title: `Large event ${index}`,
    reasonCodes: Array.from({ length: 40 }, (_unused, reasonIndex) => `REASON_${index}_${reasonIndex}_${'X'.repeat(90)}`)
  }));
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(rawTimeline(timelineResult.timeline, large), {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  }), expectCode('TIMELINE_TOO_LARGE'));
});
