const crypto = require('crypto');
const nodemailer = require('nodemailer');

const MAX_NOTIFICATION_LEADS = 90;
const MAX_NOTIFICATION_FIELD_CHARS = 4000;

function normalizeNotificationText(value, maxLength = MAX_NOTIFICATION_FIELD_CHARS) {
  const text = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function singleLine(value, maxLength = 200) {
  return normalizeNotificationText(value, maxLength).replace(/\n+/g, ' ');
}

function escapeHtml(value) {
  return normalizeNotificationText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

function normalizeRecipients(value) {
  const candidates = Array.isArray(value) ? value : String(value || '').split(',');
  const recipients = [...new Set(candidates.map((item) => singleLine(item, 320)).filter(Boolean))];
  if (
    recipients.length === 0
    || recipients.some((recipient) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))
  ) {
    throw createNotificationError({
      code: 'ERR_NOTIFICATION_CONFIG_INVALID',
      retryable: false,
      acceptance: 'NOT_ATTEMPTED',
      safeMessage: 'Notification recipient configuration is invalid.',
    });
  }
  return recipients.sort();
}

function createNotificationKey(publicationId, recipients) {
  const recipientDigest = crypto.createHash('sha256').update(recipients.join('\n')).digest('hex');
  return crypto.createHash('sha256')
    .update(`${publicationId}:lead-report:v1:${recipientDigest}`)
    .digest('hex');
}

function createNotificationError({
  code = 'ERR_NOTIFICATION_FAILED',
  retryable = false,
  acceptance = 'NOT_ACCEPTED',
  safeMessage = 'Notification provider did not accept the message.',
  acceptedRecipientCount = 0,
  rejectedRecipientCount = 0,
} = {}) {
  const error = new Error(safeMessage);
  error.name = 'NotificationError';
  error.code = code;
  error.retryable = retryable;
  error.acceptance = acceptance;
  error.safeMessage = safeMessage;
  error.acceptedRecipientCount = acceptedRecipientCount;
  error.rejectedRecipientCount = rejectedRecipientCount;
  return error;
}

function classifyTransportError(error) {
  const code = String(error && error.code || '').toUpperCase();
  const command = String(error && error.command || '').toUpperCase();
  const responseCode = Number(error && error.responseCode);
  if (code === 'EAUTH') {
    return createNotificationError({
      code: 'ERR_NOTIFICATION_AUTH_FAILED',
      retryable: false,
      safeMessage: 'Notification provider authentication failed.',
    });
  }
  if (code === 'EENVELOPE' || (responseCode >= 500 && responseCode <= 599)) {
    return createNotificationError({
      code: 'ERR_NOTIFICATION_REJECTED',
      retryable: false,
      safeMessage: 'Notification provider rejected the message.',
    });
  }
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(code) && ['DATA', 'DOT'].includes(command)) {
    return createNotificationError({
      code: 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN',
      retryable: null,
      acceptance: 'UNKNOWN',
      safeMessage: 'Notification provider acceptance is unknown.',
    });
  }
  return createNotificationError({
    code: 'ERR_NOTIFICATION_TRANSIENT',
    retryable: responseCode >= 400 && responseCode <= 499 ? true : true,
    safeMessage: 'Notification transport failed before confirmed acceptance.',
  });
}

function assertPublicPublication(publication) {
  if (
    !publication
    || !publication.manifest
    || !/^pub-[a-f0-9]{32}$/.test(publication.manifest.publicationId || '')
    || !Array.isArray(publication.latest)
    || publication.latest.length > MAX_NOTIFICATION_LEADS
  ) {
    throw createNotificationError({
      code: 'ERR_NOTIFICATION_PUBLICATION_INVALID',
      retryable: false,
      acceptance: 'NOT_ATTEMPTED',
      safeMessage: 'Notification publication input is invalid.',
    });
  }
  return publication;
}

function publicNotificationLead(lead) {
  return {
    company: singleLine(lead && lead.company),
    score: Number.isFinite(lead && lead.score) ? lead.score : null,
    grade: ['A', 'B'].includes(singleLine(lead && lead.grade)) ? singleLine(lead.grade) : '',
    summary: normalizeNotificationText(lead && lead.summary),
    product: normalizeNotificationText(lead && lead.product),
    roi: normalizeNotificationText(lead && lead.roi),
    recommendedMessage: normalizeNotificationText(
      lead && (lead.recommendedMessage || lead.salesPitch)
    ),
    globalContext: normalizeNotificationText(lead && lead.globalContext),
    verificationStatus: singleLine(lead && lead.verificationStatus),
  };
}

