const DEFAULT_COEFFICIENTS = Object.freeze({
  hvac: 90,
  lighting: 45,
  power: 20,
  fire: 30,
  extra: 15
});

const DEFAULT_FLAGS = Object.freeze({
  hvac: true,
  lighting: true,
  power: true,
  fire: true,
  extra: true
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toPositiveNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function normalizeSystemFlags(systemFlags = {}) {
  return {
    hvac: systemFlags.hvac !== false,
    lighting: systemFlags.lighting !== false,
    power: systemFlags.power !== false,
    fire: systemFlags.fire !== false,
    extra: systemFlags.extra !== false
  };
}

export function estimateDesigoPointAndController({
  totalArea,
  floors,
  systemFlags = DEFAULT_FLAGS,
  controllerCapacity = 1200,
  coefficients = DEFAULT_COEFFICIENTS
}) {
  const normalizedFloors = Math.max(1, Math.round(toPositiveNumber(floors, 1)));
  const normalizedArea = toPositiveNumber(totalArea, normalizedFloors * 1200);
  const flags = normalizeSystemFlags(systemFlags);

  // Assumption:
  // - 1,200㎡/층을 기준 밀도로 두고, 실제 면적 대비 밀도계수(0.85~1.30)를 적용.
  // - 계수 변경 지점: DEFAULT_COEFFICIENTS.
  const areaPerFloorBaseline = 1200;
  const areaDensityFactor = clamp(
    normalizedArea / (normalizedFloors * areaPerFloorBaseline),
    0.85,
    1.3
  );

  const pointsBySystem = {};
  let totalPoints = 0;
  for (const key of Object.keys(DEFAULT_COEFFICIENTS)) {
    const coeff = Number(coefficients[key] || DEFAULT_COEFFICIENTS[key]) || 0;
    const enabled = flags[key] !== false;
    const points = enabled ? Math.round(normalizedFloors * coeff * areaDensityFactor) : 0;
    pointsBySystem[key] = points;
    totalPoints += points;
  }

  const pointRange = {
    min: Math.round(totalPoints * 0.9),
    max: Math.round(totalPoints * 1.1)
  };

  const cap = Math.max(1, Math.round(toPositiveNumber(controllerCapacity, 1200)));
  const controllers = {
    capacityPerController: cap,
    min: Math.max(1, Math.ceil(pointRange.min / cap)),
    recommended: Math.max(1, Math.ceil(totalPoints / cap)),
    max: Math.max(1, Math.ceil(pointRange.max / cap))
  };

  return {
    inputs: {
      totalArea: Math.round(normalizedArea),
      floors: normalizedFloors,
      systemFlags: flags
    },
    assumptions: {
      areaPerFloorBaseline,
      areaDensityFactor: Number(areaDensityFactor.toFixed(3)),
      coefficients: { ...coefficients }
    },
    pointsBySystem,
    totalPoints,
    pointRange,
    controllers
  };
}
