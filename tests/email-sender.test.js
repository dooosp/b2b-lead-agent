const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const emailSender = require('../email-sender');
const publisher = require('../lead-report-publisher');
const { createRootLead, createRootProfile } = require('./helpers/root-fixtures');

function committedPublication(t, lead) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'email-publication-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const profile = createRootProfile({ name: 'Fixture & 기술 <팀>' });
  const reportsRoot = path.join(root, 'reports');
  const prepared = publisher.prepareLeadPublication([lead], profile, {
    reportsRoot,
    now: '2026-07-15T03:00:00.000Z',
  });
  publisher.commitLeadPublication(prepared, profile, { reportsRoot });
  return {
    profile,
    publication: publisher.readCommittedPublication(profile, { reportsRoot }),
  };
}

test('notification renders escaped HTML and independent plain text from public validated records', async (t) => {
  const fixture = committedPublication(t, createRootLead({
    company: '한국 <script>alert("x")</script> 기술',
    summary: '</p><img src=x onerror=alert(1)> & "quoted" Markdown **bold**',
    roi: '<img onerror=alert(2)> 20% & rising',
    salesPitch: '닫는 태그 </div>와 작은따옴표 \'를 문자로 검토',
    globalContext: '유니코드 냉각 기술 — 안전 검토',
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
  }));
  const calls = [];
  const transporter = {
    async sendMail(options) {
      calls.push(options);
      return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
    },
  };
  const result = await emailSender.sendPublicationNotification({
    ...fixture,
    transporter,
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });

  assert.equal(calls.length, 1);
  const message = calls[0];
  assert.ok(message.text.includes('<script>alert("x")</script>'));
  assert.ok(message.text.includes('유니코드 냉각 기술'));
  assert.ok(message.html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(message.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.doesNotMatch(message.html, /<script|<img/i);
  assert.match(message.html, /&amp;/);
  assert.ok(message.text.length > 0);
  assert.equal(result.state, 'ACCEPTED');
  assert.equal(result.recipientDeliveryConfirmed, false);
  assert.equal(result.deliveryGuarantee, 'PROVIDER_ACCEPTANCE_ONLY');
  assert.match(result.messageId, /^<lead-report-[a-f0-9]+@b2b-lead-agent\.local>$/);
});

test('transport failures are typed, safe, and not swallowed', async (t) => {
  const fixture = committedPublication(t, createRootLead({
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
  }));
  const secretBearingError = Object.assign(new Error('recipient@example.com password=DO_NOT_LEAK'), {
    code: 'EAUTH',
    response: '535 raw provider response',
  });
  await assert.rejects(
    () => emailSender.sendPublicationNotification({
      ...fixture,
      transporter: { async sendMail() { throw secretBearingError; } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => {
      assert.equal(error.code, 'ERR_NOTIFICATION_AUTH_FAILED');
      assert.equal(error.retryable, false);
      assert.doesNotMatch(error.message, /recipient|password|535|DO_NOT_LEAK/i);
      return true;
    },
  );
});

test('partial and ambiguous provider outcomes remain distinct from accepted notification', async (t) => {
  const fixture = committedPublication(t, createRootLead({
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
  }));
  await assert.rejects(
    () => emailSender.sendPublicationNotification({
      ...fixture,
      transporter: {
        async sendMail() {
          return { accepted: ['one@example.com'], rejected: ['two@example.com'] };
        },
      },
      config: {
        user: 'sender@example.com',
        recipients: ['one@example.com', 'two@example.com'],
      },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_PARTIAL'
      && error.acceptance === 'PARTIAL'
      && error.acceptedRecipientCount === 1,
  );

  const unknown = emailSender.classifyTransportError({
    code: 'ETIMEDOUT',
    command: 'DATA',
    message: 'raw secret-bearing timeout',
  });
  assert.equal(unknown.code, 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN');
  assert.equal(unknown.acceptance, 'UNKNOWN');
  assert.equal(unknown.retryable, null);
  assert.doesNotMatch(unknown.message, /secret/i);
});

test('successful multi-recipient BCC ignores the accepted sender envelope entry', async (t) => {
  const fixture = committedPublication(t, createRootLead({
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
  }));
  const result = await emailSender.sendPublicationNotification({
    ...fixture,
    transporter: {
      async sendMail(options) {
        assert.equal(options.to, 'sender@example.com');
        assert.deepEqual(options.bcc, ['one@example.com', 'two@example.com']);
        return {
          accepted: ['sender@example.com', 'one@example.com', 'two@example.com'],
          rejected: [],
          messageId: options.messageId,
        };
      },
    },
    config: {
      user: 'sender@example.com',
      recipients: ['one@example.com', 'two@example.com'],
    },
  });

  assert.equal(result.state, 'ACCEPTED');
  assert.equal(result.intendedRecipientCount, 2);
  assert.equal(result.acceptedRecipientCount, 2);
  assert.equal(result.rejectedRecipientCount, 0);
});

test('legacy direct send refuses to bypass the published-manifest boundary', async () => {
  await assert.rejects(
    () => emailSender.send({ content: '# raw' }, { id: 'fixture-profile' }),
    (error) => error.code === 'ERR_NOTIFICATION_REQUIRES_PUBLISHED_MANIFEST',
  );
});
