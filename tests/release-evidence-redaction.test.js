const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REDACTION_LABELS,
  redactEvidence,
  redactText
} = require('../scripts/release-evidence-redactor');

test('redactEvidence removes auth material, database ids, private URLs, and PII-like fields', () => {
  const input = {
    repo: 'dooosp/b2b-lead-agent',
    githubUrl: 'https://github.com/dooosp/b2b-lead-agent/pull/34',
    d1DatabaseId: '11111111-2222-4333-8444-555555555555',
    headers: {
      Authorization: 'Bearer super-secret-token-value',
      'X-API-Key': 'abc123-private-key',
      Cookie: 'sessionid=secret-session; theme=dark'
    },
    callbackToken: 'cbtok_1234567890abcdef',
    privateUrl: 'http://127.0.0.1:8787/api/leads?token=abc123',
    contactEmail: 'buyer@example.com',
    author: 'Release Owner',
    phoneNumber: '+1 (415) 555-0101',
    notes: 'Authorization: Bearer abc.def.ghi\nCookie: sid=abc\ninternal URL http://10.0.0.4/admin?api_key=secret'
  };

  const redacted = redactEvidence(input);

  assert.equal(redacted.repo, 'dooosp/b2b-lead-agent');
  assert.equal(redacted.githubUrl, input.githubUrl);
  assert.equal(redacted.d1DatabaseId, REDACTION_LABELS.databaseId);
  assert.equal(redacted.headers.Authorization, REDACTION_LABELS.authHeader);
  assert.equal(redacted.headers['X-API-Key'], REDACTION_LABELS.token);
  assert.equal(redacted.headers.Cookie, REDACTION_LABELS.cookie);
  assert.equal(redacted.callbackToken, REDACTION_LABELS.token);
  assert.equal(redacted.privateUrl, REDACTION_LABELS.privateUrl);
  assert.equal(redacted.contactEmail, REDACTION_LABELS.pii);
  assert.equal(redacted.author, REDACTION_LABELS.pii);
  assert.equal(redacted.phoneNumber, REDACTION_LABELS.pii);
  assert.match(redacted.notes, /\[REDACTED:AUTH_HEADER\]/);
  assert.match(redacted.notes, /\[REDACTED:COOKIE\]/);
  assert.match(redacted.notes, /\[REDACTED:PRIVATE_URL\]/);
  assert.doesNotMatch(JSON.stringify(redacted), /super-secret-token-value|secret-session|buyer@example\.com|10\.0\.0\.4/);
});

test('redactText redacts sensitive inline values while preserving non-sensitive GitHub links', () => {
  const text = [
    'Evidence link: https://github.com/dooosp/b2b-lead-agent/issues/34',
    'Authorization: Bearer abc.def.ghi',
    'Set-Cookie: sid=secret',
    'D1_DATABASE_ID=11111111-2222-4333-8444-555555555555',
    'Contact: release.owner@example.com',
    'Private callback: https://internal.example.test/callback?token=secret'
  ].join('\n');

  const redacted = redactText(text);

  assert.match(redacted, /https:\/\/github\.com\/dooosp\/b2b-lead-agent\/issues\/34/);
  assert.match(redacted, /\[REDACTED:AUTH_HEADER\]/);
  assert.match(redacted, /\[REDACTED:COOKIE\]/);
  assert.match(redacted, /\[REDACTED:DATABASE_ID\]/);
  assert.match(redacted, /\[REDACTED:PII\]/);
  assert.match(redacted, /\[REDACTED:PRIVATE_URL\]/);
  assert.doesNotMatch(redacted, /abc\.def\.ghi|sid=secret|11111111|release\.owner@example\.com|internal\.example\.test/);
});
