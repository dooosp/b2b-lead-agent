#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const EXPECTED_LEADS_COLUMNS = Object.freeze([
  'id',
  'identity_key',
  'profile_id',
  'source',
  'status',
  'review_status',
  'company',
  'summary',
  'product',
  'score',
  'grade',
  'roi',
  'sales_pitch',
  'global_context',
  'sources',
  'notes',
  'manual_review_notes_author_label',
  'manual_review_notes_updated_at',
  'enriched',
  'article_body',
  'action_items',
  'key_figures',
  'pain_points',
  'enriched_at',
  'follow_up_date',
  'estimated_value',
  'meddic',
  'competitive',
  'buying_signals',
  'score_reason',
  'urgency',
  'urgency_reason',
  'buyer_role',
  'evidence',
  'confidence',
  'confidence_reason',
  'assumptions',
  'generation_mode',
  'verification_status',
  'data_gaps',
  'event_type',
  'created_at',
  'updated_at',
]);

const EXPECTED_LEADS_MIGRATION_COLUMNS = Object.freeze(
  EXPECTED_LEADS_COLUMNS.filter((column) => column !== 'id')
);

const EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS = Object.freeze([
  'id', 'lead_id', 'event_type', 'changed_at', 'author_label',
]);
const EXPECTED_REVIEWER_FEEDBACK_COLUMNS = Object.freeze([
  'lead_id', 'action_usefulness', 'outcome_label', 'data_gap_priority',
  'evidence_confidence_adjustment', 'feedback_text', 'next_reviewer_action',
  'author_label', 'updated_at',
]);
const EXPECTED_REVIEWER_FEEDBACK_EVENT_COLUMNS = Object.freeze([
  'id', 'lead_id', 'event_type', 'changed_at', 'author_label', 'changed_fields',
]);
const EXPECTED_REFERENCE_LIBRARY_COLUMNS = Object.freeze([
  'id', 'profile_id', 'category', 'client', 'project', 'result', 'source_url',
  'region', 'verified_at', 'created_at',
]);
const EXPECTED_SNAPSHOT_HEAD_COLUMNS = Object.freeze([
  'profile_id', 'artifact_kind', 'snapshot_id', 'fetched_at',
]);
const EXPECTED_SNAPSHOT_ENTRY_COLUMNS = Object.freeze([
  'profile_id', 'artifact_kind', 'snapshot_id', 'ordinal', 'lead_id', 'payload_json',
]);
const EXPECTED_MIGRATION_LEDGER_COLUMNS = Object.freeze([
  'version', 'name', 'applied_at',
]);
const EXPECTED_ANALYTICS_COLUMNS = Object.freeze([
  'id', 'type', 'profile_id', 'company', 'industry', 'leads_count',
  'articles_count', 'elapsed_sec', 'ip_hash', 'created_at',
]);
const EXPECTED_STATUS_LOG_COLUMNS = Object.freeze([
  'id', 'lead_id', 'from_status', 'to_status', 'changed_at',
]);
const EXPECTED_JOB_RUN_COLUMNS = Object.freeze([
  'request_id', 'profile_id', 'target', 'state', 'idempotency_key',
  'github_event_type', 'github_run_id', 'github_run_attempt', 'github_run_url',
  'github_workflow', 'github_sha', 'cloud_run_operation',
  'cloud_run_execution', 'accepted_at', 'started_at', 'completed_at',
  'last_error', 'updated_at',
]);

