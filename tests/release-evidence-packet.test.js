const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createEvidencePacket,
  renderMarkdown,
  renderYaml
} = require('../scripts/generate-release-evidence-packet');

test('createEvidencePacket builds a local-only packet with explicit evidence boundaries', () => {
  const packet = createEvidencePacket({
    title: 'PR 99 release evidence',
    repo: {
      name: 'dooosp/b2b-lead-agent',
      branch: 'codex/release-evidence-toolkit-v1',
      headSha: '12d44374a24a9958de179fae5f9311621606ad24'
    },
    github: {
      pullRequestUrl: 'https://github.com/dooosp/b2b-lead-agent/pull/99',
      issueUrl: 'https://github.com/dooosp/b2b-lead-agent/issues/34'
    },
    validations: [
      {
        command: 'npm test',
        source: 'local',
        status: 'pass',
        summary: '117 tests passed with token sk-secret and buyer@example.com removed'
      }
    ],
    manualProofPackets: [
      {
        title: 'Manual no-op closeout',
        source: 'manually supplied',
        summary: 'No deploy, no D1, no endpoint call; Cookie: sid=secret'
      }
    ]
  });

  assert.equal(packet.mode, 'RELEASE_TOOLING');
  assert.equal(packet.status, 'SHIP');
  assert.equal(packet.boundaries.toolAccessedProduction, false);
  assert.equal(packet.boundaries.productionObservationClaimed, false);
  assert.equal(packet.boundaries.ciIsProductionEvidence, false);
  assert.equal(packet.boundaries.docsConfigOrSourceAreProductionEvidence, false);
  assert.equal(packet.boundaries.screenshotsAloneSufficient, false);
  assert.equal(packet.validations[0].summary, '117 tests passed with token [REDACTED:TOKEN] and [REDACTED:PII] removed');
  assert.match(packet.manualProofPackets[0].summary, /\[REDACTED:COOKIE\]/);
});

test('rendered packet redacts sensitive content and states invalid production evidence categories', () => {
  const packet = createEvidencePacket({
    title: 'Boundary packet',
    validations: [
      {
        command: 'npm run check:naming',
        source: 'local',
        status: 'pass',
        summary: 'D1_DATABASE_ID=11111111-2222-4333-8444-555555555555'
      }
    ],
    claims: {
      productionObservationClaimed: true
    }
  });

  const markdown = renderMarkdown(packet);
  const yaml = renderYaml(packet);

  assert.equal(packet.status, 'HOLD');
  assert.equal(packet.claims.githubMetadataSummarizedOnly, false);
  assert.match(markdown, /CI is not production evidence/);
  assert.match(markdown, /Docs, config, and source code are not production evidence/);
  assert.match(markdown, /Screenshots alone are insufficient/);
  assert.match(markdown, /\[REDACTED:DATABASE_ID\]/);
  assert.match(markdown, /production observation claim was supplied to a local-only tool/i);
  assert.match(yaml, /productionObservationClaimed: false/);
  assert.doesNotMatch(markdown + yaml, /11111111-2222-4333-8444-555555555555/);
});
