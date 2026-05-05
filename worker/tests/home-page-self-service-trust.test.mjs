import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { getMainPage } from '../pages/home-page.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHarness() {
  const html = getMainPage({});
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(scriptMatch, 'home page should include an executable client script');

  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        className: '',
        textContent: '',
        innerHTML: '',
        classList: { add() {}, remove() {}, toggle() {} },
        style: {},
        setAttribute() {},
        addEventListener() {}
      });
    }
    return elements.get(id);
  };

  const captured = {
    clipboardText: '',
    downloadText: '',
    downloadName: '',
    clicked: false
  };

  class HarnessURL extends URL {}
  HarnessURL.createObjectURL = (blob) => {
    captured.downloadText = blob.parts.join('');
    return 'blob:test';
  };
  HarnessURL.revokeObjectURL = () => {};

  const context = {
    Blob: class {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type || '';
      }
    },
    Date,
    Math,
    URL: HarnessURL,
    clearInterval() {},
    setInterval() { return 1; },
    setTimeout(fn) { fn(); },
    document: {
      createElement(tagName) {
        if (tagName === 'a') {
          return {
            href: '',
            set download(value) { captured.downloadName = value; },
            click() { captured.clicked = true; }
          };
        }
        return {
          innerHTML: '',
          set textContent(value) { this.innerHTML = escapeHtml(value); },
          get textContent() { return this.innerHTML; }
        };
      },
      getElementById: getElement,
      querySelectorAll() { return []; }
    },
    navigator: {
      clipboard: {
        writeText(text) {
          captured.clipboardText = text;
          return Promise.resolve();
        }
      }
    },
    sessionStorage: {
      getItem() { return ''; },
      setItem() {}
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(scriptMatch[1], context);

  return { context, captured, getElement };
}

function createHeuristicLead() {
  return {
    company: 'LG전자',
    score: 80,
    grade: 'A',
    project_title: '스마트팩토리 에너지 효율 투자',
    recommended_product: '에너지 관리 시스템',
    expected_roi: '근거 없음(추정 불가) - 공개 기사 기준 정량 데이터 부족',
    sales_pitch: '운영 데이터 통합과 설비 최적화를 함께 제안합니다.',
    trend: '제조업 에너지 효율 투자 확대',
    sources: [{ title: 'LG전자 투자 기사', url: 'https://example.com/news' }],
    generationMode: 'heuristic',
    verificationStatus: 'needs_review',
    confidence: 'MEDIUM',
    confidenceReason: '규칙 기반 fallback: 기사 제목에 정량 신호가 포함되어 신뢰도 보통으로 판정',
    assumptions: ['규칙 기반 빠른 분석이며 LLM 정밀 검토 전 초안입니다.'],
    dataGaps: ['LLM 정밀 분석 미완료', '고객 내부 예산/일정 미확인']
  };
}

test('home page self-service client preserves and exports fallback trust metadata', async () => {
  const { context, captured, getElement } = createHarness();
  const lead = createHeuristicLead();

  const normalized = context.normalizeSelfServiceLead(lead);
  assert.equal(normalized.generationMode, 'heuristic');
  assert.equal(normalized.verificationStatus, 'needs_review');
  assert.equal(normalized.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(normalized.confidence, 'MEDIUM');
  assert.deepEqual(normalized.assumptions, lead.assumptions);
  assert.deepEqual(normalized.dataGaps, lead.dataGaps);

  context.renderSelfServiceResults([lead], { name: 'LG전자' }, 'AI 분석 지연으로 규칙 기반 결과를 우선 제공합니다.');
  const html = getElement('ssResults').innerHTML;
  assert.match(html, /검토 필요 \/ 규칙 기반/);
  assert.match(html, /검토 상태 검토 필요/);
  assert.match(html, /검증 완료 전 결과/);
  assert.match(html, /데이터 공백: LLM 정밀 분석 미완료, 고객 내부 예산\/일정 미확인/);
  assert.equal(context.window._ssLeads[0].generationMode, 'heuristic');

  await context.copySelfServiceResults();
  assert.match(captured.clipboardText, /신뢰 상태: 검토 필요 \/ 규칙 기반 \/ heuristic \/ needs_review \/ MEDIUM/);
  assert.match(captured.clipboardText, /검토 상태: 검토 필요 \(NEEDS_REVIEW\)/);
  assert.match(captured.clipboardText, /데이터 공백: LLM 정밀 분석 미완료, 고객 내부 예산\/일정 미확인/);

  context.downloadSelfServiceResults();
  assert.equal(captured.clicked, true);
  assert.match(captured.downloadName, /^LG전자_\d{4}-\d{2}-\d{2}\.json$/);
  const payload = JSON.parse(captured.downloadText);
  assert.equal(payload.leads[0].generationMode, 'heuristic');
  assert.equal(payload.leads[0].verificationStatus, 'needs_review');
  assert.equal(payload.leads[0].reviewStatus, 'NEEDS_REVIEW');
  assert.equal(payload.leads[0].confidence, 'MEDIUM');
  assert.deepEqual(payload.leads[0].assumptions, lead.assumptions);
  assert.deepEqual(payload.leads[0].dataGaps, lead.dataGaps);
});