const EXPECTED_MANUAL_REVIEW_NOTE_EVENT_INDEXES = Object.freeze([
  Object.freeze({
    name: 'idx_manual_review_note_events_lead',
    table: 'manual_review_note_events',
    columns: 'lead_id, changed_at DESC',
    unique: false,
  }),
]);
const EXPECTED_REVIEWER_FEEDBACK_INDEXES = Object.freeze([
  Object.freeze({
    name: 'idx_reviewer_feedback_updated',
    table: 'reviewer_feedback',
    columns: 'updated_at DESC',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_reviewer_feedback_events_lead',
    table: 'reviewer_feedback_events',
    columns: 'lead_id, changed_at DESC',
    unique: false,
  }),
]);
const EXPECTED_SNAPSHOT_INDEXES = Object.freeze([
  Object.freeze({
    name: 'idx_published_snapshot_entries_lookup',
    table: 'published_snapshot_entries',
    columns: 'profile_id, artifact_kind, snapshot_id, ordinal',
    unique: false,
  }),
]);
const EXPECTED_REFERENCE_LIBRARY_INDEXES = Object.freeze([
  Object.freeze({
    name: 'idx_ref_profile_cat',
    table: 'reference_library',
    columns: 'profile_id, category',
    unique: false,
  }),
]);
const EXPECTED_CORE_INDEXES = Object.freeze([
  Object.freeze({
    name: 'idx_leads_identity_key',
    table: 'leads',
    columns: 'identity_key',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_leads_profile',
    table: 'leads',
    columns: 'profile_id',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_leads_status',
    table: 'leads',
    columns: 'status',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_leads_review_status',
    table: 'leads',
    columns: 'review_status',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_leads_created',
    table: 'leads',
    columns: 'created_at DESC',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_analytics_created',
    table: 'analytics',
    columns: 'created_at DESC',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_status_log_lead',
    table: 'status_log',
    columns: 'lead_id',
    unique: false,
  }),
  Object.freeze({
    name: 'idx_job_runs_idempotency',
    table: 'job_runs',
    columns: 'idempotency_key',
    unique: true,
  }),
  Object.freeze({
    name: 'idx_job_runs_active_profile',
    table: 'job_runs',
    columns: 'profile_id',
    unique: true,
  }),
  Object.freeze({
    name: 'idx_job_runs_updated',
    table: 'job_runs',
    columns: 'updated_at DESC',
    unique: false,
  }),
]);

const EXPECTED_CANONICAL_INDEXES = Object.freeze([
  ...EXPECTED_CORE_INDEXES,
  ...EXPECTED_MANUAL_REVIEW_NOTE_EVENT_INDEXES,
  ...EXPECTED_REVIEWER_FEEDBACK_INDEXES,
  ...EXPECTED_REFERENCE_LIBRARY_INDEXES,
  ...EXPECTED_SNAPSHOT_INDEXES,
]);

const EXPECTED_PARTIAL_INDEX_WHERE = Object.freeze({
  idx_job_runs_idempotency: "idempotency_key IS NOT NULL AND idempotency_key != ''",
  idx_job_runs_active_profile: "state IN ('accepted', 'running')",
});

const DRIFT_CRITICAL_COLUMNS = Object.freeze([
  'review_status',
  'manual_review_notes_author_label',
  'manual_review_notes_updated_at',
  'generation_mode',
  'verification_status',
  'data_gaps',
]);

const TABLE_SPECS = Object.freeze([
  Object.freeze({ name: 'd1_schema_migrations', columns: EXPECTED_MIGRATION_LEDGER_COLUMNS }),
  Object.freeze({ name: 'leads', columns: EXPECTED_LEADS_COLUMNS }),
  Object.freeze({ name: 'analytics', columns: EXPECTED_ANALYTICS_COLUMNS }),
  Object.freeze({ name: 'status_log', columns: EXPECTED_STATUS_LOG_COLUMNS }),
  Object.freeze({ name: 'manual_review_note_events', columns: EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS }),
  Object.freeze({ name: 'reviewer_feedback', columns: EXPECTED_REVIEWER_FEEDBACK_COLUMNS }),
  Object.freeze({ name: 'reviewer_feedback_events', columns: EXPECTED_REVIEWER_FEEDBACK_EVENT_COLUMNS }),
  Object.freeze({ name: 'job_runs', columns: EXPECTED_JOB_RUN_COLUMNS }),
  Object.freeze({ name: 'reference_library', columns: EXPECTED_REFERENCE_LIBRARY_COLUMNS }),
  Object.freeze({ name: 'published_snapshot_heads', columns: EXPECTED_SNAPSHOT_HEAD_COLUMNS }),
  Object.freeze({ name: 'published_snapshot_entries', columns: EXPECTED_SNAPSHOT_ENTRY_COLUMNS }),
]);

