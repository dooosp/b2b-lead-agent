import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEscoTermScenarios,
  calculateCpaEstimate,
  validateCpaOutput
} from '../lib/cpa-estimator.js';

test('calculateCpaEstimate returns stable contract for valid input', () => {
  const result = calculateCpaEstimate({
    area: 30000,
    floors: 25,
    buildingType: 'office',
    region: 'seoul',
    monthlyEnergyCost: 7500
  });

  assert.equal(validateCpaOutput(result), true);
  assert.equal(result.options.length, 3);
  assert.equal(result.options[1].label, 'BEMS 통합');
  assert.equal(result.input.area, 30000);
});

test('buildEscoTermScenarios is deterministic for the same option', () => {
  const result = calculateCpaEstimate({
    area: 30000,
    floors: 25,
    buildingType: 'office',
    region: 'seoul',
    monthlyEnergyCost: 7500
  });
  const option = result.options[1];
  const first = buildEscoTermScenarios(option);
  const second = buildEscoTermScenarios(option);

  assert.deepEqual(first, second);
  assert.equal(first[0].years, 5);
  assert.equal(first[1].years, 7);
  assert.equal(first[2].years, 10);
});
