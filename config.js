const fs = require('fs');
const path = require('path');

const profilesDir = path.join(__dirname, 'profiles');

function loadProfile(profileId) {
  const filePath = path.join(profilesDir, `${profileId}.js`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`프로필 '${profileId}'을(를) 찾을 수 없습니다: ${filePath}`);
  }
  return require(filePath);
}

function listProfiles() {
  return fs.readdirSync(profilesDir)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .map(f => {
      const profile = require(path.join(profilesDir, f));
      return { id: profile.id, name: profile.name, industry: profile.industry };
    });
}

// 리드 상태 관리 (CRM) — 공통
const leadStatus = {
  NEW: '신규 발굴',
  CONTACTED: '컨택 완료',
  MEETING: '미팅 진행',
  PROPOSAL: '제안서 제출',
  NEGOTIATION: '협상 중',
  WON: '수주 성공',
  LOST: '실패/보류'
};

module.exports = { loadProfile, listProfiles, leadStatus };
