/** Trust badges, lead cards, Kanban cards and their empty states. */
export function getLeadsRendererScript() {
  return `    function leadAccessibleName(lead) {
      return esc((lead && (lead.company || lead.id)) || '리드');
    }

    function renderStatusSelect(lead) {
      if (!lead.id) return '';
      const current = lead.status || 'NEW';
      const allowed = transitions[current] || [];
      if (allowed.length === 0) return \`<span class="badge badge-status \${current.toLowerCase()}">\${esc(statusLabels[current])}</span>\`;
      const opts = [current, ...allowed].map(s =>
        \`<option value="\${s}" \${s === current ? 'selected' : ''}>\${esc(statusLabels[s] || s)}</option>\`
      ).join('');
      return \`<select class="status-select" aria-label="\${leadAccessibleName(lead)} 영업 상태 변경" onchange="updateStatus('\${esc(lead.id)}', this.value, '\${current}')">\${opts}</select>\`;
    }

    function renderReviewBadge(lead) {
      const current = getReviewStatus(lead);
      return \`<span class="badge badge-review \${current.toLowerCase()}">\${esc(humanReviewStatusLabel(current))}</span>\`;
    }

    function renderVerificationBadge(lead) {
      const status = getVerificationStatus(lead);
      return \`<span class="badge badge-verification \${status}">\${esc(verificationStatusLabels[status])}</span>\`;
    }

    function renderGenerationBadge(lead) {
      const mode = getGenerationMode(lead);
      return \`<span class="badge badge-generation \${mode}">\${esc(generationModeLabels[mode])}</span>\`;
    }

    function renderConfidenceBadge(lead) {
      const confidence = getConfidence(lead);
      return \`<span class="badge badge-confidence \${confidence.toLowerCase()}">\${esc(confidenceLabels[confidence])}</span>\`;
    }

    function renderEvidenceSummary(lead) {
      const evidenceCount = getEvidenceItems(lead).length;
      const sourceCount = getSources(lead).length;
      const label = evidenceCount > 0 ? \`근거 \${evidenceCount}개\` : '직접 인용 없음';
      const evidenceClass = evidenceCount > 0 ? 'has_evidence' : 'missing_evidence';
      return \`<span class="badge badge-evidence \${evidenceClass}">\${esc(label)} / 출처 \${sourceCount}개</span>\`;
    }

    function renderReviewTrustBadges(lead) {
      return \`
        <span class="lead-review-meta">
          \${renderVerificationBadge(lead)}
          \${renderGenerationBadge(lead)}
          \${renderConfidenceBadge(lead)}
          \${renderEvidenceSummary(lead)}
        </span>
      \`;
    }

    function renderDataGapSummary(lead) {
      const gaps = getDataGaps(lead);
      if (gaps.length === 0) {
        return '<div class="lead-block data-gap-clear"><span class="block-label">데이터 공백</span><div class="block-value">확인된 데이터 공백 없음</div></div>';
      }
      const shown = gaps.slice(0, 2).map((gap) => esc(gap)).join(', ');
      const extra = gaps.length > 2 ? ' 외 ' + (gaps.length - 2) + '건' : '';
      return \`<div class="lead-block data-gap-summary"><span class="block-label">데이터 공백 \${gaps.length}건</span><div class="block-value">\${shown}\${extra}</div></div>\`;
    }

    function renderFilterEmptyState(extraClass) {
      const className = 'filter-empty-state' + (extraClass ? ' ' + extraClass : '');
      return \`
        <div class="\${className}" role="status" aria-live="polite" aria-atomic="true">
          <div>필터 결과가 없습니다. 필터를 초기화하거나 다른 조건을 선택하세요.</div>
          <button class="btn btn-secondary" type="button" aria-label="검토 필터 초기화" onclick="resetReviewQueueFilters()">필터 초기화</button>
        </div>
      \`;
    }

    function renderCurrentLeads() {
      const container = document.getElementById('leadsList');
      const summaryContainer = document.getElementById('leadsSummary');
      const nextReviewStrip = document.getElementById('nextReviewStrip');
      const filteredLeads = getFilteredLeads();
      if (nextReviewStrip) nextReviewStrip.innerHTML = renderNextReviewStrip(filteredLeads);
      summaryContainer.innerHTML = renderLeadsSummary(filteredLeads, cachedLeads.length) + renderManagerReviewerSummary(filteredLeads) + renderLeadReviewSession(filteredLeads) + renderReviewerActionQueue(filteredLeads) + renderReviewGateSummary(filteredLeads) + renderReviewEvidenceSlices(filteredLeads);
      if (currentView === 'kanban') renderKanban(filteredLeads);

      if (filteredLeads.length === 0) {
        container.innerHTML = renderFilterEmptyState();
        return;
      }

      container.innerHTML = filteredLeads.map((lead, i) => \`
          <div class="lead-card \${lead.grade === 'A' ? 'grade-a' : lead.grade === 'B' ? 'grade-b' : ''}" data-lead-id="\${esc(getLeadId(lead))}" tabindex="-1">
            <div class="lead-head">
              <div class="lead-title">
                <h3>\${lead.id ? \`<a href="\${detailLink(lead.id)}" onclick="openLeadDetail('\${esc(lead.id)}', event)" style="color:inherit;text-decoration:none;">\${esc(lead.company)}</a>\` : esc(lead.company)}</h3>
                <div class="lead-subtitle">\${esc(lead.signal || lead.summary || '-')}</div>
                <div class="lead-status-row">
                  <span class="badge \${lead.grade === 'A' ? 'badge-a' : 'badge-b'}">\${esc(lead.grade)}등급</span>
                  \${renderReviewBadge(lead)}
                  <span class="select-label">검토 변경</span>
                  \${renderReviewStatusSelect(lead)}
                  <span class="select-label">영업 상태</span>
                  \${renderStatusSelect(lead)}
                  \${lead.enriched ? '<span class="badge-enriched">심층 분석 완료</span>' : ''}
                </div>
                \${renderReviewTrustBadges(lead)}
              </div>
              <div class="lead-badges">
                <span class="badge badge-a" style="background:#3498db;">\${parseInt(lead.score) || 0}점</span>
                \${lead.urgency ? \`<span class="badge" style="background:\${lead.urgency === 'HIGH' ? '#e74c3c' : '#f39c12'};color:#fff;">\${lead.urgency === 'HIGH' ? '긴급' : '보통'}</span>\` : ''}
                \${lead.eventType ? \`<span class="badge" style="background:#243547;color:#c5d5e6;">\${esc(lead.eventType)}</span>\` : ''}
              </div>
            </div>
            <div class="lead-metrics">
              <div class="lead-metric"><span class="metric-label">추천 제품</span><span class="metric-value">\${esc(lead.product || '-')}</span></div>
              <div class="lead-metric"><span class="metric-label">예상 ROI</span><span class="metric-value">\${esc(lead.roi) || '-'}</span></div>
              \${lead.buyerRole ? \`<div class="lead-metric"><span class="metric-label">예상 키맨</span><span class="metric-value">\${esc(lead.buyerRole)}</span></div>\` : ''}
              \${lead.followUpDate ? \`<div class="lead-metric"><span class="metric-label">후속 일정</span><span class="metric-value">\${esc(lead.followUpDate)}</span></div>\` : ''}
            </div>
            <div class="lead-sections">
              \${lead.whyNow ? \`<div class="lead-block"><span class="block-label">왜 지금</span><div class="block-value">\${esc(lead.whyNow)}</div></div>\` : ''}
              \${lead.urgencyReason ? \`<div class="lead-block"><span class="block-label">우선순위 근거</span><div class="block-value">\${esc(lead.urgencyReason)}</div></div>\` : ''}
              \${lead.confidenceReason ? \`<div class="lead-block"><span class="block-label">신뢰도 근거</span><div class="block-value">\${esc(lead.confidenceReason)}</div></div>\` : ''}
              \${renderLeadListReviewGate(lead)}
              \${renderLeadActionIntelligenceSummary(lead)}
              \${renderDataGapSummary(lead)}
              \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="lead-block"><span class="block-label">가정</span><div class="block-value">\${esc(lead.assumptions.join(', '))}</div></div>\` : ''}
              \${lead.scoreReason ? \`<div class="lead-block"><span class="block-label">점수 해설</span><div class="block-value">\${esc(lead.scoreReason)}</div></div>\` : ''}
              <div class="lead-block"><span class="block-label">추천 메시지</span><div class="block-value">\${esc(lead.recommendedMessage || lead.salesPitch)}</div></div>
              <div class="lead-block"><span class="block-label">시장 트렌드</span><div class="block-value">\${esc(lead.globalContext) || '-'}</div></div>
            </div>
            \${lead.enriched ? \`
            <div class="enriched-details">
              <details>
                <summary>심층 분석 상세 보기</summary>
                <div class="enriched-content">
                  \${lead.keyFigures && lead.keyFigures.length > 0 ? \`<div class="enriched-block"><h4>핵심 수치</h4><ul>\${lead.keyFigures.map(f => \`<li>\${esc(f)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.painPoints && lead.painPoints.length > 0 ? \`<div class="enriched-block"><h4>고객 과제 (정량)</h4><ul>\${lead.painPoints.map(p => \`<li>\${esc(p)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.actionItems && lead.actionItems.length > 0 ? \`<div class="enriched-block"><h4>후속 실행 항목</h4><ul>\${lead.actionItems.map(a => \`<li>\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.meddic && Object.keys(lead.meddic).length > 0 ? \`<div class="enriched-block"><h4>MEDDIC 분석</h4><ul>
                    \${lead.meddic.budget ? \`<li><strong>예산:</strong> \${esc(lead.meddic.budget)}</li>\` : ''}
                    \${lead.meddic.authority ? \`<li><strong>의사결정:</strong> \${esc(lead.meddic.authority)}</li>\` : ''}
                    \${lead.meddic.need ? \`<li><strong>핵심 니즈:</strong> \${esc(lead.meddic.need)}</li>\` : ''}
                    \${lead.meddic.timeline ? \`<li><strong>타임라인:</strong> \${esc(lead.meddic.timeline)}</li>\` : ''}
                    \${lead.meddic.decisionProcess ? \`<li><strong>구매 프로세스:</strong> \${esc(lead.meddic.decisionProcess)}</li>\` : ''}
                    \${lead.meddic.champion ? \`<li><strong>챔피언:</strong> \${esc(lead.meddic.champion)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.competitive && Object.keys(lead.competitive).length > 0 ? \`<div class="enriched-block"><h4>경쟁 인텔리전스</h4><ul>
                    \${lead.competitive.currentVendor ? \`<li><strong>현재 벤더:</strong> \${esc(lead.competitive.currentVendor)}</li>\` : ''}
                    \${lead.competitive.competitors ? \`<li><strong>경쟁사:</strong> \${esc(lead.competitive.competitors)}</li>\` : ''}
                    \${lead.competitive.ourAdvantage ? \`<li><strong>우리 차별점:</strong> \${esc(lead.competitive.ourAdvantage)}</li>\` : ''}
                    \${lead.competitive.switchBarrier ? \`<li><strong>전환 장벽:</strong> \${esc(lead.competitive.switchBarrier)}</li>\` : ''}
                  </ul></div>\` : ''}
                  \${lead.buyingSignals && lead.buyingSignals.length > 0 ? \`<div class="enriched-block"><h4>구매 신호</h4><ul>\${lead.buyingSignals.map(s => \`<li>\${esc(s)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.evidence && lead.evidence.length > 0 ? \`<div class="enriched-block"><h4>근거 (Evidence)</h4><ul>\${lead.evidence.map(e => \`<li><strong>[\${esc(e.field)}]</strong> "\${esc(e.quote)}" \${e.sourceUrl ? \`<a href="\${safeUrl(e.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3498db;font-size:11px;">출처</a>\` : ''}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.assumptions && lead.assumptions.length > 0 ? \`<div class="enriched-block" style="background:#fff3cd;border-left:3px solid #f39c12;padding:8px 12px;"><h4 style="color:#856404;">가정 (Assumptions)</h4><ul>\${lead.assumptions.map(a => \`<li style="color:#856404;">\${esc(a)}</li>\`).join('')}</ul></div>\` : ''}
                  \${lead.enrichedAt ? \`<p style="color:#666;font-size:11px;margin-top:8px;">분석일: \${esc(lead.enrichedAt.split('T')[0])}</p>\` : ''}
                </div>
              </details>
            </div>\` : ''}
            \${lead.sources && lead.sources.length > 0 ? \`
            <div class="lead-sources">
              <details>
                <summary>출처 보기 (\${lead.sources.length}건)</summary>
                <ul>
                  \${lead.sources.map(s => \`<li><a href="\${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">\${esc(s.title)}</a></li>\`).join('')}
                </ul>
              </details>
            </div>\` : ''}
            \${lead.id ? \`
            <div class="notes-section">
              <details>
                <summary>수동 리뷰 메모 <span class="notes-summary-state" data-manual-note-summary-state>\${esc(getManualReviewNoteStateLabel(lead))}</span><span class="notes-saved">저장됨</span></summary>
                \${renderManualReviewNoteState(lead)}
                \${renderManualReviewNotePrivacyWarning()}
                <textarea class="notes-textarea" aria-label="수동 리뷰 메모 입력" placeholder="수동 리뷰 메모를 입력하세요..."
                  oninput="scheduleNoteSave('\${esc(lead.id)}', this)"
                  onblur="saveNotes('\${esc(lead.id)}', this)">\${esc(lead.manualReviewNotes || lead.notes || '')}</textarea>
                <div class="notes-actions">
                  <button type="button" class="notes-clear-btn" aria-label="저장된 수동 리뷰 메모 지우기"
                    onclick="clearManualReviewNotes('\${esc(lead.id)}', this)" \${(lead.manualReviewNotes || lead.notes) ? '' : 'disabled'}>지우기</button>
                </div>
              </details>
            </div>\` : ''}
            \${lead.id ? renderReviewerFeedbackControls(lead) : ''}
            <div class="lead-actions">
              <a href="\${esc(leadToolLink('/ppt', lead.id))}" class="btn btn-secondary">PPT 생성</a>
              <a href="\${esc(leadToolLink('/roleplay', lead.id))}" class="btn btn-secondary">영업 연습</a>
              \${lead.id && !lead.enriched ? \`<button class="btn-enrich" onclick="enrichLead('\${esc(lead.id)}', this)">상세 분석</button>\` : ''}
              \${lead.id && lead.enriched ? \`<button class="btn-enrich" style="opacity:0.6" onclick="enrichLead('\${esc(lead.id)}', this, true)" title="재분석">재분석</button>\` : ''}
            </div>
          </div>
        \`).join('');
    }

    function renderKanban(leads, totalBeforeFilter = cachedLeads.length) {
      const list = Array.isArray(leads) ? leads : [];
      const order = ['NEW','CONTACTED','MEETING','PROPOSAL','NEGOTIATION','WON','LOST'];
      const groups = {};
      order.forEach(s => groups[s] = []);
      list.forEach(l => { const s = l.status || 'NEW'; if (groups[s]) groups[s].push(l); });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      let html = list.length === 0 && totalBeforeFilter > 0
        ? renderFilterEmptyState('kanban-empty-state')
        : '';
      html += '<div class="kanban-board" style="max-width:100%;overflow-x:auto;">';
      order.forEach(s => {
        const cards = groups[s];
        html += '<div class="kanban-col">';
        html += '<div class="kanban-col-header" style="background:' + statusColors[s] + '">' + esc(statusLabels[s]) + '<span class="kanban-col-count">(' + cards.length + ')</span></div>';
        cards.forEach(l => {
          const gate = buildLeadListReviewGate(l);
          const action = getLeadQueueItem(l);
          const fu = l.followUpDate || '';
          const isWarn = fu && fu <= today;
          html += '<div class="kanban-card' + (isWarn ? ' followup-warn' : '') + '" data-lead-id="' + esc(l.id) + '" onclick="openLeadDetail(\\'' + esc(l.id) + '\\', event)">';
          html += '<div class="k-company">' + esc(l.company) + '</div>';
          html += '<div class="k-product">' + esc(l.product || l.summary || '-') + '</div>';
          html += '<div class="k-meta">';
          html += '<span class="k-score">' + esc(l.grade) + ' ' + l.score + '점</span>';
          if (l.estimatedValue) html += '<span class="k-value">' + l.estimatedValue.toLocaleString() + '만</span>';
          html += '</div>';
          if (fu) {
            html += '<div class="k-followup">' + (isWarn ? '⚠ ' : '') + esc(fu) + '</div>';
          }
          html += '<div class="k-review">' + esc(humanReviewStatusLabel(getReviewStatus(l))) + ' / ' + esc(verificationStatusLabels[getVerificationStatus(l)]) + '</div>';
          html += '<div class="k-gate gate-' + esc(gate.state) + '">' + esc(gate.label) + '</div>';
          html += '<div class="k-action priority-' + esc(action.reviewPriority) + '">다음 행동: ' + esc(reviewActionLabel(action)) + '</div>';
          html += '</div>';
        });
        if (cards.length === 0) html += '<p style="color:#555;font-size:11px;text-align:center;padding:20px 0;">없음</p>';
        html += '</div>';
      });
      html += '</div>';
      document.getElementById('kanbanView').innerHTML = html;
    }

`;
}
