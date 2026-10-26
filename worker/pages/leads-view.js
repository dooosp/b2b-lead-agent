/** Static list shell. Dynamic lead content is rendered by the browser modules. */
export function getLeadsView() {
  return `  <main class="container" style="max-width:700px;">
    <nav class="top-nav" aria-label="상단 이동">
      <a href="/" class="back-link">← 메인</a>
      <div class="top-nav-links">
        <a href="/dashboard" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">대시보드</a>
        <a id="historyLink" href="/history" class="btn btn-secondary" style="font-size:12px;padding:6px 12px;">전체 히스토리</a>
        <button class="btn btn-secondary csv-btn" style="font-size:12px;padding:6px 12px;" onclick="downloadCSV()">CSV 내보내기</button>
      </div>
    </nav>
    <h1 style="font-size:22px;">리드 리뷰 큐</h1>
    <p class="subtitle">최근 분석된 영업 기회 목록</p>

    <div class="view-tabs" role="tablist" aria-label="리드 보기 전환" aria-orientation="vertical">
      <button id="listViewTab" class="view-tab active" type="button" role="tab" aria-selected="true" aria-controls="leadsList" tabindex="0" data-view-target="list" onclick="switchView('list')">리스트</button>
      <button id="kanbanViewTab" class="view-tab" type="button" role="tab" aria-selected="false" aria-controls="kanbanView" tabindex="-1" data-view-target="kanban" onclick="switchView('kanban')">칸반 보드</button>
    </div>

    <details class="review-disclosure" id="reviewTools">
    <summary>분석·인쇄 도구</summary>
    <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;margin-bottom:12px;" onclick="window.print()">PDF 인쇄</button>

    <div class="batch-enrich-bar">
      <span>미분석 리드를 AI로 심층 분석합니다 (최대 3건/회)</span>
      <button class="btn-enrich" onclick="batchEnrich(this)">일괄 상세 분석</button>
    </div>
    <div id="batchStatus" style="font-size:12px;margin-bottom:12px;min-height:16px;"></div>
    </details>

    <section id="nextReviewStrip" class="next-review-strip" aria-label="다음 리뷰">
      <div class="next-review-strip-head">
        <div>
          <span>다음 리뷰</span>
          <strong>리드 큐를 불러오는 중입니다.</strong>
        </div>
      </div>
    </section>

    <div id="reviewQueueFilters" class="review-filter-bar" aria-label="리드 검토 필터">
      <label>검토 상태
        <select data-filter-key="reviewStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="NEW">새 검토</option>
          <option value="NEEDS_REVIEW">검토 필요</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">반려</option>
          <option value="DEFERRED">보류</option>
        </select>
      </label>
      <label>검증 상태
        <select data-filter-key="verificationStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="verified">검증됨</option>
          <option value="needs_review">검증 필요</option>
          <option value="draft">초안</option>
          <option value="unverified">미검증</option>
        </select>
      </label>
      <details id="advancedReviewFilters" class="review-filter-advanced">
      <summary>상세 필터 <span id="advancedFilterCount"></span></summary>
      <div class="review-filter-advanced-grid">
      <label>생성 방식
        <select data-filter-key="generationMode" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="llm">LLM 생성</option>
          <option value="heuristic">휴리스틱 생성</option>
          <option value="demo">데모</option>
          <option value="unavailable">생성 불가</option>
        </select>
      </label>
      <label>신뢰도
        <select data-filter-key="confidence" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </label>
      <label>게이트 상태
        <select data-filter-key="gateStatus" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="ready">게이트 통과</option>
          <option value="review">보강 필요</option>
          <option value="blocked">차단</option>
          <option value="hold">보류</option>
        </select>
      </label>
      <label>액션 레인
        <select data-filter-key="queueLane" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="approval_candidates">승인 후보</option>
          <option value="needs_evidence">보강 필요</option>
          <option value="risk_review">리스크 확인</option>
          <option value="low_priority">낮은 우선순위</option>
        </select>
      </label>
      <label>다음 액션
        <select data-filter-key="nextReviewAction" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="prepare_human_follow_up">후속 준비</option>
          <option value="decide_review_status">검토 결정</option>
          <option value="verify_evidence">근거 확인</option>
          <option value="resolve_data_gaps">데이터 공백 보강</option>
          <option value="enrich_before_review">보강 후 검토</option>
          <option value="refresh_signal">신호 갱신</option>
          <option value="reconcile_review_conflict">리스크 조정</option>
          <option value="schedule_recheck">재검토 예약</option>
          <option value="keep_out_of_queue">우선순위 제외</option>
        </select>
      </label>
      <label>검토 우선순위
        <select data-filter-key="reviewPriority" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="high">높음</option>
          <option value="medium">중간</option>
          <option value="hold">보류</option>
          <option value="blocked">차단</option>
        </select>
      </label>
      <label>리스크 플래그
        <select data-filter-key="riskFlag" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">리스크 있음</option>
          <option value="none">리스크 없음</option>
          <option value="missing_evidence">근거 누락</option>
          <option value="data_gaps">데이터 공백</option>
          <option value="low_confidence">낮은 신뢰도</option>
          <option value="conflicting_evidence">충돌 근거</option>
          <option value="approved_but_unverified">승인/검증 충돌</option>
          <option value="stale_signal">오래된 신호</option>
        </select>
      </label>
      <label>누락 정보
        <select data-filter-key="missingInfo" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">누락 있음</option>
          <option value="none">누락 없음</option>
        </select>
      </label>
      <label>데이터 공백
        <select data-filter-key="dataGaps" onchange="setReviewQueueFilter(this)">
          <option value="all">전체</option>
          <option value="has">공백 있음</option>
          <option value="none">공백 없음</option>
        </select>
      </label>
      <div class="review-filter-actions">
        <button class="btn btn-secondary" type="button" onclick="resetReviewQueueFilters()">초기화</button>
      </div>
      </div>
      </details>
    </div>
    <details id="reviewOverview" class="review-disclosure">
    <summary>검토 현황·도움말</summary>
    <div id="leadsSummary"></div>
    </details>
    <div id="reviewSessionStatus" class="review-session-status is-idle" role="status" aria-live="polite" aria-atomic="true"></div>
    <div id="leadsList" role="tabpanel" aria-labelledby="listViewTab"><p style="color:#aaa;">로딩 중...</p></div>
    <div id="kanbanView" role="tabpanel" aria-labelledby="kanbanViewTab" style="display:none;" hidden></div>
  </main>

`;
}
