import { getCommonStyles } from './common-styles.js';
import { getStoredTokenScript } from './script-snippets.js';

export function getAuthRequiredPage(statusCode = 401) {
  const isServerConfigError = statusCode === 503;
  const title = isServerConfigError ? '시스템 설정이 필요합니다' : '인증이 필요합니다';
  const description = isServerConfigError
    ? '서버 인증 설정이 누락되었습니다. 관리자에게 문의하세요.'
    : '비밀번호를 입력한 뒤 이 페이지로 돌아올 수 있습니다.';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${getCommonStyles()}</style>
</head>
<body>
  <main class="container" style="max-width:640px;">
    <h1 id="authTitle">${title}</h1>
    <p class="subtitle" id="authDescription" role="status">${description}</p>
    <div class="nav-buttons top-nav" style="margin-top:12px;">
      ${isServerConfigError ? '' : '<a id="signInLink" href="/" class="btn btn-primary">인증하고 다시 보기</a>'}
      <a href="/" class="btn btn-secondary">메인으로 이동</a>
    </div>
  </main>
  <script>
    ${getStoredTokenScript()}
    const signInLink = document.getElementById('signInLink');
    if (signInLink) signInLink.href = '/?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
    async function restoreAuthenticatedPage() {
      if (!getToken()) return;
      const description = document.getElementById('authDescription');
      description.textContent = '인증 상태를 확인하고 있습니다...';
      try {
        const res = await fetch(window.location.pathname + window.location.search, { headers: authHeaders(), cache: 'no-store' });
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
          const html = await res.text();
          document.open(); document.write(html); document.close();
          return;
        }
        if (res.status === 404) {
          document.getElementById('authTitle').textContent = '리드를 찾을 수 없습니다';
          description.textContent = '리드 목록에서 대상을 다시 선택하세요.';
        } else {
          description.textContent = res.status === 401
            ? '인증 정보가 만료되었거나 올바르지 않습니다. 비밀번호를 다시 입력하세요.'
            : '페이지를 불러오지 못했습니다. 잠시 후 다시 시도하세요.';
        }
      } catch {
        description.textContent = '연결을 확인한 뒤 다시 시도하세요.';
      }
    }
    ${statusCode === 401 ? 'restoreAuthenticatedPage();' : ''}
  </script>
</body>
</html>`;
}