const DEPLOYED_MIGRATION_SPECS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'adopt_canonical_lead_schema',
    statementArrays: Object.freeze([
      'V1_CREATE_TABLE_STATEMENTS', 'V1_INDEX_STATEMENTS',
    ]),
    statementConstants: Object.freeze([
      'D1_SCHEMA_MIGRATION_TABLE', 'CREATE_MIGRATION_LEDGER_SQL',
      'CREATE_LEADS_TABLE_SQL',
    ]),
    tables: Object.freeze([
      'd1_schema_migrations', 'leads', 'analytics', 'status_log',
      'manual_review_note_events', 'reviewer_feedback', 'reviewer_feedback_events',
      'job_runs', 'reference_library',
    ]),
    indexes: Object.freeze(EXPECTED_CANONICAL_INDEXES
      .filter(({ table }) => !table.startsWith('published_snapshot_'))
      .map(({ name }) => name)),
  }),
  Object.freeze({
    version: 2,
    name: 'separate_published_snapshot_artifacts',
    statementArrays: Object.freeze([
      'V2_CREATE_TABLE_STATEMENTS', 'V2_INDEX_STATEMENTS',
    ]),
    tables: Object.freeze(['published_snapshot_heads', 'published_snapshot_entries']),
    indexes: Object.freeze(EXPECTED_SNAPSHOT_INDEXES.map(({ name }) => name)),
  }),
]);

const DEPLOYED_MIGRATION_FINGERPRINTS = Object.freeze({
  1: '28318686ff990194ec7c992833d30d93f6c34f76cdd69c4983968b91f3e5130f',
  2: '62cb910c994ae8c5e5be3c427591974f2717a5555d6fa5da21c57e38e20f39a8',
});

const DEPLOYED_MIGRATION_STATEMENT_FINGERPRINTS = Object.freeze({
  1: 'cc4867c1818209a9f55d4d15cf31dc0812962b711ef109199c1023012718cce4',
  2: 'b83965d69d1b66193aebdf1574be54c49e0b82f6e25a27724e066e7059c01b26',
});
const DEPLOYED_MIGRATION_BINDING_FINGERPRINT =
  'f34d90956351a0c4b998c73876ee1080f1b837f593873a550d85c72778922c85';

const CONSTRAINT_PREFIXES = new Set(['constraint', 'primary', 'foreign', 'unique', 'check']);

function normalizeDefinition(definition) {
  return String(definition || '').replace(/\s+/g, ' ').replace(/\s+,\s*$/, '').trim();
}

function normalizeSqlContract(value) {
  return normalizeDefinition(value).replace(/\s*([(),])\s*/g, '$1');
}

function findCreateTableBody(sourceText, tableName) {
  const pattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tableName}\\s*\\(`, 'i');
  const match = pattern.exec(sourceText);
  if (!match) throw new Error(`CREATE TABLE IF NOT EXISTS ${tableName} not found`);

  let depth = 1;
  let inSingleQuote = false;
  const start = match.index + match[0].length;
  for (let index = start; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    const next = sourceText[index + 1];
    if (char === "'" && inSingleQuote && next === "'") {
      index += 1;
      continue;
    }
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (inSingleQuote) continue;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0) return sourceText.slice(start, index);
  }
  throw new Error(`CREATE TABLE ${tableName} closing parenthesis not found`);
}

function splitTopLevelCsv(body) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const next = body[index + 1];
    if (char === "'" && inSingleQuote && next === "'") {
      current += char + next;
      index += 1;
      continue;
    }
    if (char === "'") inSingleQuote = !inSingleQuote;
    if (!inSingleQuote) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseCreateTableColumns(sourceText, tableName = 'leads') {
  return splitTopLevelCsv(findCreateTableBody(sourceText, tableName))
    .map((part) => part.replace(/--.*$/gm, '').trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^["`[]?([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s+(.+)$/.exec(part);
      if (!match || CONSTRAINT_PREFIXES.has(match[1].toLowerCase())) return null;
      return { name: match[1], definition: normalizeDefinition(match[2]) };
    })
    .filter(Boolean);
}

