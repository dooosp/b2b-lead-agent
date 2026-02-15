import { getCommonStyles } from './common-styles.js';

export function getAuthRequiredPage(statusCode = 401) {
  const isServerConfigError = statusCode === 503;
  const title = isServerConfigError ? '시스템 설정이 필요합니다' : '인증이 필요합니다';
  const description = isServerConfigError
    ? '서버 인증 설정이 누락되었습니다. 관리자에게 문의하세요.'
    : '이 페이지는 접근 권한이 필요합니다. Bearer 토큰을 설정한 뒤 다시 시도하세요.';

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
    <h1>${title}</h1>
    <p class="subtitle">${description}</p>
    <div class="nav-buttons top-nav" style="margin-top:12px;">
      <a href="/" class="btn btn-secondary">메인으로 이동</a>
    </div>
  </main>
</body>
</html>`;
}
