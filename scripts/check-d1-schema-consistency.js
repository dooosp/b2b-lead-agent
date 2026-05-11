#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

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

const EXPECTED_LEADS_LAZY_ALTER_COLUMNS = Object.freeze([
  'identity_key',
  'review_status',
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
]);

const DRIFT_CRITICAL_COLUMNS = Object.freeze([
  'review_status',
  'generation_mode',
  'verification_status',
  'data_gaps',
]);

const CONSTRAINT_PREFIXES = new Set([
  'constraint',
  'primary',
  'foreign',
  'unique',
  'check',
]);

function normalizeDefinition(definition) {
  return String(definition || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,\s*$/, '')
    .trim();
}

function findCreateTableBody(sourceText, tableName) {
  const pattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tableName}\\s*\\(`, 'i');
  const match = pattern.exec(sourceText);
  if (!match) {
    throw new Error(`CREATE TABLE IF NOT EXISTS ${tableName} not found`);
  }

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
    if (depth === 0) {
      return sourceText.slice(start, index);
    }
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
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
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

function stripLineComment(line) {
  let inSingleQuote = false;
  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "'" && inSingleQuote && next === "'") {
      index += 1;
      continue;
    }
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (!inSingleQuote && char === '-' && next === '-') {
      return line.slice(0, index);
    }
  }
  return line;
}

function parseCreateTableColumns(sourceText, tableName = 'leads') {
  const body = findCreateTableBody(sourceText, tableName);
  return splitTopLevelCsv(body)
    .map((part) => stripLineComment(part).trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^["`[]?([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s+(.+)$/.exec(part);
      if (!match) return null;
      const name = match[1];
      const firstToken = name.toLowerCase();
      if (CONSTRAINT_PREFIXES.has(firstToken)) return null;
      return {
        name,
        definition: normalizeDefinition(match[2]),
      };
    })
    .filter(Boolean);
}

