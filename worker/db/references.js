import { ensureD1Schema } from './schema.js';

export async function getReferencesByProfileCategory(db, profileId, category) {
  if (!db) return [];
  await ensureD1Schema(db);
  let sql = 'SELECT * FROM reference_library WHERE profile_id = ?';
  const params = [profileId];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  const { results } = await db.prepare(sql).bind(...params).all();
  return results || [];
}

export async function addReference(db, ref) {
  if (!db) return null;
  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reference_library (profile_id, category, client, project, result, source_url, region, verified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(ref.profileId, ref.category, ref.client, ref.project, ref.result, ref.sourceUrl || '', ref.region || '', ref.verifiedAt || '', now).run();
  return true;
}

export async function deleteReference(db, id) {
  if (!db) return false;
  await ensureD1Schema(db);
  await db.prepare('DELETE FROM reference_library WHERE id = ?').bind(id).run();
  return true;
}

export async function seedReferencesFromProfiles(db, profilesJson) {
  if (!db) return;
  await ensureD1Schema(db);
  const { results } = await db.prepare('SELECT COUNT(*) as cnt FROM reference_library').all();
  if (results && results[0] && results[0].cnt > 0) return;

  const SEED_DATA = {
    danfoss: {
      marine: [
        { client: 'Maersk (덴마크)', project: '컨테이너선 300척 하이브리드 추진 시스템 도입', result: '연료비 18% 절감, IMO 2030 규제 선제 대응', region: 'EU' },
        { client: 'MSC (스위스)', project: 'LNG 운반선 iC7 드라이브 적용', result: '탄소 배출 25% 감소, CII 등급 A 달성', region: 'EU' },
        { client: 'NYK Line (일본)', project: '친환경 선박 플릿 현대화', result: 'EEXI 규제 100% 충족, 연간 $2M 연료비 절감', region: 'APAC' }
      ],
      datacenter: [
        { client: 'Equinix (미국)', project: '글로벌 데이터센터 Turbocor 표준화', result: 'PUE 1.58→1.25 개선, 냉각 전력 40% 절감', region: 'US' },
        { client: 'Digital Realty (미국)', project: '아시아 데이터센터 냉각 시스템 교체', result: '연간 운영비 $1.5M 절감', region: 'US' },
        { client: 'NTT (일본)', project: '도쿄 DC 오일리스 칠러 도입', result: '유지보수 비용 60% 감소, 가동률 99.99%', region: 'APAC' }
      ],
      factory: [
        { client: 'Volkswagen (독일)', project: 'EV 배터리 공장 VLT 드라이브 적용', result: '생산 라인 에너지 35% 절감', region: 'EU' },
        { client: 'TSMC (대만)', project: '반도체 클린룸 HVAC 최적화', result: '공조 전력 28% 절감, 정밀 온습도 제어', region: 'APAC' },
        { client: 'Samsung SDI (한국)', project: '헝가리 배터리 공장 자동화', result: '모터 효율 25% 향상, RE100 달성 기여', region: 'KR' }
      ],
      coldchain: [
        { client: 'Lineage Logistics (미국)', project: '세계 최대 냉동창고 Turbocor 도입', result: '에너지 비용 32% 절감', region: 'US' },
        { client: 'Pfizer (미국)', project: '백신 콜드체인 정밀 온도 제어', result: '-70°C 유지 안정성 99.9%, FDA 승인', region: 'US' },
        { client: 'CJ대한통운 (한국)', project: '신선식품 물류센터 현대화', result: '냉각 효율 30% 개선, 식품 손실률 50% 감소', region: 'KR' }
      ]
    },
    'ls-electric': {
      power: [
        { client: 'Saudi Aramco (사우디)', project: '자나인 변전소 GIS 공급', result: '중동 최대 154kV GIS 납품, 3년 무장애 운영', region: 'ME' },
        { client: 'KEPCO (한국)', project: '345kV 변전소 현대화', result: '설치면적 60% 축소, 연간 유지비 40% 절감', region: 'KR' },
        { client: 'PLN (인도네시아)', project: '자카르타 배전망 현대화', result: '정전율 35% 감소, 전력손실 8% 개선', region: 'APAC' }
      ],
      automation: [
        { client: 'LG에너지솔루션 (한국)', project: '배터리 공장 XGT PLC 표준화', result: '생산 사이클 15% 단축, 불량률 절반', region: 'KR' },
        { client: '포스코 (한국)', project: '제철소 서보 드라이브 교체', result: '정밀도 향상, 에너지 22% 절감', region: 'KR' },
        { client: 'Hyundai Motors (한국)', project: 'EV 조립 라인 자동화', result: 'UPH 20% 향상, 다품종 유연 생산', region: 'KR' }
      ],
      green: [
        { client: 'Hanwha Q Cells (한국)', project: '100MW 태양광 발전소 인버터 공급', result: '변환효율 98.6%, 10년 무상 보증', region: 'KR' },
        { client: '한국전력 (한국)', project: '제주 ESS 실증 프로젝트', result: '신재생 출력 변동 80% 안정화', region: 'KR' },
        { client: 'SK E&S (한국)', project: 'EV 충전 인프라 350kW 급속충전', result: '충전 시간 18분, 가동률 99.5%', region: 'KR' }
      ],
      grid: [
        { client: 'State Grid (중국)', project: 'HVDC 송전 프로젝트', result: '전력 손실 3% 미만, 500km 장거리 송전', region: 'APAC' },
        { client: 'KEPCO (한국)', project: 'STATCOM 전력품질 개선', result: '전압 변동 90% 감소, 플리커 해소', region: 'KR' },
        { client: 'EGAT (태국)', project: '방콕 전력망 SVC 설치', result: '역률 0.99 달성, 계통 안정성 확보', region: 'APAC' }
      ]
    }
  };

  const now = new Date().toISOString();
  const stmts = [];
  for (const [profileId, categories] of Object.entries(SEED_DATA)) {
    for (const [category, refs] of Object.entries(categories)) {
      for (const ref of refs) {
        stmts.push(
          db.prepare(
            `INSERT INTO reference_library (profile_id, category, client, project, result, source_url, region, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(profileId, category, ref.client, ref.project, ref.result, '', ref.region || '', '', now)
        );
      }
    }
  }
  if (stmts.length > 0) await db.batch(stmts);
}

export async function getReferencesForPrompt(db, profileId, categories) {
  if (!db || !profileId) return '';
  try {
    await seedReferencesFromProfiles(db);
    const cats = Array.isArray(categories) ? categories : [];
    let allRefs = [];
    for (const cat of cats) {
      const refs = await getReferencesByProfileCategory(db, profileId, cat);
      if (refs.length > 0) {
        const caseList = refs.slice(0, 3).map(r => {
          const sourceNote = r.source_url ? `(출처: ${r.source_url})` : '(출처 미확인)';
          return `  • ${r.client}: ${r.project} → ${r.result} ${sourceNote}`;
        }).join('\n');
        allRefs.push(`[${cat.toUpperCase()}]\n${caseList}`);
      }
    }
    return allRefs.join('\n\n');
  } catch {
    return '';
  }
}
