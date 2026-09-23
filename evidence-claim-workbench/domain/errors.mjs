import { assertSafeArtifact } from '../../knowledge/claim-registry/index.mjs';

export class EvidenceWorkbenchValidationError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'EvidenceWorkbenchValidationError';
    this.code = code;
    this.path = path;
  }
}

export function fail(code, path = '$') {
  throw new EvidenceWorkbenchValidationError(code, path);
}

export function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertPlainObject(value, path = '$', code = 'PLAIN_OBJECT_REQUIRED') {
  if (!isPlainObject(value)) fail(code, path);
  return value;
}

export function assertExactKeys(value, { required = [], optional = [] } = {}, path = '$') {
  assertPlainObject(value, path);
  const permitted = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      fail('PROTOTYPE_KEY_REFUSED', `${path}.${key}`);
    }
    if (!permitted.has(key)) fail('UNEXPECTED_FIELD', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('REQUIRED_FIELD_MISSING', `${path}.${key}`);
  }
}

export function assertSafeMetadata(value, path = '$') {
  try {
    assertSafeArtifact(value, path);
  } catch (error) {
    if (error && typeof error.code === 'string') {
      throw new EvidenceWorkbenchValidationError(error.code, error.path || path);
    }
    throw error;
  }
  return true;
}

export function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
