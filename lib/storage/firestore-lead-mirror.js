const { assertGoogleCredentialsFileExists } = require('./google-auth-preflight');

function requireFirestoreSdk() {
  try {
    return require('@google-cloud/firestore');
  } catch (error) {
    const sdkError = new Error(
      'Firestore mirror is enabled but @google-cloud/firestore is not installed. Add the package before enabling LEAD_STORAGE_FIRESTORE_COLLECTION.'
    );
    sdkError.cause = error;
    throw sdkError;
  }
}

async function listCollectionDocumentIds(collectionRef) {
  const snapshot = await collectionRef.get();
  return snapshot.docs.map((doc) => doc.id);
}

async function commitInChunks(chunks) {
  for (const chunk of chunks) {
    await chunk.commit();
  }
}

function createBatchWriter(db) {
  const batches = [];
  let batch = db.batch();
  let operations = 0;

  function rotateBatch() {
    batches.push(batch);
    batch = db.batch();
    operations = 0;
  }

  function ensureCapacity() {
    if (operations >= 450) {
      rotateBatch();
    }
  }

  return {
    set(ref, value, options) {
      ensureCapacity();
      batch.set(ref, value, options);
      operations += 1;
    },
    delete(ref) {
      ensureCapacity();
      batch.delete(ref);
      operations += 1;
    },
    async commit() {
      if (operations > 0) {
        batches.push(batch);
      }
      if (batches.length === 0) {
        return;
      }
      await commitInChunks(batches);
    },
  };
}

function createFirestoreLeadMirrorAdapter(config = {}) {
  const collectionRoot = typeof config.collectionRoot === 'string' ? config.collectionRoot.trim() : '';
  if (!collectionRoot) {
    return null;
  }

  return {
    name: 'firestore-lead-mirror',
    async publish(context) {
      assertGoogleCredentialsFileExists();
      const { Firestore } = requireFirestoreSdk();
      const ownsClient = !config.client;
      const db = config.client || new Firestore(config.clientOptions);

      try {
        const profileRef = db.collection(collectionRoot).doc(context.profile.id);
        const latestCollection = profileRef.collection('latest_leads');
        const historyCollection = profileRef.collection('lead_history');
        const publishStateRef = profileRef.collection('publish_state').doc('current');
        const latestLeadIds = new Set(context.latestLeads.map((lead) => String(lead.id)));
        const existingLatestLeadIds = await listCollectionDocumentIds(latestCollection);
        const batchWriter = createBatchWriter(db);

        batchWriter.set(profileRef, {
          profileId: context.profile.id,
          profileName: context.profile.name || '',
          lastPublishedAt: context.nowIso,
        }, { merge: true });

        batchWriter.set(publishStateRef, {
          updatedAt: context.nowIso,
          latestLeadCount: context.latestLeads.length,
          historyLeadCount: context.leadHistory.length,
          artifactPaths: {
            report: context.artifactPaths.reportPath,
            latest: context.artifactPaths.latestLeadsPath,
            history: context.artifactPaths.historyPath,
          },
        }, { merge: true });

        for (const lead of context.latestLeads) {
          batchWriter.set(latestCollection.doc(String(lead.id)), lead, { merge: true });
        }

        for (const staleLeadId of existingLatestLeadIds) {
          if (!latestLeadIds.has(staleLeadId)) {
            batchWriter.delete(latestCollection.doc(staleLeadId));
          }
        }

        for (const lead of context.leadHistory) {
          batchWriter.set(historyCollection.doc(String(lead.id)), lead, { merge: true });
        }

        await batchWriter.commit();
      } finally {
        if (ownsClient && typeof db.terminate === 'function') {
          try {
            await db.terminate();
          } catch (_) {
            // Best-effort cleanup for transient publisher-side clients.
          }
        }
      }
    },
  };
}

function createFirestoreLeadMirrorAdapterFromEnv(options = {}) {
  const env = options.env || process.env;
  const collectionRoot = typeof env.LEAD_STORAGE_FIRESTORE_COLLECTION === 'string'
    ? env.LEAD_STORAGE_FIRESTORE_COLLECTION.trim()
    : '';

  if (!collectionRoot) {
    return null;
  }

  return createFirestoreLeadMirrorAdapter({
    collectionRoot,
  });
}

module.exports = {
  createFirestoreLeadMirrorAdapter,
  createFirestoreLeadMirrorAdapterFromEnv,
};
