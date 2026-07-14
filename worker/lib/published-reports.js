import { canonicalizeLeadCollectionForProfile } from './profile.js';
import {
  PUBLISHED_ARTIFACT_KINDS,
  PUBLISHED_SNAPSHOT_MAX_LEADS,
  computePublishedSnapshotId,
  normalizePublishedLeadId,
  normalizePublishedProfileId,
} from '../db/published-snapshots.js';
import { readBoundedPublishedArtifactJson } from './published-artifact-json.js';

const GITHUB_FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'B2B-Lead-Worker',
    'Cache-Control': 'no-cache'
  }
};

function buildPublishedSnapshotUrl(env, profileId) {
  return `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/`
    + `${encodeURIComponent(profileId)}/latest-leads.json?t=${Date.now()}`;
}

export async function loadPublishedLatestSnapshot(env, profileId) {
  const normalizedProfileId = normalizePublishedProfileId(profileId);
  const response = await fetch(
    buildPublishedSnapshotUrl(env, normalizedProfileId),
    GITHUB_FETCH_OPTIONS
  );
  if (response.status === 404) {
    return {
      found: false,
      profileId: normalizedProfileId,
      leads: []
    };
  }
  if (!response.ok) {
    throw new Error(`Published snapshot fetch failed with status ${response.status}`);
  }

  const payload = await readBoundedPublishedArtifactJson(response, {
    maxTopLevelEntries: PUBLISHED_SNAPSHOT_MAX_LEADS.latest,
  });
  const canonicalized = canonicalizeLeadCollectionForProfile(normalizedProfileId, payload);
  const leads = canonicalized.leads.map((lead) => ({
    ...lead,
    id: normalizePublishedLeadId(lead.id),
  }));
  // The frozen internal contract does not persist this snapshot, but it must
  // prove the same projected byte, route-safe id, and unique-id invariants as
  // the managed latest cache before it can claim syncReady.
  computePublishedSnapshotId(
    canonicalized.profileId,
    PUBLISHED_ARTIFACT_KINDS.latest,
    leads
  );
  return {
    found: true,
    profileId: canonicalized.profileId,
    leads
  };
}
