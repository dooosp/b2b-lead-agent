const MAX_PATCH_TEXT_BYTES = 256_000;
const SAFE_DOWNLOAD_NAME = /^official-evidence-review-patch_[a-f0-9]{1,64}\.json$/;

function assertCallback(value, name) {
  if (value !== undefined && typeof value !== 'function') throw new TypeError(`${name}_CALLBACK_REQUIRED`);
}

function assertPatchText(value) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('PATCH_TEXT_REQUIRED');
  if (new TextEncoder().encode(value).byteLength > MAX_PATCH_TEXT_BYTES) throw new TypeError('PATCH_TEXT_TOO_LARGE');
  return value;
}

export async function copyPatchText({ text, writeText, onCopied, onFallback } = {}) {
  const safeText = assertPatchText(text);
  assertCallback(onCopied, 'ON_COPIED');
  assertCallback(onFallback, 'ON_FALLBACK');
  try {
    if (typeof writeText !== 'function') throw new TypeError('CLIPBOARD_UNAVAILABLE');
    await writeText(safeText);
    onCopied?.();
    return 'COPIED';
  } catch {
    onFallback?.();
    return 'FALLBACK_SELECTED';
  }
}

export function downloadPatchText({
  text,
  filename,
  BlobConstructor,
  createObjectUrl,
  revokeObjectUrl,
  createLink,
  onStarted,
  onBlocked
} = {}) {
  const safeText = assertPatchText(text);
  if (typeof filename !== 'string' || !SAFE_DOWNLOAD_NAME.test(filename)) throw new TypeError('DOWNLOAD_FILENAME_REFUSED');
  for (const [name, callback] of Object.entries({ createObjectUrl, revokeObjectUrl, createLink, onStarted, onBlocked })) {
    assertCallback(callback, name.toUpperCase());
  }
  if (typeof BlobConstructor !== 'function' || !createObjectUrl || !revokeObjectUrl || !createLink) {
    throw new TypeError('DOWNLOAD_DEPENDENCY_REQUIRED');
  }

  let objectUrl = null;
  try {
    const blob = new BlobConstructor([safeText], { type: 'application/json' });
    objectUrl = createObjectUrl(blob);
    if (typeof objectUrl !== 'string' || !objectUrl.startsWith('blob:')) throw new TypeError('DOWNLOAD_OBJECT_URL_REFUSED');
    const link = createLink();
    if (!link || typeof link !== 'object' || typeof link.click !== 'function') throw new TypeError('DOWNLOAD_LINK_REFUSED');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    onStarted?.();
    return 'DOWNLOAD_STARTED';
  } catch {
    onBlocked?.();
    return 'DOWNLOAD_BLOCKED';
  } finally {
    if (objectUrl?.startsWith('blob:')) revokeObjectUrl(objectUrl);
  }
}
