#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { redactEvidence } = require('./release-evidence-redactor');

const DEFAULT_INVALID_PRODUCTION_EVIDENCE = Object.freeze([
  'CI is not production evidence',
  'Local tests are not production evidence',
  'Docs, config, and source code are not production evidence',
  'D1 config, database names, and database ids are inventory only',
  'Screenshots alone are insufficient',
  'Manually supplied proof packets are operator-supplied inputs, not observations made by this tool'
]);

function nowUtc() {
  return new Date().toISOString();
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['pass', 'passed', 'success', 'ok'].includes(status)) return 'pass';
  if (['fail', 'failed', 'failure', 'error'].includes(status)) return 'fail';
  if (['skip', 'skipped'].includes(status)) return 'skipped';
  return status || 'unknown';
}

function normalizeValidation(validation) {
  if (typeof validation === 'string') {
    const [command, status, ...summaryParts] = validation.split('|');
    return {
      command: command || '[UNSPECIFIED]',
      source: 'local',
      status: normalizeStatus(status),
      summary: summaryParts.join('|') || ''
    };
  }

  return {
    command: validation.command || validation.name || '[UNSPECIFIED]',
    source: validation.source || 'local',
    status: normalizeStatus(validation.status || validation.result || validation.conclusion),
    exitCode: validation.exitCode,
    startedAtUtc: validation.startedAtUtc,
    completedAtUtc: validation.completedAtUtc,
    summary: validation.summary || validation.notes || ''
  };
}

function hasSuppliedProductionClaim(input) {
  const claims = input.claims || {};
  if (claims.productionObservationClaimed === true || input.productionObservationClaimed === true) return true;
  const productionActions = input.productionActions || {};
  return Object.entries(productionActions).some(([key, value]) => /observation.*claim/i.test(key) && value === true);
}

function hasFailingValidation(validations) {
  return validations.some((validation) => validation.status === 'fail');
}

function hasObjectFields(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function chooseStatus(input, validations, warnings) {
  if (warnings.length > 0 || hasFailingValidation(validations)) return 'HOLD';
  const requested = String(input.status || '').trim().toUpperCase();
  if (['SHIP', 'HOLD', 'FOLLOW_UP'].includes(requested)) return requested;
  if (validations.length > 0 || asArray(input.manualProofPackets).length > 0) return 'SHIP';
  return 'FOLLOW_UP';
}

function createEvidencePacket(input = {}, options = {}) {
  const validations = asArray(input.validations).map(normalizeValidation);
  const suppliedProductionClaim = hasSuppliedProductionClaim(input);
  const warnings = [];

  if (suppliedProductionClaim) {
    warnings.push('A production observation claim was supplied to a local-only tool; the packet is held and the claim is not accepted.');
  }

  const rawPacket = {
    packetType: 'release_evidence_packet',
    packetVersion: '1',
    mode: 'RELEASE_TOOLING',
    status: chooseStatus(input, validations, warnings),
    generatedAtUtc: options.generatedAtUtc || input.generatedAtUtc || nowUtc(),
    title: input.title || 'Release evidence packet',
    sourceBoundary: {
      localOnly: true,
      toolExecutesValidationCommands: false,
      toolAccessedProduction: false,
      toolGeneratedProductionEvidenceAutomatically: false,
      manuallySuppliedProofPacketsAllowed: true
    },
    boundaries: {
      toolAccessedProduction: false,
      productionEndpointCalledByTool: false,
      productionDbAccessedByTool: false,
      productionDbWrittenByTool: false,
      deployPerformedByTool: false,
      productionObservationClaimed: false,
      generatedOrStoredProductionEvidenceAutomatically: false,
      ciIsProductionEvidence: false,
      docsConfigOrSourceAreProductionEvidence: false,
      screenshotsAloneSufficient: false
    },
    repo: input.repo || {},
    github: input.github || {},
    githubMetadataInputs: asArray(input.githubMetadataInputs),
    validations,
    manualProofPackets: asArray(input.manualProofPackets),
    invalidProductionEvidence: DEFAULT_INVALID_PRODUCTION_EVIDENCE,
    claims: {
      localValidationSummarized: validations.length > 0,
      githubMetadataSummarizedOnly: hasObjectFields(input.github) || asArray(input.githubMetadataInputs).length > 0,
      manualProofPacketsSummarizedOnly: asArray(input.manualProofPackets).length > 0,
      productionObservationClaimed: false
    },
    warnings
  };

  return redactEvidence(rawPacket);
}

function scalarToYaml(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value);
  if (text === '' || /^(?:[-+]?\d+(?:\.\d+)?|true|false|null|~)$/i.test(text) || /[:#{}\[\],&*?|\-<>=!%@`]/.test(text) || /\s/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

function toYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return `${pad}-\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}- ${scalarToYaml(item)}`;
    }).join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return '{}';
    return entries.map(([key, item]) => {
      if (item && typeof item === 'object') {
        const nested = toYaml(item, indent + 2);
        return `${pad}${key}: ${nested === '[]' || nested === '{}' ? nested : `\n${nested}`}`;
      }
      return `${pad}${key}: ${scalarToYaml(item)}`;
    }).join('\n');
  }
  return `${pad}${scalarToYaml(value)}`;
}

function renderYaml(packet) {
  return `${toYaml(redactEvidence(packet))}\n`;
}

