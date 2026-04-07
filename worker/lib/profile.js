import { escapeHtml } from './utils.js';

function normalizeProductToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s*([+/])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isSelfServiceProfileId(profileId) {
  return typeof profileId === 'string' && profileId.trim().startsWith('self-service:');
}

const MANAGED_PROFILE_PRODUCT_DEFINITIONS = {
  danfoss: {
    fallback: 'iC7 Marine 드라이브',
    canonicalProducts: [
      'iC7 Marine 드라이브',
      'Turbocor 컴프레서',
      'Turbocor 오일리스 칠러',
      'VLT AutomationDrive',
      'VLT HVAC Drive',
      'VACON NXP',
      'VACON 100',
      'DrivePro'
    ],
    aliases: {
      'iC7 Marine': 'iC7 Marine 드라이브',
      'iC7 Marine / 선박용 하이브리드 솔루션': 'iC7 Marine 드라이브',
      'Marine용 드라이브': 'iC7 Marine 드라이브',
      '선박용 하이브리드': 'iC7 Marine 드라이브',
      'VLT Drive': 'VLT AutomationDrive',
      'HVAC 인버터': 'VLT HVAC Drive',
      '냉각 솔루션': 'Turbocor 컴프레서',
      'Cooling 솔루션(Turbocor)': 'Turbocor 컴프레서'
    }
  },
  'ls-electric': {
    fallback: 'GSIS 가스절연개폐장치',
    canonicalProducts: [
      'GSIS 가스절연개폐장치',
      'MV 변압기',
      '배전반',
      'ACB/MCCB 차단기',
      'XGT PLC + XDL 서보',
      'XGT PLC',
      'XDL 서보드라이브',
      'iXP HMI',
      'SMART I/O',
      'ESS + 태양광 인버터',
      '태양광 인버터',
      'ESS(에너지저장장치)',
      'EV 충전기',
      'DC 마이크로그리드',
      'STATCOM 전력품질 솔루션',
      'SVC',
      'HVDC 시스템'
    ],
    aliases: {
      GSIS: 'GSIS 가스절연개폐장치',
      STATCOM: 'STATCOM 전력품질 솔루션',
      'XGT PLC/서보 시스템': 'XGT PLC + XDL 서보',
      'ESS/태양광 인버터': 'ESS + 태양광 인버터',
      ESS: 'ESS(에너지저장장치)'
    }
  },
  siemens: {
    fallback: 'Desigo CC 통합 빌딩관리',
    canonicalProducts: [
      'Desigo CC 통합 빌딩관리',
      'Building X',
      'APOGEE',
      'Climatix',
      'ESCO 에너지절감 + Building X',
      'ESCO 에너지절감 모델',
      'Building Performance',
      'Energy Analytics',
      'Cerberus PRO 화재감지',
      'Sinteso',
      'FC726 화재감지기',
      'Siveillance 통합보안',
      'Access Control',
      'Video Surveillance'
    ],
    aliases: {
      'Desigo CC': 'Desigo CC 통합 빌딩관리',
      'ESCO 모델': 'ESCO 에너지절감 모델',
      'Cerberus PRO': 'Cerberus PRO 화재감지',
      Siveillance: 'Siveillance 통합보안'
    }
  }
};

const MANAGED_PROFILE_PRODUCT_CATALOG = {};
const MANAGED_PRODUCT_OWNER_BY_TOKEN = new Map();

for (const [profileId, definition] of Object.entries(MANAGED_PROFILE_PRODUCT_DEFINITIONS)) {
  const canonicalProducts = Array.isArray(definition.canonicalProducts)
    ? definition.canonicalProducts.filter(Boolean)
    : [];
  const productByToken = new Map();

  for (const canonicalProduct of canonicalProducts) {
    productByToken.set(normalizeProductToken(canonicalProduct), canonicalProduct);
  }

  for (const [alias, canonicalProduct] of Object.entries(definition.aliases || {})) {
    productByToken.set(normalizeProductToken(alias), canonicalProduct);
  }

  MANAGED_PROFILE_PRODUCT_CATALOG[profileId] = {
    fallback: definition.fallback,
    productByToken,
  };

  for (const token of productByToken.keys()) {
    const existingOwner = MANAGED_PRODUCT_OWNER_BY_TOKEN.get(token);
    if (existingOwner === undefined) {
      MANAGED_PRODUCT_OWNER_BY_TOKEN.set(token, profileId);
    } else if (existingOwner !== profileId) {
      MANAGED_PRODUCT_OWNER_BY_TOKEN.set(token, null);
    }
  }
}

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

  if (isSelfServiceProfileId(candidate)) {
    const suffix = candidate.slice('self-service:'.length).trim();
    if (!suffix || suffix.length > 80) {
      return { ok: false, message: '유효하지 않은 self-service 프로필 형식입니다.' };
    }
    return { ok: true, profileId: `self-service:${suffix}`, profileType: 'self-service' };
  }

  const resolved = resolveProfileId(candidate, env);
  if (resolved !== candidate) {
    return { ok: false, message: `유효하지 않은 프로필입니다: ${candidate}` };
  }
  return { ok: true, profileId: resolved, profileType: 'managed' };
}