function parseMigrationLeadDefinitions(sourceText) {
  const start = sourceText.indexOf('export const LEADS_COLUMN_DEFINITIONS');
  const end = sourceText.indexOf('export const CREATE_MIGRATION_LEDGER_SQL');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('LEADS_COLUMN_DEFINITIONS manifest block not found');
  }
  const block = sourceText.slice(start, end);
  const definitions = [];
  const pattern = /Object\.freeze\(\{\s*name:\s*'([^']+)',\s*definition:\s*(["'])([\s\S]*?)\2\s*\}\)/g;
  for (const match of block.matchAll(pattern)) {
    definitions.push({ name: match[1], definition: normalizeDefinition(match[3]) });
  }
  return definitions;
}

function parseCreateIndexes(sourceText) {
  const indexes = [];
  const pattern = /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s+ON\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/gi;
  for (const match of sourceText.matchAll(pattern)) {
    indexes.push({
      name: match[2],
      table: match[3],
      columns: normalizeDefinition(match[4]),
      unique: Boolean(match[1]),
    });
  }
  return indexes.filter((index, position) => indexes.findIndex((candidate) => (
    JSON.stringify(candidate) === JSON.stringify(index)
  )) === position);
}

function parsePartialIndexWhere(sourceText, indexName) {
  const startPattern = new RegExp(
    `CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${indexName}\\s+ON\\s+`,
    'i'
  );
  const start = startPattern.exec(sourceText);
  if (!start) return '';
  const remainder = sourceText.slice(start.index + start[0].length);
  const openingDelimiter = sourceText[start.index - 1];
  const quotedSource = openingDelimiter === "'"
    || openingDelimiter === '"'
    || openingDelimiter === '`';
  const statementEnd = quotedSource
    ? remainder.indexOf(openingDelimiter)
    : remainder.indexOf(';');
  const statement = remainder.slice(0, statementEnd >= 0 ? statementEnd : remainder.length);
  const where = /\bWHERE\b/i.exec(statement);
  if (!where) return '';
  const predicateStart = where.index + where[0].length;
  const afterPredicate = statement.slice(predicateStart);
  return normalizeDefinition(
    afterPredicate.replace(/[`"],?\s*$/, '').trim()
  );
}

function fullCreateTableContract(sourceText, tableName) {
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tableName}\\s*\\(`,
    'i'
  );
  const match = pattern.exec(sourceText);
  if (!match) throw new Error(`CREATE TABLE IF NOT EXISTS ${tableName} not found`);

  let depth = 1;
  let inSingleQuote = false;
  const bodyStart = match.index + match[0].length;
  for (let index = bodyStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    const next = sourceText[index + 1];
    if (char === "'" && inSingleQuote && next === "'") {
      index += 1;
      continue;
    }
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (inSingleQuote) continue;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth !== 0) continue;

    const remainder = sourceText.slice(index + 1);
    const terminators = [remainder.indexOf(';'), remainder.indexOf('`')]
      .filter((position) => position >= 0);
    const suffixEnd = terminators.length > 0 ? Math.min(...terminators) : 0;
    const suffix = remainder.slice(0, suffixEnd).trim();
    const body = sourceText.slice(bodyStart, index);
    return normalizeSqlContract(
      `CREATE TABLE ${tableName} (${body})${suffix ? ` ${suffix}` : ''}`
    );
  }
  throw new Error(`CREATE TABLE ${tableName} closing parenthesis not found`);
}

function normalizedCreateTableContract(sourceText, tableName) {
  return fullCreateTableContract(sourceText, tableName);
}

function schemaVersionFingerprint(sourceText, spec) {
  const indexes = parseCreateIndexes(sourceText);
  const contract = {
    version: spec.version,
    name: spec.name,
    tables: spec.tables.map((tableName) => ({
      name: tableName,
      body: normalizedCreateTableContract(sourceText, tableName),
    })),
    indexes: spec.indexes.map((indexName) => {
      const index = indexes.find(({ name }) => name === indexName) || null;
      return {
        ...(index || { name: indexName, missing: true }),
        where: parsePartialIndexWhere(sourceText, indexName),
      };
    }),
  };
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function declaredSchemaObjects(sourceText) {
  const objects = [];
  const pattern = /CREATE\s+(UNIQUE\s+)?(TABLE|INDEX|VIEW|TRIGGER)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi;
  for (const match of sourceText.matchAll(pattern)) {
    objects.push({ type: match[2].toLowerCase(), name: match[3] });
  }
  return objects.filter((object, index) => objects.findIndex((candidate) => (
    candidate.type === object.type && candidate.name === object.name
  )) === index);
}

function migrationDdlSourceBlock(sourceText) {
  const start = sourceText.indexOf('export const CREATE_MIGRATION_LEDGER_SQL');
  const end = sourceText.indexOf('export function normalizeD1SchemaSql');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('canonical migration DDL block not found');
  }
  return sourceText.slice(start, end);
}

function frozenStatementArrayBody(sourceText, exportName) {
  const pattern = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*Object\\.freeze\\s*\\(\\s*\\[`
  );
  const match = pattern.exec(sourceText);
  if (!match) throw new Error(`${exportName} frozen statement array not found`);

  const openingBracket = match.index + match[0].length - 1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBracket; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    const next = sourceText[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (quote === '`' && char === '$' && next === '{') {
        throw new Error(`${exportName} contains a dynamic template expression`);
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') {
      depth += 1;
      continue;
    }
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        const tail = sourceText.slice(index + 1);
        if (!/^\s*\)\s*;/.test(tail)) {
          throw new Error(`${exportName} must end after Object.freeze([...])`);
        }
        return sourceText.slice(openingBracket + 1, index);
      }
      if (depth < 0) break;
    }
  }
  throw new Error(`${exportName} closing bracket not found`);
}

