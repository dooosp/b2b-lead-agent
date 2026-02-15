import { escapeHtml } from './utils.js';

export function getProfilesFromEnv(env) {
  const fallback = [{ id: 'danfoss', name: '댄포스 코리아' }];
  try {
    const parsed = JSON.parse(env.PROFILES || JSON.stringify(fallback));
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const sanitized = parsed
      .filter(p => p && typeof p.id === 'string' && p.id.trim())
      .map(p => ({ id: p.id.trim(), name: String(p.name || p.id).trim() }));
    return sanitized.length > 0 ? sanitized : fallback;
  } catch {
    return fallback;
  }
}

export function resolveProfileId(profileId, env) {
  const profiles = getProfilesFromEnv(env);
  const fallbackId = profiles[0]?.id || 'danfoss';
  const candidate = typeof profileId === 'string' ? profileId.trim() : '';
  if (!candidate) return fallbackId;
  return profiles.some(p => p.id === candidate) ? candidate : fallbackId;
}

export function resolveLeadProfileForQuery(profileId, env) {
  const candidate = typeof profileId === 'string' ? profileId.trim() : '';
  if (!candidate) return { ok: true, profileId: resolveProfileId('', env) };

  if (candidate.startsWith('self-service:')) {
    const suffix = candidate.slice('self-service:'.length).trim();
    if (!suffix || suffix.length > 80) {
      return { ok: false, message: '유효하지 않은 self-service 프로필 형식입니다.' };
    }
    return { ok: true, profileId: `self-service:${suffix}` };
  }

  const resolved = resolveProfileId(candidate, env);
  if (resolved !== candidate) {
    return { ok: false, message: `유효하지 않은 프로필입니다: ${candidate}` };
  }
  return { ok: true, profileId: resolved };
}

export function renderProfileOptions(env) {
  return getProfilesFromEnv(env)
    .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join('');
}
