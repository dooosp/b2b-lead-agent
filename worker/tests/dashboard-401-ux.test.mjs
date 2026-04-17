import test from 'node:test';
import assert from 'node:assert/strict';

import { getDashboardPage } from '../pages/dashboard.js';

function createEnv() {
  return {
    PROFILES: JSON.stringify([
      { id: 'danfoss', name: '댄포스 코리아' },
      { id: 'ls-electric', name: 'LS일렉트릭' }
    ])
  };
}

test('dashboard page includes branded unauthorized recovery state for 401 api responses', () => {
  const html = getDashboardPage(createEnv());

  assert.match(html, /리드 파이프라인 현황/);
  assert.match(html, /if\s*\(res\.status === 401\)/);
  assert.match(html, /이 대시보드는 권한이 확인된 사용자만 볼 수 있습니다\./);
  assert.match(html, /메인 화면에서 인증한 뒤 다시 시도하세요\./);
  assert.match(html, /메인으로 이동/);
  assert.doesNotMatch(html, /Bearer 토큰/);
});
