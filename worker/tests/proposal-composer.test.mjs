import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCpaEstimate } from '../lib/cpa-estimator.js';
import { estimateDesigoPointAndController } from '../lib/proposal-estimator.js';
import {
  composeProposalContent,
  isValidProposalSectionPayload,
  parseProposalSectionPayload
} from '../lib/proposal-composer.js';

test('proposal section payload parser accepts strict JSON object', () => {
  const payload = parseProposalSectionPayload(JSON.stringify({
    sections: {
      1: ['과제를 정리합니다.', '운영 현황을 검토합니다.'],
      2: ['통합 구조를 설명합니다.', '기존 설비 연계를 검토합니다.'],
      3: ['절감 효과를 검증합니다.', '기준선 데이터를 확인합니다.'],
      4: ['성과보장 구조를 설명합니다.', '검증 절차를 명확히 합니다.'],
      5: ['유사 사례를 비교합니다.', '구축 범위를 검토합니다.'],
      6: ['단계별 승인 절차를 정의합니다.', '운영 전환 계획을 세웁니다.'],
      7: ['운영 통합 강점을 설명합니다.', '서비스 체계를 제시합니다.']
    }
  }));

  assert.equal(isValidProposalSectionPayload(payload), true);
});

test('composeProposalContent injects deterministic sections and fixed headings', () => {
  const proposalInput = {
    buildingType: 'office',
    area: 45000,
    floors: 25,
    currentBMS: 'Honeywell EBI',
    monthlyEnergyCost: 7500,
    systemFlags: { hvac: true, lighting: true, power: true, fire: true, extra: true }
  };
  const estimation = estimateDesigoPointAndController({
    totalArea: proposalInput.area,
    floors: proposalInput.floors,
    systemFlags: proposalInput.systemFlags
  });
  const cpaEstimate = calculateCpaEstimate({
    area: proposalInput.area,
    floors: proposalInput.floors,
    buildingType: proposalInput.buildingType,
    region: 'seoul',
    monthlyEnergyCost: proposalInput.monthlyEnergyCost
  });
  const sections = {
    1: ['현장 운영 과제를 우선 정리합니다.', '기존 설비와 운영 프로세스를 함께 검토합니다.'],
    2: ['통합 관제 구조의 운영 의미를 설명합니다.', '현장 전환 리스크를 줄이는 접근을 제시합니다.'],
    3: ['절감 효과는 운전 데이터로 검증해야 합니다.', '설비 운영 기준선을 먼저 확정해야 합니다.'],
    4: ['성과보장형 계약은 검증 기준 합의가 선행되어야 합니다.', '운영 책임과 성과 지표를 함께 정의해야 합니다.'],
    5: ['유사 업종 사례를 우선 비교합니다.', '구축 범위와 운영 성과를 함께 확인합니다.'],
    6: ['설계와 시공 승인 절차를 병행합니다.', '시운전과 안정화 전환 계획을 분리합니다.'],
    7: ['운영 데이터 통합 역량을 강조합니다.', '국내 지원 체계와 제품 로드맵을 함께 설명합니다.']
  };

  const content = composeProposalContent({ proposalInput, estimation, cpaEstimate, sections });

  assert.match(content, /## 1\. 프로젝트 개요/);
  assert.match(content, /## 2\. Desigo CC 아키텍처/);
  assert.match(content, /총 포인트: 6,501/);
  assert.match(content, /권장 6대/);
  assert.match(content, /## 4\. ESCO 모델 제안/);
  assert.match(content, /5년 누적 순절감액/);
  assert.match(content, /## 7\. Why Siemens/);
});