function staticStatementConstantBody(sourceText, exportName) {
  const pattern = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*`);
  const match = pattern.exec(sourceText);
  if (!match) throw new Error(`${exportName} static statement constant not found`);

  const openingQuote = match.index + match[0].length;
  const quote = sourceText[openingQuote];
  if (quote !== "'" && quote !== '"' && quote !== '`') {
    throw new Error(`${exportName} must be a static string literal`);
  }
  let escaped = false;
  for (let index = openingQuote + 1; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    const next = sourceText[index + 1];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote === '`' && char === '$' && next === '{') {
      throw new Error(`${exportName} contains a dynamic template expression`);
    }
    if (char === quote) {
      const tail = sourceText.slice(index + 1);
      if (!/^\s*;/.test(tail)) {
        throw new Error(`${exportName} must end after its static string literal`);
      }
      return sourceText.slice(openingQuote + 1, index);
    }
  }
  throw new Error(`${exportName} closing quote not found`);
}

function migrationStatementFingerprint(sourceText, spec) {
  const contract = [
    ...(spec.statementConstants || []).map((exportName) => ({
      name: exportName,
      source: normalizeDefinition(staticStatementConstantBody(sourceText, exportName)),
    })),
    ...spec.statementArrays.map((exportName) => ({
      name: exportName,
      source: normalizeDefinition(frozenStatementArrayBody(sourceText, exportName)),
    })),
  ];
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function migrationBindingFingerprint(sourceText) {
  const contract = normalizeDefinition(
    frozenStatementArrayBody(sourceText, 'D1_MIGRATION_MANIFEST')
  );
  return createHash('sha256').update(contract).digest('hex');
}

function names(columns) {
  return columns.map((column) => column.name);
}

function assertColumnSet(errors, label, actualColumns, expectedColumns) {
  const actual = new Set(actualColumns);
  const expected = new Set(expectedColumns);
  const missing = expectedColumns.filter((column) => !actual.has(column));
  const extra = actualColumns.filter((column) => !expected.has(column));
  const duplicate = actualColumns.filter((column, index) => actualColumns.indexOf(column) !== index);
  if (missing.length) errors.push(`${label} missing expected columns: ${missing.join(', ')}`);
  if (extra.length) errors.push(`${label} has unexpected columns: ${extra.join(', ')}`);
  if (duplicate.length) errors.push(`${label} has duplicate columns: ${[...new Set(duplicate)].join(', ')}`);
}

function assertDefinitionsMatch(errors, expectedColumns, leftLabel, leftColumns, rightLabel, rightColumns) {
  const left = new Map(leftColumns.map((column) => [column.name, column.definition]));
  const right = new Map(rightColumns.map((column) => [column.name, column.definition]));
  for (const column of expectedColumns) {
    if (left.has(column) && right.has(column) && left.get(column) !== right.get(column)) {
      errors.push(`${column} definition mismatch between ${leftLabel} and ${rightLabel}: ${left.get(column)} !== ${right.get(column)}`);
    }
  }
}

function assertRequiredIndexes(errors, label, actualIndexes, expectedIndexes) {
  for (const expected of expectedIndexes) {
    if (!actualIndexes.some((actual) => JSON.stringify(actual) === JSON.stringify(expected))) {
      errors.push(`${label} missing expected index ${expected.name} ON ${expected.table}(${expected.columns})`);
    }
  }
}

function validateSchemaSources({ schemaSql, migrationManifest }) {
  const errors = [];
  const sources = { schemaSqlTables: {}, migrationManifestTables: {} };

  for (const spec of TABLE_SPECS) {
    for (const [label, sourceText, outputKey] of [
      ['worker/schema.sql', schemaSql, 'schemaSqlTables'],
      ['worker/db/migration-manifest.js', migrationManifest, 'migrationManifestTables'],
    ]) {
      try {
        const definitions = parseCreateTableColumns(sourceText, spec.name);
        sources[outputKey][spec.name] = definitions;
        assertColumnSet(errors, `${label} CREATE TABLE ${spec.name}`, names(definitions), spec.columns);
      } catch (error) {
        sources[outputKey][spec.name] = [];
        errors.push(`${label} CREATE TABLE ${spec.name} parse failed: ${error.message}`);
      }
    }
    assertDefinitionsMatch(
      errors,
      spec.columns,
      `worker/schema.sql CREATE TABLE ${spec.name}`,
      sources.schemaSqlTables[spec.name],
      `worker/db/migration-manifest.js CREATE TABLE ${spec.name}`,
      sources.migrationManifestTables[spec.name]
    );
    try {
      const schemaContract = normalizedCreateTableContract(schemaSql, spec.name);
      const manifestContract = normalizedCreateTableContract(migrationManifest, spec.name);
      if (schemaContract !== manifestContract) {
        errors.push(
          `${spec.name} full CREATE TABLE mismatch between worker/schema.sql and `
          + 'worker/db/migration-manifest.js'
        );
      }
    } catch (error) {
      errors.push(`${spec.name} full CREATE TABLE comparison failed: ${error.message}`);
    }
  }

  try {
    sources.migrationLeadDefinitions = parseMigrationLeadDefinitions(migrationManifest);
    sources.migrationLeadColumns = names(sources.migrationLeadDefinitions);
    assertColumnSet(
      errors,
      'worker/db/migration-manifest.js LEADS_COLUMN_DEFINITIONS',
      sources.migrationLeadColumns,
      EXPECTED_LEADS_COLUMNS
    );
    assertDefinitionsMatch(
      errors,
      EXPECTED_LEADS_COLUMNS,
      'worker/schema.sql CREATE TABLE leads',
      sources.schemaSqlTables.leads,
      'worker/db/migration-manifest.js LEADS_COLUMN_DEFINITIONS',
      sources.migrationLeadDefinitions
    );
  } catch (error) {
    sources.migrationLeadDefinitions = [];
    sources.migrationLeadColumns = [];
    errors.push(`worker/db/migration-manifest.js lead definitions parse failed: ${error.message}`);
  }

  sources.schemaSqlIndexes = parseCreateIndexes(schemaSql);
  sources.migrationManifestIndexes = parseCreateIndexes(migrationManifest);
  assertRequiredIndexes(errors, 'worker/schema.sql', sources.schemaSqlIndexes, EXPECTED_CANONICAL_INDEXES);
  assertRequiredIndexes(
    errors,
    'worker/db/migration-manifest.js',
    sources.migrationManifestIndexes,
    EXPECTED_CANONICAL_INDEXES
  );
  sources.schemaSqlPartialIndexWhere = {};
  sources.migrationManifestPartialIndexWhere = {};
  for (const [indexName, expectedWhere] of Object.entries(EXPECTED_PARTIAL_INDEX_WHERE)) {
    const schemaWhere = parsePartialIndexWhere(schemaSql, indexName);
    const manifestWhere = parsePartialIndexWhere(migrationManifest, indexName);
    sources.schemaSqlPartialIndexWhere[indexName] = schemaWhere;
    sources.migrationManifestPartialIndexWhere[indexName] = manifestWhere;
    if (schemaWhere !== expectedWhere) {
      errors.push(`worker/schema.sql ${indexName} WHERE mismatch: ${schemaWhere} !== ${expectedWhere}`);
    }
    if (manifestWhere !== expectedWhere) {
      errors.push(
        `worker/db/migration-manifest.js ${indexName} WHERE mismatch: `
        + `${manifestWhere} !== ${expectedWhere}`
      );
    }
  }

  for (const column of DRIFT_CRITICAL_COLUMNS) {
    if (!names(sources.schemaSqlTables.leads || []).includes(column)) {
      errors.push(`critical lead column ${column} missing from worker/schema.sql CREATE TABLE leads`);
    }
    if (!sources.migrationLeadColumns.includes(column)) {
      errors.push(`critical lead column ${column} missing from explicit migration manifest`);
    }
  }

  sources.migrationFingerprints = { schemaSql: {}, migrationManifest: {} };
  sources.migrationStatementFingerprints = {};
  for (const spec of DEPLOYED_MIGRATION_SPECS) {
    if (!new RegExp(
      `VALUES\\s*\\(\\s*${spec.version}\\s*,\\s*'${spec.name}'\\s*,`,
      'i'
    ).test(schemaSql)) {
      errors.push(
        `worker/schema.sql missing migration ledger version ${spec.version} name ${spec.name}`
      );
    }
    if (!new RegExp(
      `version:\\s*${spec.version}\\b[\\s\\S]*?name:\\s*'${spec.name}'`
    ).test(migrationManifest)) {
      errors.push(
        `worker/db/migration-manifest.js missing migration version ${spec.version} name ${spec.name}`
      );
    }
    for (const [sourceKey, sourceText] of [
      ['schemaSql', schemaSql],
      ['migrationManifest', migrationManifest],
    ]) {
      try {
        const fingerprint = schemaVersionFingerprint(sourceText, spec);
        sources.migrationFingerprints[sourceKey][spec.version] = fingerprint;
        if (fingerprint !== DEPLOYED_MIGRATION_FINGERPRINTS[spec.version]) {
          errors.push(
            `${sourceKey} deployed migration ${spec.version} fingerprint mismatch: `
            + `${fingerprint} !== ${DEPLOYED_MIGRATION_FINGERPRINTS[spec.version]}`
          );
        }
      } catch (error) {
        errors.push(`${sourceKey} migration ${spec.version} fingerprint failed: ${error.message}`);
      }
    }
    try {
      const fingerprint = migrationStatementFingerprint(migrationManifest, spec);
      sources.migrationStatementFingerprints[spec.version] = fingerprint;
      if (fingerprint !== DEPLOYED_MIGRATION_STATEMENT_FINGERPRINTS[spec.version]) {
        errors.push(
          `migrationManifest deployed migration ${spec.version} statement contract mismatch: `
          + `${fingerprint} !== ${DEPLOYED_MIGRATION_STATEMENT_FINGERPRINTS[spec.version]}`
        );
      }
    } catch (error) {
      errors.push(
        `migrationManifest migration ${spec.version} statement contract failed: ${error.message}`
      );
    }
  }
  try {
    const fingerprint = migrationBindingFingerprint(migrationManifest);
    sources.migrationBindingFingerprint = fingerprint;
    if (fingerprint !== DEPLOYED_MIGRATION_BINDING_FINGERPRINT) {
      errors.push(
        'migrationManifest immutable migration binding contract mismatch: '
        + `${fingerprint} !== ${DEPLOYED_MIGRATION_BINDING_FINGERPRINT}`
      );
    }
  } catch (error) {
    errors.push(`migrationManifest binding contract failed: ${error.message}`);
  }

  const expectedSchemaObjects = new Set([
    ...TABLE_SPECS.map(({ name }) => `table:${name}`),
    ...EXPECTED_CANONICAL_INDEXES.map(({ name }) => `index:${name}`),
  ]);
  for (const [label, ddlSource] of [
    ['worker/schema.sql', schemaSql],
    ['worker/db/migration-manifest.js', migrationDdlSourceBlock(migrationManifest)],
  ]) {
    const unexpectedSchemaObjects = declaredSchemaObjects(ddlSource)
      .filter(({ type, name }) => !expectedSchemaObjects.has(`${type}:${name}`));
    if (unexpectedSchemaObjects.length > 0) {
      errors.push(
        `${label} has unexpected schema objects: `
        + unexpectedSchemaObjects.map(({ type, name }) => `${type}:${name}`).join(', ')
      );
    }
  }

  sources.schemaSqlCreateColumns = names(sources.schemaSqlTables.leads || []);
  sources.migrationManifestCreateColumns = names(sources.migrationManifestTables.leads || []);
  sources.schemaSqlManualReviewNoteEventColumns = names(sources.schemaSqlTables.manual_review_note_events || []);
  sources.migrationManifestManualReviewNoteEventColumns = names(sources.migrationManifestTables.manual_review_note_events || []);
  sources.schemaSqlReviewerFeedbackColumns = names(sources.schemaSqlTables.reviewer_feedback || []);
  sources.migrationManifestReviewerFeedbackColumns = names(sources.migrationManifestTables.reviewer_feedback || []);
  sources.schemaSqlReviewerFeedbackEventColumns = names(sources.schemaSqlTables.reviewer_feedback_events || []);
  sources.migrationManifestReviewerFeedbackEventColumns = names(sources.migrationManifestTables.reviewer_feedback_events || []);

  return { ok: errors.length === 0, errors, sources };
}

function runCli() {
  const repoRoot = path.resolve(__dirname, '..');
  const result = validateSchemaSources({
    schemaSql: fs.readFileSync(path.join(repoRoot, 'worker/schema.sql'), 'utf8'),
    migrationManifest: fs.readFileSync(path.join(repoRoot, 'worker/db/migration-manifest.js'), 'utf8'),
  });
  if (!result.ok) {
    console.error('D1 schema consistency check failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('D1 schema consistency check passed.');
  console.log(`- canonical leads columns: ${EXPECTED_LEADS_COLUMNS.length}`);
  console.log(`- explicit migration lead columns: ${EXPECTED_LEADS_MIGRATION_COLUMNS.length}`);
  console.log(`- explicit migrations: 2`);
  console.log(`- published snapshot tables: 2`);
}

if (require.main === module) runCli();

module.exports = {
  DEPLOYED_MIGRATION_SPECS,
  DEPLOYED_MIGRATION_FINGERPRINTS,
  DEPLOYED_MIGRATION_STATEMENT_FINGERPRINTS,
  DEPLOYED_MIGRATION_BINDING_FINGERPRINT,
  DRIFT_CRITICAL_COLUMNS,
  EXPECTED_LEADS_COLUMNS,
  EXPECTED_LEADS_MIGRATION_COLUMNS,
  EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS,
  EXPECTED_MANUAL_REVIEW_NOTE_EVENT_INDEXES,
  EXPECTED_REVIEWER_FEEDBACK_COLUMNS,
  EXPECTED_REVIEWER_FEEDBACK_EVENT_COLUMNS,
  EXPECTED_REVIEWER_FEEDBACK_INDEXES,
  EXPECTED_REFERENCE_LIBRARY_COLUMNS,
  EXPECTED_ANALYTICS_COLUMNS,
  EXPECTED_STATUS_LOG_COLUMNS,
  EXPECTED_JOB_RUN_COLUMNS,
  EXPECTED_CANONICAL_INDEXES,
  EXPECTED_PARTIAL_INDEX_WHERE,
  EXPECTED_SNAPSHOT_HEAD_COLUMNS,
  EXPECTED_SNAPSHOT_ENTRY_COLUMNS,
  EXPECTED_SNAPSHOT_INDEXES,
  parseCreateTableColumns,
  parseCreateIndexes,
  parsePartialIndexWhere,
  parseMigrationLeadDefinitions,
  normalizedCreateTableContract,
  schemaVersionFingerprint,
  migrationStatementFingerprint,
  migrationBindingFingerprint,
  validateSchemaSources,
};
