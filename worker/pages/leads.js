import { getCommonStyles } from './common-styles.js';
import { getLeadsStyles } from './leads-styles.js';
import { getLeadsView } from './leads-view.js';
import { getLeadsBrowserScript } from './leads-browser.js';

/** Compose access-appropriate page fragments before serializing the document. */
export function getLeadsPage({ includeGeneratedReviewGuidance = true } = {}) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>리드 리뷰 큐</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#e94560">
  <style>${getCommonStyles()}${getLeadsStyles()}
  </style>
</head>
<body>
${getLeadsView()}
  <script>${getLeadsBrowserScript(includeGeneratedReviewGuidance)}</script>
</body>
</html>`;
}