function buildNotificationContent(publication, profile) {
  assertPublicPublication(publication);
  const profileName = singleLine(profile && profile.name || publication.manifest.profileId, 160);
  const leads = publication.latest.map(publicNotificationLead);
  const subject = `[${profileName}] B2B 리드 리포트 - ${publication.manifest.reportDate}`;
  const textLines = [
    `${profileName} B2B 리드 리포트`,
    `발행 ID: ${publication.manifest.publicationId}`,
    `검증된 공개 리드: ${leads.length}건`,
    '',
  ];
  const htmlCards = [];
  for (const lead of leads) {
    textLines.push(`${lead.company} (${lead.grade || '-'}, ${lead.score ?? '-'}점)`);
    textLines.push(`프로젝트: ${lead.summary || '-'}`);
    textLines.push(`추천 제품: ${lead.product || '-'}`);
    textLines.push(`예상 ROI: ${lead.roi || '-'}`);
    textLines.push(`추천 메시지: ${lead.recommendedMessage || '-'}`);
    textLines.push(`글로벌 맥락: ${lead.globalContext || '-'}`);
    textLines.push(`검증 상태: ${lead.verificationStatus || '-'}`, '');

    htmlCards.push(`
      <section class="lead-card">
        <h2>${escapeHtml(lead.company)} (${escapeHtml(lead.grade || '-')}, ${escapeHtml(lead.score ?? '-')}점)</h2>
        <p><strong>프로젝트:</strong> ${escapeHtml(lead.summary || '-')}</p>
        <p><strong>추천 제품:</strong> ${escapeHtml(lead.product || '-')}</p>
        <p><strong>예상 ROI:</strong> ${escapeHtml(lead.roi || '-')}</p>
        <p><strong>추천 메시지:</strong> ${escapeHtml(lead.recommendedMessage || '-')}</p>
        <p><strong>글로벌 맥락:</strong> ${escapeHtml(lead.globalContext || '-')}</p>
        <p><strong>검증 상태:</strong> ${escapeHtml(lead.verificationStatus || '-')}</p>
      </section>`);
  }

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>
body{font-family:Arial,"Malgun Gothic",sans-serif;color:#222;max-width:800px;margin:0 auto;padding:20px}
h1{font-size:24px;border-bottom:2px solid #444;padding-bottom:10px}.lead-card{border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0}.lead-card h2{font-size:18px}.lead-card p{line-height:1.5}
</style></head><body>
<h1>${escapeHtml(profileName)} B2B 리드 리포트</h1>
<p>발행 ID: ${escapeHtml(publication.manifest.publicationId)}</p>
<p>검증된 공개 리드: ${leads.length}건</p>
${htmlCards.join('\n')}
</body></html>`;

  return {
    subject,
    text: textLines.join('\n').trimEnd(),
    html,
    leads,
  };
}

function createTransport(config = {}) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

async function sendPublicationNotification({
  publication,
  profile,
  config = {},
  transporter = null,
} = {}) {
  assertPublicPublication(publication);
  const recipients = normalizeRecipients(
    config.recipients || (profile && profile.emailRecipients) || process.env.GMAIL_RECIPIENT
  );
  const sender = singleLine(config.user || process.env.GMAIL_USER, 320);
  const password = config.pass || process.env.GMAIL_PASS;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender) || (!transporter && !password)) {
    throw createNotificationError({
      code: 'ERR_NOTIFICATION_CONFIG_INVALID',
      retryable: false,
      acceptance: 'NOT_ATTEMPTED',
      safeMessage: 'Notification sender configuration is invalid.',
    });
  }
  const notificationKey = createNotificationKey(publication.manifest.publicationId, recipients);
  const messageId = `<lead-report-${notificationKey.slice(0, 40)}@b2b-lead-agent.local>`;
  const content = buildNotificationContent(publication, profile);
  const mailer = transporter || createTransport({ user: sender, pass: password });

  let info;
  try {
    info = await mailer.sendMail({
      from: `B2B Lead Agent <${sender}>`,
      ...(recipients.length === 1 ? { to: recipients[0] } : { to: sender, bcc: recipients }),
      subject: content.subject,
      text: content.text,
      html: content.html,
      messageId,
    });
  } catch (error) {
    if (error && error.name === 'NotificationError') throw error;
    throw classifyTransportError(error);
  }

  const normalizeEnvelopeAddress = (value) => singleLine(
    value && typeof value === 'object' ? value.address : value,
    320,
  ).toLowerCase();
  const intendedRecipients = new Set(recipients.map((recipient) => recipient.toLowerCase()));
  const acceptedAddresses = Array.isArray(info && info.accepted)
    ? new Set(info.accepted.map(normalizeEnvelopeAddress).filter(Boolean))
    : null;
  const rejectedAddresses = Array.isArray(info && info.rejected)
    ? new Set(info.rejected.map(normalizeEnvelopeAddress).filter(Boolean))
    : new Set();
  if (!acceptedAddresses) {
    throw createNotificationError({
      code: 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN',
      retryable: null,
      acceptance: 'UNKNOWN',
      safeMessage: 'Notification provider acceptance is unknown.',
    });
  }
  const acceptedCount = [...intendedRecipients]
    .filter((recipient) => acceptedAddresses.has(recipient)).length;
  const rejectedCount = [...intendedRecipients]
    .filter((recipient) => rejectedAddresses.has(recipient))
    .length;
  if (rejectedCount > 0 || acceptedCount !== recipients.length) {
    throw createNotificationError({
      code: 'ERR_NOTIFICATION_PARTIAL',
      retryable: false,
      acceptance: 'PARTIAL',
      safeMessage: 'Notification provider accepted only part of the recipient set.',
      acceptedRecipientCount: acceptedCount,
      rejectedRecipientCount: rejectedCount || recipients.length - acceptedCount,
    });
  }

  return {
    state: 'ACCEPTED',
    acceptance: 'ACCEPTED',
    notificationKey,
    messageId,
    intendedRecipientCount: recipients.length,
    acceptedRecipientCount: acceptedCount,
    rejectedRecipientCount: 0,
    retryable: false,
    recipientDeliveryConfirmed: false,
    deliveryGuarantee: 'PROVIDER_ACCEPTANCE_ONLY',
  };
}

async function send() {
  throw createNotificationError({
    code: 'ERR_NOTIFICATION_REQUIRES_PUBLISHED_MANIFEST',
    retryable: false,
    acceptance: 'NOT_ATTEMPTED',
    safeMessage: 'Notification requires a verified remotely published manifest.',
  });
}

module.exports = {
  buildNotificationContent,
  classifyTransportError,
  createNotificationKey,
  createNotificationError,
  escapeHtml,
  normalizeNotificationText,
  normalizeRecipients,
  send,
  sendPublicationNotification,
};
