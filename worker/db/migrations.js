import {
  CREATE_MIGRATION_LEDGER_SQL,
  D1_MIGRATION_MANIFEST,
  D1_SCHEMA_MIGRATION_TABLE,
  LATEST_D1_SCHEMA_VERSION,
  LEADS_COLUMN_DEFINITIONS,
  buildD1SchemaIntrospectionQuery,
  buildD1SchemaObjectIntrospectionQuery,
  validateD1MigrationChain,
  validateD1SchemaIntrospection,
  validateD1SchemaObjects,
} from './migration-manifest.js';

export const LOCAL_TEST_D1_MIGRATION_TARGET = 'LOCAL_TEST_ONLY_NOT_REMOTE_D1';

function rowsFrom(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.results) ? result.results : [];
}

async function queryRows(db, sql) {
  return rowsFrom(await db.prepare(sql).all());
}

function schemaIncompatible(errors, cause) {
  const details = Array.isArray(errors) ? errors.join('; ') : String(errors);
  const error = new Error(`D1 schema is incompatible with the migration manifest: ${details}`);
  error.code = 'ERR_D1_SCHEMA_INCOMPATIBLE';
  if (cause) error.cause = cause;
  return error;
}

async function inspectMigrationTables(db, migration, { alreadyApplied = false } = {}) {
  let columnRows;
  let schemaObjectRows;
  try {
    columnRows = await queryRows(db, buildD1SchemaIntrospectionQuery(migration.tables));
    schemaObjectRows = await queryRows(
      db,
      buildD1SchemaObjectIntrospectionQuery(migration.tables, migration.indexSpecs)
    );
  } catch (cause) {
    throw schemaIncompatible('schema introspection failed', cause);
  }
  const errors = validateD1SchemaIntrospection(columnRows, {
    tableNames: migration.tables,
    allowMissingTables: !alreadyApplied,
    allowLegacyLeadSubset: !alreadyApplied && migration.introspectLeads,
  });
  errors.push(...validateD1SchemaObjects(schemaObjectRows, {
    tableNames: migration.tables,
    indexSpecs: migration.indexSpecs,
    schemaColumnRows: columnRows,
    allowMissingTables: !alreadyApplied,
    allowMissingIndexes: !alreadyApplied,
  }));
  if (errors.length > 0) throw schemaIncompatible(errors);
  return { columnRows, schemaObjectRows };
}

function migrationVersionInsert(migration) {
  const escapedName = migration.name.replaceAll("'", "''");
  return `INSERT INTO ${D1_SCHEMA_MIGRATION_TABLE} (version, name, applied_at) `
    + `VALUES (${migration.version}, '${escapedName}', CURRENT_TIMESTAMP)`;
}

function buildMigrationStatements(migration, inspection) {
  const statements = [...migration.createTables];
  const alteredColumns = [];

  if (migration.introspectLeads) {
    const existingColumns = new Set(
      inspection.columnRows
        .filter((row) => row.table_name === 'leads')
        .map((row) => String(row.name || ''))
    );
    if (existingColumns.size > 0) {
      for (const column of LEADS_COLUMN_DEFINITIONS) {
        if (column.name === 'id' || existingColumns.has(column.name)) continue;
        alteredColumns.push(column.name);
        statements.push(`ALTER TABLE leads ADD COLUMN ${column.name} ${column.definition}`);
      }
    }
  }

  statements.push(...migration.indexes);
  statements.push(migrationVersionInsert(migration));
  return { statements, alteredColumns };
}

function duplicateColumnName(error) {
  const message = String(error?.message || error || '');
  const match = /(?:^|[\s:])duplicate column name:\s*["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?\b/i.exec(message);
  return match ? match[1] : null;
}

async function runMigrationBatch(db, migration, allowDuplicateRetry = true, inspectedRows = null) {
  const inspection = inspectedRows || await inspectMigrationTables(db, migration);
  const plan = buildMigrationStatements(migration, inspection);
  try {
    await db.batch(plan.statements.map((sql) => db.prepare(sql)));
  } catch (error) {
    const duplicateColumn = duplicateColumnName(error);
    if (!allowDuplicateRetry || !duplicateColumn || !plan.alteredColumns.includes(duplicateColumn)) {
      throw error;
    }

    const retryRows = await inspectMigrationTables(db, migration);
    const currentColumns = new Set(
      retryRows.columnRows
        .filter((row) => row.table_name === 'leads')
        .map((row) => String(row.name || ''))
    );
    if (!currentColumns.has(duplicateColumn)) throw error;
    await runMigrationBatch(db, migration, false, retryRows);
  }
}

async function readAppliedMigrations(db) {
  return queryRows(
    db,
    `SELECT version, name FROM ${D1_SCHEMA_MIGRATION_TABLE} ORDER BY version ASC `
    + `LIMIT ${D1_MIGRATION_MANIFEST.length + 1}`
  );
}

/**
 * Local SQLite migration simulator only. It deliberately refuses ordinary D1
 * bindings; remote environments require a separately approved Wrangler flow.
 */
export async function applyLocalTestD1Migrations(db) {
  if (!db) throw new TypeError('A D1 database binding is required');
  if (db.localTestMigrationTarget !== LOCAL_TEST_D1_MIGRATION_TARGET) {
    const error = new Error(
      'Local/test migration helper refused a non-local target; use a separately approved Wrangler migration workflow'
    );
    error.code = 'ERR_D1_MIGRATION_LOCAL_TEST_ONLY';
    throw error;
  }

  await db.prepare(CREATE_MIGRATION_LEDGER_SQL).run();
  const ledgerRows = await queryRows(
    db,
    buildD1SchemaIntrospectionQuery([D1_SCHEMA_MIGRATION_TABLE])
  );
  const ledgerErrors = validateD1SchemaIntrospection(ledgerRows, {
    tableNames: [D1_SCHEMA_MIGRATION_TABLE],
  });
  if (ledgerErrors.length > 0) throw schemaIncompatible(ledgerErrors);

  const initialMigrations = await readAppliedMigrations(db);
  const chainErrors = validateD1MigrationChain(initialMigrations);
  if (chainErrors.length > 0) {
    const unsupported = initialMigrations.some(({ version }) => (
      Number(version) > LATEST_D1_SCHEMA_VERSION
    ));
    const error = schemaIncompatible(chainErrors);
    if (unsupported) error.code = 'ERR_D1_SCHEMA_VERSION_UNSUPPORTED';
    throw error;
  }

  const applied = new Set(initialMigrations.map(({ version }) => Number(version)));
  const appliedNow = [];
  for (const migration of D1_MIGRATION_MANIFEST) {
    if (applied.has(migration.version)) {
      await inspectMigrationTables(db, migration, { alreadyApplied: true });
      continue;
    }
    await runMigrationBatch(db, migration);
    applied.add(migration.version);
    appliedNow.push(migration.version);
  }

  return Object.freeze({
    appliedVersions: Object.freeze(appliedNow),
    currentVersion: LATEST_D1_SCHEMA_VERSION,
  });
}

export { duplicateColumnName };
