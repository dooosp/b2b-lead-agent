import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchLeads, handleUpdateLead } from '../api/leads.js';
import { getLeadById, saveLeadsBatch } from '../db/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLead, createLeadRow } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

async function patchLead(db, payload, leadId = 'lead-1') {
  const request = createWorkerRequest(`/api/leads/${leadId}`, { method: 'PATCH', json: payload });
  return handleUpdateLead(request, { DB: db }, leadId);
}

test('manualReviewNotes PATCH persists human-entered notes with manual provenance', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });

  const response = await patchLead(db, {
    manualReviewNotes: 'Human-entered review note: confirm buyer before outreach.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['manualReviewNotes']);
  assert.equal(payload.lead.manualReviewNotes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(payload.lead.notes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(payload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(lead.manualReviewNotes, 'Human-entered review note: confirm buyer before outreach.');
  assert.equal(lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(db.leads.get('lead-1').notes, 'Human-entered review note: confirm buyer before outreach.');
});

test('manualReviewNotes PATCH edits an existing human-entered note', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Initial human review note.' })] });

  const response = await patchLead(db, {
    manualReviewNotes: 'Updated human review note after second pass.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['manualReviewNotes']);
  assert.equal(payload.lead.manualReviewNotes, 'Updated human review note after second pass.');
  assert.equal(payload.lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(lead.manualReviewNotes, 'Updated human review note after second pass.');
  assert.equal(db.leads.get('lead-1').notes, 'Updated human review note after second pass.');
});

test('manualReviewNotes PATCH clears an existing human-entered note', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Saved note to clear.' })] });

  const response = await patchLead(db, {
    manualReviewNotes: '',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.changedFields, ['manualReviewNotes']);
  assert.equal(payload.lead.manualReviewNotes, '');
  assert.equal(payload.lead.notes, '');
  assert.equal(payload.lead.manualReviewNotesProvenance, '');
  assert.equal(lead.manualReviewNotes, '');
  assert.equal(lead.manualReviewNotesProvenance, '');
  assert.equal(db.leads.get('lead-1').notes, '');
});

test('manualReviewNotes is exposed on local read paths without saving generated suggestions', async () => {
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Saved by a human reviewer.',
        review_status: 'APPROVED',
        verification_status: 'verified',
        confidence: 'HIGH',
        sources: JSON.stringify([{ title: 'Fixture source', url: 'https://example.com/fixture' }]),
        sales_pitch: 'Prepare the human-reviewed follow-up.',
        urgency_reason: 'Procurement review is active now.',
        evidence: JSON.stringify([{ field: 'summary', quote: 'Approved evidence quote', sourceUrl: 'https://example.com/fixture' }]),
      }),
    ],
  });

  const response = await fetchLeads(
    {
      DB: db,
      GITHUB_REPO: 'dooosp/b2b-lead-agent',
    },
    'danfoss'
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.source, 'd1');
  assert.equal(payload.leads[0].manualReviewNotes, 'Saved by a human reviewer.');
  assert.equal(payload.leads[0].manualReviewNotesProvenance, 'human_entered');
  assert.equal(payload.leads[0].reviewNoteSuggestion, undefined);
  assert.equal(payload.reviewerActionQueue.items[0].reviewNoteSuggestion.state, 'APPROVED');
  assert.match(payload.reviewerActionQueue.items[0].reviewNoteSuggestion.text, /Decision: APPROVED/);
  assert.equal(db.leads.get('lead-1').notes, 'Saved by a human reviewer.');
});

test('generated reviewer note suggestion persistence attempts are rejected atomically', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Keep human note' })] });

  const response = await patchLead(db, {
    reviewNoteSuggestion: {
      state: 'APPROVED',
      text: 'Decision: APPROVED. Generated helper text should not save.',
    },
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /copy-only/);
  assert.equal(lead.manualReviewNotes, 'Keep human note');
  assert.equal(db.leads.get('lead-1').notes, 'Keep human note');

  const templatesResponse = await patchLead(db, {
    reviewNoteTemplates: [
      { state: 'APPROVED', text: 'Generated template text should not save.' },
    ],
  });
  const templatesPayload = await templatesResponse.json();

  assert.equal(templatesResponse.status, 400);
  assert.equal(templatesPayload.success, false);
  assert.match(templatesPayload.message, /copy-only/);
  assert.equal(db.leads.get('lead-1').notes, 'Keep human note');
});

test('generated suggestion persistence attempts cannot clear manual review notes', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Keep this human-entered note.' })] });

  const response = await patchLead(db, {
    manualReviewNotes: '',
    generatedReviewerNoteSuggestion: 'Generated helper text cannot drive clearing.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /copy-only/);
  assert.equal(lead.manualReviewNotes, 'Keep this human-entered note.');
  assert.equal(lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(db.leads.get('lead-1').notes, 'Keep this human-entered note.');
});

test('lead refresh preserves existing human-entered notes and ignores generated note fields', async () => {
  const db = new FakeD1Database({
    leads: [
      createLeadRow({
        notes: 'Do not overwrite this human-entered note.',
        confidence: 'MEDIUM',
      }),
    ],
  });

  await saveLeadsBatch(db, [
    createLead({
      id: 'lead-1',
      identityKey: 'identity-1',
      company: 'Acme Corp',
      summary: 'Updated generated lead signal',
      notes: 'Generated helper text must not overwrite the manual note.',
      reviewNoteSuggestion: {
        text: 'Generated helper text must not persist.',
      },
      confidence: 'HIGH',
      evidence: [{ field: 'summary', quote: 'Updated evidence quote' }],
    }),
  ], 'danfoss', 'managed');

  const lead = await getLeadById(db, 'lead-1');

  assert.equal(db.leads.size, 1);
  assert.equal(lead.manualReviewNotes, 'Do not overwrite this human-entered note.');
  assert.equal(lead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(lead.reviewNoteSuggestion, undefined);
  assert.equal(db.leads.get('lead-1').notes, 'Do not overwrite this human-entered note.');
  assert.equal(db.leads.get('lead-1').confidence, 'HIGH');
});

test('generated batch inserts do not create saved manual review notes', async () => {
  const db = new FakeD1Database();

  await saveLeadsBatch(db, [
    createLead({
      id: 'generated-lead-1',
      identityKey: 'generated-identity-1',
      company: 'Generated Corp',
      summary: 'Generated lead signal',
      notes: 'Generated note-like text should not become a saved manual note.',
      manualReviewNotes: 'Generated manualReviewNotes-like text should not persist.',
      reviewNoteSuggestion: {
        text: 'Generated helper text should not persist.',
      },
    }),
  ], 'danfoss', 'managed');

  const lead = await getLeadById(db, 'generated-lead-1');

  assert.equal(db.leads.get('generated-lead-1').notes, '');
  assert.equal(lead.manualReviewNotes, '');
  assert.equal(lead.manualReviewNotesProvenance, '');
  assert.equal(lead.reviewNoteSuggestion, undefined);
});

test('conflicting manualReviewNotes and legacy notes payloads are rejected', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow({ notes: 'Original human note' })] });

  const response = await patchLead(db, {
    manualReviewNotes: 'Human note from explicit field.',
    notes: 'Different legacy note value.',
  });
  const payload = await response.json();
  const lead = await getLeadById(db, 'lead-1');

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /manualReviewNotes and notes must match/);
  assert.equal(lead.manualReviewNotes, 'Original human note');
});
