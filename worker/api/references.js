import { jsonResponse } from '../lib/utils.js';
import { getReferencesByProfileCategory, addReference, deleteReference } from '../db/references.js';

export async function handleGetReferences(env, url) {
  const profile = url.searchParams.get('profile') || '';
  const category = url.searchParams.get('category') || '';
  const refs = await getReferencesByProfileCategory(env.DB, profile, category || null);
  return jsonResponse({ success: true, references: refs });
}

export async function handleAddReference(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.profileId || !body.category || !body.client || !body.project || !body.result) {
    return jsonResponse({ success: false, message: 'profileId, category, client, project, result 필수' }, 400);
  }
  await addReference(env.DB, body);
  return jsonResponse({ success: true, message: '레퍼런스 추가 완료' });
}

export async function handleDeleteReference(env, refId) {
  await deleteReference(env.DB, refId);
  return jsonResponse({ success: true, message: '레퍼런스 삭제 완료' });
}
