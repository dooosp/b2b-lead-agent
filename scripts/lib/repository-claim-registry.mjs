import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createValidatedClaimRegistry } from '../../knowledge/claim-registry/index.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function readRepositoryJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolve(REPO_ROOT, relativePath), 'utf8'));
  } catch (cause) {
    const error = new Error(`REPOSITORY_JSON_LOAD_FAILED:${relativePath}`, { cause });
    error.code = 'REPOSITORY_JSON_LOAD_FAILED';
    error.relativePath = relativePath;
    throw error;
  }
}

export async function loadRepositoryClaimRegistry() {
  const rawRegistry = await readRepositoryJson('knowledge/claim-registry/synthetic/datacenter-claims-v1.json');
  return {
    rawRegistry,
    registry: createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf })
  };
}

export async function loadEvidenceDomainInputs() {
  const [registryResult, verticalPack, aliases, productFamilyMap, inventory, fixture] = await Promise.all([
    loadRepositoryClaimRegistry(),
    readRepositoryJson('verticals/datacenter/vertical-pack-v0.json'),
    readRepositoryJson('verticals/datacenter/technical-aliases-v0.json'),
    readRepositoryJson('verticals/datacenter/product-family-map-v0.json'),
    readRepositoryJson('knowledge/claim-registry/managed-profile-legacy-inventory.json'),
    readRepositoryJson('eval/fixtures/spec-fit/datacenter-v0-scenarios.json')
  ]);
  return { ...registryResult, verticalPack, aliases, productFamilyMap, inventory, fixture };
}
