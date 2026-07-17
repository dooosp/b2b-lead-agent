const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CSS = readFileSync(path.join(REPO_ROOT, 'pursuit-workbench/assets/pursuit-workbench.css'), 'utf8');
const CLIENT = readFileSync(path.join(REPO_ROOT, 'pursuit-workbench/assets/pursuit-workbench.js'), 'utf8');

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) => channel(Number.parseInt(value.slice(offset, offset + 2), 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function cssVariable(name) {
  const match = CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `missing CSS variable ${name}`);
  return match[1];
}

test('text and status token pairs meet WCAG AA normal-text contrast', () => {
  const pairs = [
    ['ink', 'paper'],
    ['muted', 'paper'],
    ['navy', 'surface'],
    ['blue', 'blue-soft'],
    ['green', 'green-soft'],
    ['amber', 'amber-soft'],
    ['red', 'red-soft']
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrast(cssVariable(foreground), cssVariable(background)) >= 4.5, `${foreground} on ${background}`);
  }
  assert.ok(contrast('#513100', cssVariable('amber-soft')) >= 4.5, 'boundary text');
  assert.ok(contrast('#681313', cssVariable('red-soft')) >= 4.5, 'error text');
  assert.ok(contrast('#f9fafb', '#111827') >= 4.5, 'packet preview text');
});

test('focus indicator uses a two-color boundary that remains visible on light and navy surfaces', () => {
  assert.match(CSS, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus\)[^}]*box-shadow:\s*0 0 0 2px var\(--navy\)/s);
  assert.ok(contrast(cssVariable('focus'), cssVariable('navy')) >= 3, 'focus ring on navy');
  assert.ok(contrast(cssVariable('navy'), cssVariable('surface')) >= 3, 'dark focus boundary on surface');
});

test('responsive and reduced-motion contracts are explicit and do not hide overflow globally', () => {
  assert.match(CSS, /@media \(max-width:\s*760px\)/);
  assert.match(CSS, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(CSS, /\.table-scroll\s*\{[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(CSS, /(?:html|body)\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(CSS, /animation-name:|@keyframes/);
});

test('browser behavior has no storage, service-worker, telemetry, or mutation-request primitive', () => {
  assert.doesNotMatch(CLIENT, /localStorage|sessionStorage|indexedDB|serviceWorker|sendBeacon|WebSocket|EventSource|XMLHttpRequest/);
  assert.doesNotMatch(CLIENT, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
  assert.match(CLIENT, /fetch\(`\/api\/scenarios\/\$\{encodeURIComponent\(scenarioId\)\}`/);
});