export function canonicalizeLeadProductForProfile(profileId, product) {
  const canonicalProfileId = typeof profileId === 'string' ? profileId.trim() : '';
  const rawProduct = typeof product === 'string' ? product.trim() : '';

  if (isSelfServiceProfileId(canonicalProfileId)) {
    return {
      profileId: canonicalProfileId,
      product: rawProduct,
      resolution: rawProduct ? 'pass-through' : 'empty',
      reason: rawProduct ? 'self-service' : 'empty-product',
    };
  }

  const catalog = MANAGED_PROFILE_PRODUCT_CATALOG[canonicalProfileId];
  if (!catalog) {
    return {
      profileId: canonicalProfileId,
      product: rawProduct,
      resolution: rawProduct ? 'pass-through' : 'empty',
      reason: rawProduct ? 'unknown-managed-profile' : 'empty-product',
    };
  }

  if (!rawProduct) {
    return {
      profileId: canonicalProfileId,
      product: catalog.fallback,
      resolution: 'fallback',
      reason: 'empty-product',
    };
  }

  const normalizedToken = normalizeProductToken(rawProduct);
  const canonicalProduct = catalog.productByToken.get(normalizedToken);
  if (canonicalProduct) {
    return {
      profileId: canonicalProfileId,
      product: canonicalProduct,
      resolution: canonicalProduct === rawProduct ? 'canonical' : 'normalized',
      reason: canonicalProduct === rawProduct ? 'exact-match' : 'alias-match',
    };
  }

  const owningProfileId = MANAGED_PRODUCT_OWNER_BY_TOKEN.get(normalizedToken);
  if (owningProfileId && owningProfileId !== canonicalProfileId) {
    return {
      profileId: canonicalProfileId,
      product: catalog.fallback,
      resolution: 'fallback',
      reason: `profile-mismatch:${owningProfileId}`,
    };
  }

  return {
    profileId: canonicalProfileId,
    product: catalog.fallback,
    resolution: 'fallback',
    reason: 'orphan-product',
  };
}

export function canonicalizeLeadForProfile(profileId, lead) {
  const canonicalProfileId = typeof profileId === 'string' ? profileId.trim() : '';
  const leadRecord = isPlainObject(lead) ? { ...lead } : {};
  const rawProduct = typeof leadRecord.product === 'string'
    ? leadRecord.product
    : (typeof leadRecord.recommended_product === 'string' ? leadRecord.recommended_product : '');
  const productResolution = canonicalizeLeadProductForProfile(canonicalProfileId, rawProduct);

  const canonicalLead = {
    ...leadRecord,
    profileId: canonicalProfileId,
    product: productResolution.product,
  };

  if (typeof leadRecord.recommended_product === 'string') {
    canonicalLead.recommended_product = productResolution.product;
  }

  return { lead: canonicalLead, productResolution };
}

export function canonicalizeLeadCollectionForProfile(profileId, leads) {
  const canonicalProfileId = typeof profileId === 'string' ? profileId.trim() : '';
  const inputLeads = Array.isArray(leads) ? leads : [];
  const canonicalized = inputLeads.map((lead) => canonicalizeLeadForProfile(canonicalProfileId, lead));

  return {
    profileId: canonicalProfileId,
    leads: canonicalized.map((entry) => entry.lead),
    fallbackCount: canonicalized.filter((entry) => entry.productResolution.resolution === 'fallback').length,
  };
}

export function renderProfileOptions(env) {
  return getProfilesFromEnv(env)
    .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join('');
}
