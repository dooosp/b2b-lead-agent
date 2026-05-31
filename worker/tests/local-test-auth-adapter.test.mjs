import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOCAL_TEST_AUTH_ADAPTER_CONTRACT,
  createStaticLocalTestAuthAdapter,
  resolveLocalTestAuthAdapter,
} from '../lib/local-test-auth-adapter.js';

const EXPECTED_AUDIENCE = 'b2b-lead-agent-level1-local-proof';

test('local/test auth adapter contract is provider-agnostic and non-production only', () => {
  assert.deepEqual(LOCAL_TEST_AUTH_ADAPTER_CONTRACT, {
    version: 'level1.local_test_auth_adapter.v1',
    boundary: 'local_test_only',
    sessionSource: 'injected_adapter_only',
    realProviderParsing: false,
    realTokenParsing: false,
    realCookieParsing: false,
    realJwtParsing: false,
    productionReady: false,
  });
});

for (const scenario of [
  {
    name: 'reviewer',
    session: { role: 'reviewer' },
    expected: {
      adapterStatus: 'resolved',
      role: 'reviewer',
      roleStatus: 'recognized',
      authenticated: true,
      claimStatus: 'valid',
    },
  },
  {
    name: 'manager',
    session: { role: 'manager' },
    expected: {
      adapterStatus: 'resolved',
      role: 'manager',
      roleStatus: 'recognized',
      authenticated: true,
      claimStatus: 'valid',
    },
  },
  {
    name: 'admin',
    session: { role: 'admin' },
    expected: {
      adapterStatus: 'resolved',
      role: 'admin',
      roleStatus: 'recognized',
      authenticated: true,
      claimStatus: 'valid',
    },
  },
  {
    name: 'api_client',
    session: { role: 'api-client' },
    expected: {
      adapterStatus: 'resolved',
      role: 'api_client',
      roleStatus: 'recognized',
      authenticated: true,
      claimStatus: 'valid',
    },
  },
  {
    name: 'missing role',
    session: { role: '' },
    expected: {
      adapterStatus: 'resolved',
      role: 'none',
      roleStatus: 'missing',
      authenticated: true,
      claimStatus: 'valid',
    },
  },
  {
    name: 'unknown role',
    session: { role: 'auditor' },
    expected: {
      adapterStatus: 'resolved',
      role: 'none',
      roleStatus: 'unknown',
      authenticated: true,
      claimStatus: 'valid',
    },
  },
  {
    name: 'expired claim',
    session: { role: 'reviewer', expiresAt: '2000-01-01T00:00:00.000Z' },
    expected: {
      adapterStatus: 'resolved',
      role: 'reviewer',
      roleStatus: 'recognized',
      authenticated: false,
      claimStatus: 'expired',
    },
  },
  {
    name: 'wrong audience',
    session: { role: 'reviewer', audience: 'wrong-audience' },
    expected: {
      adapterStatus: 'resolved',
      role: 'reviewer',
      roleStatus: 'recognized',
      authenticated: false,
      claimStatus: 'wrong_audience',
    },
  },
]) {
  test(`local/test auth adapter normalizes ${scenario.name} claims`, async () => {
    const result = await resolveLocalTestAuthAdapter({
      adapter: createStaticLocalTestAuthAdapter(scenario.session),
      expectedAudience: EXPECTED_AUDIENCE,
    });

    assert.deepEqual(result.claims, {
      contractVersion: 'level1.local_test_auth_adapter.v1',
      adapterStatus: scenario.expected.adapterStatus,
      role: scenario.expected.role,
      roleStatus: scenario.expected.roleStatus,
      authenticated: scenario.expected.authenticated,
      claimStatus: scenario.expected.claimStatus,
      expectedAudience: EXPECTED_AUDIENCE,
      realAuthImplemented: false,
      productionReady: false,
    });
  });
}

test('local/test auth adapter fails closed without parsing request auth material', async () => {
  const result = await resolveLocalTestAuthAdapter({
    request: new Request('https://example.test/leads', {
      headers: {
        Authorization: 'Bearer real-token-shaped-value',
        Cookie: 'session=real-cookie-shaped-value',
      },
    }),
    expectedAudience: EXPECTED_AUDIENCE,
  });

  assert.equal(result.adapterStatus, 'missing_adapter');
  assert.deepEqual(result.claims, {
    contractVersion: 'level1.local_test_auth_adapter.v1',
    adapterStatus: 'missing_adapter',
    role: 'none',
    roleStatus: 'missing',
    authenticated: false,
    claimStatus: 'missing_session',
    expectedAudience: EXPECTED_AUDIENCE,
    realAuthImplemented: false,
    productionReady: false,
  });
  assert.equal(JSON.stringify(result).includes('real-token-shaped-value'), false);
  assert.equal(JSON.stringify(result).includes('real-cookie-shaped-value'), false);
});

test('local/test auth adapter redacts provider errors and fails closed', async () => {
  const secretText = 'provider-secret-claim-body';
  const result = await resolveLocalTestAuthAdapter({
    adapter: {
      async resolveSession() {
        throw new Error(secretText);
      },
    },
    expectedAudience: EXPECTED_AUDIENCE,
  });

  assert.equal(result.adapterStatus, 'provider_error');
  assert.equal(result.claims.claimStatus, 'provider_error');
  assert.equal(result.claims.role, 'none');
  assert.equal(result.claims.authenticated, false);
  assert.equal(JSON.stringify(result).includes(secretText), false);
});
