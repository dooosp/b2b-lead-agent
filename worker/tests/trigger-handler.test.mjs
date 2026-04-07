import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTrigger } from '../api/trigger.js';

function installTimingSafeEqual() {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalCrypto = globalThis.crypto;
  const subtle = {
    ...originalCrypto?.subtle,
    async timingSafeEqual(a, b) {
      if (a.byteLength !== b.byteLength) return false;
      let mismatch = 0;
      for (let i = 0; i < a.byteLength; i++) mismatch |= a[i] ^ b[i];
      return mismatch === 0;
    }
  };
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: originalDescriptor?.enumerable ?? true,
    value: { subtle }
  });
  return () => {
    Object.defineProperty(globalThis, 'crypto', originalDescriptor ?? {
      configurable: true,
      enumerable: true,
      value: originalCrypto
    });
  };
}

test('handleTrigger returns 202 accepted with intake-only wording for accepted dispatches', async () => {
  const restoreCrypto = installTimingSafeEqual();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 204 });

  try {
    const request = new Request('https://example.com/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret', profile: 'danfoss' })
    });
    const env = {
      TRIGGER_PASSWORD: 'secret',
      GITHUB_REPO: 'owner/repo',
      GITHUB_TOKEN: 'gh-token',
      PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Danfoss Korea' }])
    };

    const response = await handleTrigger(request, env);
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.deepEqual(payload, {
      success: true,
      status: 'accepted',
      message: '[danfoss] 보고서 생성 요청이 접수되었습니다. 실행이 완료되면 이메일이 전송됩니다.'
    });
    assert.equal('execution' in payload, false);
    assert.equal('completedAt' in payload, false);
    assert.equal(payload.message.includes('완료되었습니다'), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreCrypto();
  }
});

test('handleTrigger keeps upstream dispatch failures out of the accepted contract', async () => {
  const restoreCrypto = installTimingSafeEqual();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 500 });

  try {
    const request = new Request('https://example.com/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret', profile: 'danfoss' })
    });
    const env = {
      TRIGGER_PASSWORD: 'secret',
      GITHUB_REPO: 'owner/repo',
      GITHUB_TOKEN: 'gh-token',
      PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Danfoss Korea' }])
    };

    const response = await handleTrigger(request, env);
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(payload, { success: false, message: '오류: 500' });
  } finally {
    globalThis.fetch = originalFetch;
    restoreCrypto();
  }
});