function renderValidationList(validations) {
  if (validations.length === 0) return '- No local validation results were supplied.\n';
  return validations.map((validation) => {
    const parts = [
      `command: \`${validation.command}\``,
      `status: \`${validation.status}\``,
      `source: \`${validation.source}\``
    ];
    if (validation.summary) parts.push(`summary: ${validation.summary}`);
    return `- ${parts.join('; ')}`;
  }).join('\n') + '\n';
}

function renderProofPacketList(proofPackets) {
  if (proofPackets.length === 0) return '- No manual proof packets were supplied.\n';
  return proofPackets.map((proof, index) => {
    const title = proof.title || proof.name || `Manual proof packet ${index + 1}`;
    const source = proof.source ? `; source: \`${proof.source}\`` : '';
    const summary = proof.summary ? `; summary: ${proof.summary}` : '';
    return `- ${title}${source}${summary}`;
  }).join('\n') + '\n';
}

function renderMarkdown(packet) {
  const redactedPacket = redactEvidence(packet);
  const lines = [
    `# ${redactedPacket.title}`,
    '',
    `STATUS: ${redactedPacket.status}`,
    `MODE: ${redactedPacket.mode}`,
    '',
    '## Source Boundary',
    '',
    '- Local-only toolkit; it does not run deploys, D1 commands, Worker endpoint calls, or validation commands.',
    '- CI is not production evidence.',
    '- Docs, config, and source code are not production evidence.',
    '- Screenshots alone are insufficient.',
    '- Manual proof packets are summarized as supplied inputs and are not production observations made by this tool.',
    '',
    '## Local Validations',
    '',
    renderValidationList(redactedPacket.validations).trimEnd(),
    '',
    '## Manual Proof Packets',
    '',
    renderProofPacketList(redactedPacket.manualProofPackets).trimEnd()
  ];

  if (redactedPacket.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of redactedPacket.warnings) lines.push(`- ${warning}`);
  }

  lines.push('', '## Packet YAML', '', '```yaml', renderYaml(redactedPacket).trimEnd(), '```', '');
  return lines.join('\n');
}

function readJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function mergeInput(base, next) {
  return {
    ...base,
    ...next,
    repo: { ...(base.repo || {}), ...(next.repo || {}) },
    github: { ...(base.github || {}), ...(next.github || {}) },
    validations: asArray(base.validations).concat(asArray(next.validations)),
    manualProofPackets: asArray(base.manualProofPackets).concat(asArray(next.manualProofPackets)),
    githubMetadataInputs: asArray(base.githubMetadataInputs).concat(asArray(next.githubMetadataInputs))
  };
}

function usage() {
  return [
    'Usage: node scripts/generate-release-evidence-packet.js [options]',
    '',
    'Options:',
    '  --input <file.json>              Read a full packet input JSON document',
    '  --validation-json <file.json>    Read local validation result(s) as JSON',
    '  --manual-proof <file.json>       Read a manually supplied proof packet JSON file; repeatable',
    '  --validation <cmd|status|text>   Add one local validation result; repeatable',
    '  --format <markdown|yaml>         Output format, default markdown',
    '  --output <file>                  Write output only when explicitly requested; default stdout',
    '  --title <text>                   Packet title',
    '  --repo <owner/name>              Repository metadata input',
    '  --branch <name>                  Branch metadata input',
    '  --head-sha <sha>                 HEAD SHA metadata input',
    '  --pr-url <url>                   Pull request URL metadata input',
    '  --issue-url <url>                Issue URL metadata input'
  ].join('\n');
}

function parseArgs(argv) {
  let input = {};
  let format = 'markdown';
  let outputPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (arg === '--input') {
      input = mergeInput(input, readJsonFile(next()));
    } else if (arg === '--validation-json') {
      const validationInput = readJsonFile(next());
      input = mergeInput(input, {
        validations: Array.isArray(validationInput) ? validationInput : validationInput.validations
      });
    } else if (arg === '--manual-proof') {
      input = mergeInput(input, { manualProofPackets: [readJsonFile(next())] });
    } else if (arg === '--validation') {
      input = mergeInput(input, { validations: [next()] });
    } else if (arg === '--format') {
      format = next();
    } else if (arg === '--output') {
      outputPath = next();
    } else if (arg === '--title') {
      input.title = next();
    } else if (arg === '--repo') {
      input.repo = { ...(input.repo || {}), name: next() };
    } else if (arg === '--branch') {
      input.repo = { ...(input.repo || {}), branch: next() };
    } else if (arg === '--head-sha') {
      input.repo = { ...(input.repo || {}), headSha: next() };
    } else if (arg === '--pr-url') {
      input.github = { ...(input.github || {}), pullRequestUrl: next() };
    } else if (arg === '--issue-url') {
      input.github = { ...(input.github || {}), issueUrl: next() };
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { input, format, outputPath };
}

function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const packet = createEvidencePacket(parsed.input);
  if (!['markdown', 'yaml'].includes(parsed.format)) throw new Error(`Unsupported format: ${parsed.format}`);
  const output = parsed.format === 'yaml' ? renderYaml(packet) : renderMarkdown(packet);

  if (parsed.outputPath) {
    fs.writeFileSync(path.resolve(parsed.outputPath), output);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_INVALID_PRODUCTION_EVIDENCE,
  createEvidencePacket,
  renderMarkdown,
  renderYaml,
  toYaml,
  main
};
