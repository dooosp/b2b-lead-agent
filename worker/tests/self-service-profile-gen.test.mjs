import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicSolutionProfile, generateHeuristicProfile } from '../self-service/profile-gen.js';

test('buildDeterministicSolutionProfile uses seller solution catalog for manufacturing', () => {
  const profile = buildDeterministicSolutionProfile('LG전자', '제조');

  assert.deepEqual(profile.products.automation, ['스마트팩토리 운영 플랫폼', '설비 예지보전 솔루션']);
  assert.equal(profile.categoryConfig.automation.product, '스마트팩토리 운영 플랫폼');
  assert.match(profile.categoryConfig.energy.pitch, /\{company\}.*\{product\}/);
});

test('generateHeuristicProfile falls back to deterministic seller solutions', () => {
  const profile = generateHeuristicProfile('현대건설', '건설');

  assert.equal(profile.categoryConfig.building.product, '빌딩 통합관제 플랫폼');
  assert.equal(profile.products.project[0], '프로젝트 운영 데이터 허브');
});
