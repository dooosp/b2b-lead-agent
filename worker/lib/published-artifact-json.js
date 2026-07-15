export const PUBLISHED_ARTIFACT_REMOTE_MAX_BYTES = 10_000_000;
export const PUBLISHED_ARTIFACT_REMOTE_MAX_STRUCTURAL_TOKENS = 100_000;
export const PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH = 32;

export const PUBLISHED_ARTIFACT_REMOTE_BODY_CODE = 'ERR_PUBLISHED_ARTIFACT_REMOTE_BODY';
export const PUBLISHED_ARTIFACT_REMOTE_BYTES_CODE = 'ERR_PUBLISHED_ARTIFACT_REMOTE_BYTES';
export const PUBLISHED_ARTIFACT_REMOTE_CARDINALITY_CODE =
  'ERR_PUBLISHED_ARTIFACT_REMOTE_CARDINALITY';
export const PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE =
  'ERR_PUBLISHED_ARTIFACT_REMOTE_STRUCTURE';

function remoteArtifactError(message, code = PUBLISHED_ARTIFACT_REMOTE_BODY_CODE) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertScannerLimit(name, value, { allowZero = true } = {}) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
}

function isJsonWhitespace(character) {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t';
}

/**
 * Performs an allocation-bounded scan before JSON.parse. This is not a second
 * JSON parser: JSON.parse still owns grammar validation. The scan proves that
 * the root is one array and bounds the shapes that can amplify into millions
 * of JavaScript objects from an otherwise byte-bounded compact document.
 */
export function assertPublishedArtifactJsonComplexity(text, {
  maxTopLevelEntries,
  maxStructuralTokens = PUBLISHED_ARTIFACT_REMOTE_MAX_STRUCTURAL_TOKENS,
  maxNestingDepth = PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH,
} = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('Published artifact JSON complexity input must be a string');
  }
  assertScannerLimit('maxTopLevelEntries', maxTopLevelEntries);
  assertScannerLimit('maxStructuralTokens', maxStructuralTokens);
  assertScannerLimit('maxNestingDepth', maxNestingDepth, { allowZero: false });

  const closingStack = [];
  let inString = false;
  let escaped = false;
  let rootStarted = false;
  let rootClosed = false;
  let topLevelValuePending = false;
  let topLevelEntries = 0;
  let structuralTokens = 0;
  let maxDepthObserved = 0;

  const recordStructuralToken = () => {
    structuralTokens += 1;
    if (structuralTokens > maxStructuralTokens) {
      throw remoteArtifactError(
        'Published artifact JSON exceeds the structural token limit',
        PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
      );
    }
  };

  const recordTopLevelEntry = () => {
    topLevelEntries += 1;
    topLevelValuePending = false;
    if (topLevelEntries > maxTopLevelEntries) {
      throw remoteArtifactError(
        'Published artifact JSON exceeds the top-level entry limit',
        PUBLISHED_ARTIFACT_REMOTE_CARDINALITY_CODE
      );
    }
  };

  const openContainer = (closingCharacter) => {
    closingStack.push(closingCharacter);
    maxDepthObserved = Math.max(maxDepthObserved, closingStack.length);
    if (closingStack.length > maxNestingDepth) {
      throw remoteArtifactError(
        'Published artifact JSON exceeds the nesting-depth limit',
        PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
      );
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (isJsonWhitespace(character)) continue;
    if (rootClosed) {
      throw remoteArtifactError(
        'Published artifact JSON has data after the root array',
        PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
      );
    }

    if (!rootStarted) {
      if (character !== '[') {
        throw remoteArtifactError(
          'Published artifact JSON root must be an array',
          PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
        );
      }
      rootStarted = true;
      topLevelValuePending = true;
      recordStructuralToken();
      openContainer(']');
      continue;
    }

    if (character === '"') {
      if (closingStack.length === 1 && topLevelValuePending) recordTopLevelEntry();
      inString = true;
      continue;
    }

    if (character === '[' || character === '{') {
      if (closingStack.length === 1 && topLevelValuePending) recordTopLevelEntry();
      recordStructuralToken();
      openContainer(character === '[' ? ']' : '}');
      continue;
    }

    if (character === ']' || character === '}') {
      recordStructuralToken();
      if (closingStack[closingStack.length - 1] !== character) {
        throw remoteArtifactError(
          'Published artifact JSON has mismatched containers',
          PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
        );
      }
      closingStack.pop();
      if (closingStack.length === 0) {
        rootClosed = true;
        topLevelValuePending = false;
      }
      continue;
    }

    if (character === ',') {
      recordStructuralToken();
      if (closingStack.length === 1) topLevelValuePending = true;
      continue;
    }

    if (character === ':') {
      recordStructuralToken();
      continue;
    }

    if (closingStack.length === 1 && topLevelValuePending) recordTopLevelEntry();
  }

  if (!rootStarted || !rootClosed || inString || closingStack.length !== 0) {
    throw remoteArtifactError(
      'Published artifact JSON root array is incomplete',
      PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
    );
  }

  return { topLevelEntries, structuralTokens, maxDepthObserved };
}

export async function readBoundedResponseBytes(response, {
  maxBytes = PUBLISHED_ARTIFACT_REMOTE_MAX_BYTES,
} = {}) {
  assertScannerLimit('maxBytes', maxBytes, { allowZero: false });
  const contentLengthHeader = response.headers?.get?.('content-length');
  const contentLength = contentLengthHeader === null || contentLengthHeader === undefined
    ? null
    : Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw remoteArtifactError(
      'Published artifact response exceeds the remote byte limit',
      PUBLISHED_ARTIFACT_REMOTE_BYTES_CODE
    );
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw remoteArtifactError('Published artifact response body is not stream-readable');
  }

  const reader = response.body.getReader();
  const initialCapacity = Number.isFinite(contentLength) && contentLength >= 0
    ? Math.min(contentLength, maxBytes)
    : Math.min(64 * 1024, maxBytes);
  let bytes = new Uint8Array(initialCapacity);
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    const nextTotalBytes = totalBytes + chunk.byteLength;
    if (nextTotalBytes > maxBytes) {
      await Promise.resolve(reader.cancel()).catch(() => {});
      throw remoteArtifactError(
        'Published artifact response exceeds the remote byte limit',
        PUBLISHED_ARTIFACT_REMOTE_BYTES_CODE
      );
    }
    if (nextTotalBytes > bytes.byteLength) {
      let nextCapacity = Math.max(bytes.byteLength || 1, 64 * 1024);
      while (nextCapacity < nextTotalBytes) {
        nextCapacity = Math.min(nextCapacity * 2, maxBytes);
      }
      const grown = new Uint8Array(nextCapacity);
      grown.set(bytes.subarray(0, totalBytes));
      bytes = grown;
    }
    bytes.set(chunk, totalBytes);
    totalBytes = nextTotalBytes;
  }

  return bytes.subarray(0, totalBytes);
}

export function parseBoundedPublishedArtifactJson(bytes, {
  maxTopLevelEntries,
} = {}) {
  assertScannerLimit('maxTopLevelEntries', maxTopLevelEntries);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const scan = assertPublishedArtifactJsonComplexity(text, { maxTopLevelEntries });
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length !== scan.topLevelEntries) {
    throw remoteArtifactError(
      'Published artifact JSON cardinality does not match the pre-parse scan',
      PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE
    );
  }
  return parsed;
}

export async function readBoundedPublishedArtifactJson(response, options = {}) {
  const bytes = await readBoundedResponseBytes(response);
  return parseBoundedPublishedArtifactJson(bytes, options);
}
