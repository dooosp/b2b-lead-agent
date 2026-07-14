import {
  D1_MIGRATION_MANIFEST,
  D1_SCHEMA_MIGRATION_TABLE,
  buildD1SchemaIntrospectionQuery,
  buildD1SchemaObjectIntrospectionQuery,
  validateD1MigrationChain,
  validateD1SchemaIntrospection,
  validateD1SchemaObjects,
} from './migration-manifest.js';

export const D1_SCHEMA_NOT_READY_CODE = 'ERR_D1_SCHEMA_NOT_READY';

const readinessByDatabase = new WeakMap();

function rowsFrom(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.results) ? result.results : [];
}

function schemaNotReady(cause, details = 'schema readiness could not be verified') {
  const error = new Error(
    `${D1_SCHEMA_NOT_READY_CODE}: ${details}. `
    + 'Run the explicit migration workflow before serving requests.'
  );
  error.code = D1_SCHEMA_NOT_READY_CODE;
  if (cause) error.cause = cause;
  return error;
}

async function queryRows(db, sql) {
  return rowsFrom(await db.prepare(sql).all());
}

async function assertD1SchemaReady(db) {
  let ledgerRows;
  try {
    ledgerRows = await queryRows(
      db,
      `SELECT version, name FROM ${D1_SCHEMA_MIGRATION_TABLE} ORDER BY version ASC `
      + `LIMIT ${D1_MIGRATION_MANIFEST.length + 1}`
    );
  } catch (cause) {
    throw schemaNotReady(cause, 'migration ledger is unavailable');
  }

  const chainErrors = validateD1MigrationChain(ledgerRows, { requireComplete: true });
  if (chainErrors.length > 0) {
    throw schemaNotReady(null, chainErrors.join('; '));
  }

  let schemaRows;
  try {
    schemaRows = await queryRows(db, buildD1SchemaIntrospectionQuery());
  } catch (cause) {
    throw schemaNotReady(cause, 'canonical schema introspection failed');
  }
  const shapeErrors = validateD1SchemaIntrospection(schemaRows);
  if (shapeErrors.length > 0) {
    throw schemaNotReady(null, shapeErrors.join('; '));
  }

  let schemaObjectRows;
  try {
    schemaObjectRows = await queryRows(db, buildD1SchemaObjectIntrospectionQuery());
  } catch (cause) {
    throw schemaNotReady(cause, 'canonical index and constraint introspection failed');
  }
  const schemaObjectErrors = validateD1SchemaObjects(schemaObjectRows, {
    schemaColumnRows: schemaRows,
  });
  if (schemaObjectErrors.length > 0) {
    throw schemaNotReady(null, schemaObjectErrors.join('; '));
  }

  return D1_MIGRATION_MANIFEST.length;
}

export async function ensureD1Schema(db) {
  if (!db) return;

  let readiness = readinessByDatabase.get(db);
  if (!readiness) {
    readiness = assertD1SchemaReady(db).catch((error) => {
      readinessByDatabase.delete(db);
      throw error;
    });
    readinessByDatabase.set(db, readiness);
  }
  await readiness;
}
