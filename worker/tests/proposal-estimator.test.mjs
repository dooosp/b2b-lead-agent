import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDesigoPointAndController } from '../lib/proposal-estimator.js';

test('estimator returns deterministic values for identical input', () => {
  const input = {
    totalArea: 30000,
    floors: 20,
    systemFlags: { hvac: true, lighting: true, power: true, fire: true, extra: true }
  };
  const first = estimateDesigoPointAndController(input);
  const second = estimateDesigoPointAndController(input);
  assert.deepEqual(first, second);
});

test('estimator uses documented coefficients and area factor', () => {
  const result = estimateDesigoPointAndController({
    totalArea: 30000,
    floors: 20,
    systemFlags: { hvac: true, lighting: true, power: true, fire: true, extra: true }
  });

  assert.equal(result.assumptions.areaDensityFactor, 1.25);
  assert.equal(result.pointsBySystem.hvac, 2250);
  assert.equal(result.pointsBySystem.lighting, 1125);
  assert.equal(result.pointsBySystem.power, 500);
  assert.equal(result.pointsBySystem.fire, 750);
  assert.equal(result.pointsBySystem.extra, 375);
  assert.equal(result.totalPoints, 5000);
  assert.equal(result.controllers.recommended, 5);
});

test('disabling systems reduces points and controllers', () => {
  const full = estimateDesigoPointAndController({
    totalArea: 30000,
    floors: 20,
    systemFlags: { hvac: true, lighting: true, power: true, fire: true, extra: true }
  });
  const reduced = estimateDesigoPointAndController({
    totalArea: 30000,
    floors: 20,
    systemFlags: { hvac: true, lighting: false, power: true, fire: false, extra: false }
  });

  assert.ok(reduced.totalPoints < full.totalPoints);
  assert.ok(reduced.controllers.recommended <= full.controllers.recommended);
  assert.equal(reduced.pointsBySystem.lighting, 0);
  assert.equal(reduced.pointsBySystem.fire, 0);
  assert.equal(reduced.pointsBySystem.extra, 0);
});

test('estimator regression case: 45,000㎡ / 25층', () => {
  const result = estimateDesigoPointAndController({
    totalArea: 45000,
    floors: 25,
    systemFlags: { hvac: true, lighting: true, power: true, fire: true, extra: true }
  });

  assert.equal(result.assumptions.areaDensityFactor, 1.3);
  assert.equal(result.pointsBySystem.hvac, 2925);
  assert.equal(result.pointsBySystem.lighting, 1463);
  assert.equal(result.pointsBySystem.power, 650);
  assert.equal(result.pointsBySystem.fire, 975);
  assert.equal(result.pointsBySystem.extra, 488);
  assert.equal(result.totalPoints, 6501);
  assert.equal(result.controllers.recommended, 6);
});
