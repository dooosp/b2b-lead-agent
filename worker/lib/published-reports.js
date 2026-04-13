import { canonicalizeLeadCollectionForProfile } from './profile.js';

const GITHUB_FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'B2B-Lead-Worker',
    'Cache-Control': 'no-cache'
  }
};

function buildPublishedSnapshotUrl(env, profileId) {
  return `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profileId}/latest-leads.json?t=${Date.now()}`;
}

export async function loadPublishedLatestSnapshot(env, profileId) {
  const response = await fetch(buildPublishedSnapshotUrl(env, profileId), GITHUB_FETCH_OPTIONS);
  if (response.status === 404) {
    return {
      found: false,
      profileId,
      leads: []
    };
  }
  if (!response.ok) {
    throw new Error(`Published snapshot fetch failed with status ${response.status}`);
  }

  const payload = await response.json();
  const canonicalized = canonicalizeLeadCollectionForProfile(profileId, payload);
  return {
    found: true,
    profileId: canonicalized.profileId,
    leads: canonicalized.leads
  };
}
