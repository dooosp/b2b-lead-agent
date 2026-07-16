import { canonicalizeLeadCollectionForProfile } from './profile.js';
import {
  PUBLISHED_ARTIFACT_KINDS,
  PUBLISHED_SNAPSHOT_MAX_LEADS,
  computePublishedSnapshotId,
  normalizePublishedLeadId,
  normalizePublishedProfileId,
} from '../db/published-snapshots.js';
import { fetchManifestSelectedArtifactJson } from './manifest-published-artifact.js';

export async function loadPublishedLatestSnapshot(env, profileId) {
  const normalizedProfileId = normalizePublishedProfileId(profileId);
  const selected = await fetchManifestSelectedArtifactJson(
    env,
    normalizedProfileId,
    PUBLISHED_ARTIFACT_KINDS.latest,
    'latest-leads.json',
    { maxTopLevelEntries: PUBLISHED_SNAPSHOT_MAX_LEADS.latest },
  );
  const { response } = selected;
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

  const payload = selected.payload;
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