function parseLazyAlterColumns(schemaJsText) {
  const columns = [];
  const pattern = /ALTER\s+TABLE\s+leads\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\s+([^"`\r\n]+?)(?=["`])/g;
  for (const match of schemaJsText.matchAll(pattern)) {
    columns.push({
      name: match[1],
      definition: normalizeDefinition(match[2]),
    });
  }
  return columns;
}

function toDefinitionMap(columns) {
  return new Map(columns.map((column) => [column.name, column.definition]));
}

function names(columns) {
  return columns.map((column) => column.name);
}

function assertColumnSet(errors, label, actualColumns, expectedColumns) {
  const actualSet = new Set(actualColumns);
  const expectedSet = new Set(expectedColumns);
  const missing = expectedColumns.filter((column) => !actualSet.has(column));
  const extra = actualColumns.filter((column) => !expectedSet.has(column));
  const duplicate = actualColumns.filter((column, index) => actualColumns.indexOf(column) !== index);

  if (missing.length > 0) {
    errors.push(`${label} missing expected columns: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    errors.push(`${label} has unexpected columns: ${extra.join(', ')}`);
  }
  if (duplicate.length > 0) {
    errors.push(`${label} has duplicate columns: ${[...new Set(duplicate)].join(', ')}`);
  }
}

function assertDefinitionsMatch(errors, leftLabel, leftColumns, rightLabel, rightColumns) {
  const left = toDefinitionMap(leftColumns);
  const right = toDefinitionMap(rightColumns);
  for (const column of EXPECTED_LEADS_COLUMNS) {
    if (!left.has(column) || !right.has(column)) continue;
    const leftDefinition = left.get(column);
    const rightDefinition = right.get(column);
    if (leftDefinition !== rightDefinition) {
      errors.push(
        `${column} definition mismatch between ${leftLabel} and ${rightLabel}: ` +
        `${leftDefinition} !== ${rightDefinition}`
      );
    }
  }
}

function assertLazyDefinitionsMatchCreate(errors, createColumns, lazyAlterColumns) {
  const create = toDefinitionMap(createColumns);
  const lazy = toDefinitionMap(lazyAlterColumns);
  for (const column of EXPECTED_LEADS_LAZY_ALTER_COLUMNS) {
    if (!create.has(column) || !lazy.has(column)) continue;
    const createDefinition = create.get(column);
    const lazyDefinition = lazy.get(column);
    if (createDefinition !== lazyDefinition) {
      errors.push(
        `${column} lazy ALTER definition mismatch against worker/db/schema.js CREATE TABLE leads: ` +
        `${lazyDefinition} !== ${createDefinition}`
      );
    }
  }
}

function validateSchemaSources({ schemaSql, schemaJs }) {
  const errors = [];
  let schemaSqlCreateColumns = [];
  let schemaJsCreateColumns = [];
  let schemaJsLazyAlterColumns = [];
  let schemaSqlCreateDefinitions = [];
  let schemaJsCreateDefinitions = [];
  let schemaJsLazyAlterDefinitions = [];

  try {
    schemaSqlCreateDefinitions = parseCreateTableColumns(schemaSql, 'leads');
    schemaSqlCreateColumns = names(schemaSqlCreateDefinitions);
  } catch (err) {
    errors.push(`worker/schema.sql parse failed: ${err.message}`);
  }

  try {
    schemaJsCreateDefinitions = parseCreateTableColumns(schemaJs, 'leads');
    schemaJsCreateColumns = names(schemaJsCreateDefinitions);
  } catch (err) {
    errors.push(`worker/db/schema.js CREATE TABLE parse failed: ${err.message}`);
  }

  try {
    schemaJsLazyAlterDefinitions = parseLazyAlterColumns(schemaJs);
    schemaJsLazyAlterColumns = names(schemaJsLazyAlterDefinitions);
  } catch (err) {
    errors.push(`worker/db/schema.js lazy ALTER parse failed: ${err.message}`);
  }

  assertColumnSet(errors, 'worker/schema.sql CREATE TABLE leads', schemaSqlCreateColumns, EXPECTED_LEADS_COLUMNS);
  assertColumnSet(errors, 'worker/db/schema.js CREATE TABLE leads', schemaJsCreateColumns, EXPECTED_LEADS_COLUMNS);
  assertColumnSet(
    errors,
    'worker/db/schema.js lazy ALTER leads',
    schemaJsLazyAlterColumns,
    EXPECTED_LEADS_LAZY_ALTER_COLUMNS
  );
  assertDefinitionsMatch(
    errors,
    'worker/schema.sql CREATE TABLE leads',
    schemaSqlCreateDefinitions,
    'worker/db/schema.js CREATE TABLE leads',
    schemaJsCreateDefinitions
  );
  assertLazyDefinitionsMatchCreate(errors, schemaJsCreateDefinitions, schemaJsLazyAlterDefinitions);

  for (const column of DRIFT_CRITICAL_COLUMNS) {
    if (!schemaSqlCreateColumns.includes(column)) {
      errors.push(`critical lead column ${column} missing from worker/schema.sql CREATE TABLE leads`);
    }
    if (!schemaJsCreateColumns.includes(column)) {
      errors.push(`critical lead column ${column} missing from worker/db/schema.js CREATE TABLE leads`);
    }
    if (!schemaJsLazyAlterColumns.includes(column)) {
      errors.push(`critical lead column ${column} missing from worker/db/schema.js lazy ALTER leads`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    sources: {
      schemaSqlCreateColumns,
      schemaJsCreateColumns,
      schemaJsLazyAlterColumns,
      schemaSqlCreateDefinitions,
      schemaJsCreateDefinitions,
      schemaJsLazyAlterDefinitions,
    },
  };
}

function runCli() {
  const repoRoot = path.resolve(__dirname, '..');
  const schemaSqlPath = path.join(repoRoot, 'worker/schema.sql');
  const schemaJsPath = path.join(repoRoot, 'worker/db/schema.js');
  const result = validateSchemaSources({
    schemaSql: fs.readFileSync(schemaSqlPath, 'utf8'),
    schemaJs: fs.readFileSync(schemaJsPath, 'utf8'),
  });

  if (!result.ok) {
    console.error('D1 schema consistency check failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('D1 schema consistency check passed.');
  console.log(`- worker/schema.sql CREATE TABLE leads: ${result.sources.schemaSqlCreateColumns.length} columns`);
  console.log(`- worker/db/schema.js CREATE TABLE leads: ${result.sources.schemaJsCreateColumns.length} columns`);
  console.log(`- worker/db/schema.js lazy ALTER leads: ${result.sources.schemaJsLazyAlterColumns.length} columns`);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  DRIFT_CRITICAL_COLUMNS,
  EXPECTED_LEADS_COLUMNS,
  EXPECTED_LEADS_LAZY_ALTER_COLUMNS,
  parseCreateTableColumns,
  parseLazyAlterColumns,
  validateSchemaSources,
};
