const fs = require('fs/promises');
const path = require('path');

process.env.B2B_LOAD_DOTENV = '0';

const { parseCliArgs, printUsage, runPipeline } = require('../main');

const REPORT_FILENAMES = ['latest_leads.json', 'lead_history.json'];

function getGithubConfig() {
  const repo = String(process.env.GITHUB_REPO || '').trim();
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const branch = String(process.env.GITHUB_BRANCH || 'master').trim();

  if (!repo || !token) {
    throw new Error('Cloud Run artifact sync requires GITHUB_REPO and GITHUB_TOKEN.');
  }

  return { repo, token, branch };
}

function githubHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'b2b-lead-agent-cloud-run-job',
  };
}

function getArtifactPath(profileId, filename) {
  return `reports/${profileId}/${filename}`;
}

async function ensureReportDirectory(profileId) {
  await fs.mkdir(path.join(__dirname, '..', 'reports', profileId), { recursive: true });
}

async function fetchGithubContent(config, filePath) {
  const response = await fetch(
    `https://api.github.com/repos/${config.repo}/contents/${filePath}?ref=${encodeURIComponent(config.branch)}`,
    { headers: githubHeaders(config.token) }
  );

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub content fetch failed for ${filePath} (${response.status}).`);
  }

  const content = Buffer.from(String(payload.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  return {
    path: filePath,
    sha: payload.sha,
    content,
  };
}

async function syncArtifactBaseline(profileId, config) {
  await ensureReportDirectory(profileId);
  const baseline = {};

  for (const filename of REPORT_FILENAMES) {
    const filePath = getArtifactPath(profileId, filename);
    const localPath = path.join(__dirname, '..', filePath);
    const remoteFile = await fetchGithubContent(config, filePath);
    baseline[filePath] = remoteFile;
    if (remoteFile) {
      await fs.writeFile(localPath, remoteFile.content, 'utf8');
      continue;
    }

    await fs.rm(localPath, { force: true });
  }

  return baseline;
}

async function readLocalArtifact(profileId, filename) {
  const filePath = path.join(__dirname, '..', 'reports', profileId, filename);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function githubRequest(config, resourcePath, init = {}) {
  const response = await fetch(`https://api.github.com${resourcePath}`, {
    ...init,
    headers: {
      ...githubHeaders(config.token),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `GitHub API request failed (${response.status}).`);
  }

  return payload;
}

async function createGithubBlob(config, content) {
  const payload = await githubRequest(config, `/repos/${config.repo}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      encoding: 'utf-8',
    }),
  });

  return payload.sha;
}

async function commitArtifactChanges(config, changes, message) {
  if (changes.length === 0) {
    return null;
  }

  const ref = await githubRequest(config, `/repos/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`);
  const baseCommitSha = ref.object?.sha;
  if (!baseCommitSha) {
    throw new Error(`Unable to resolve GitHub branch head for ${config.branch}.`);
  }

  const baseCommit = await githubRequest(config, `/repos/${config.repo}/git/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree?.sha;
  if (!baseTreeSha) {
    throw new Error(`Unable to resolve GitHub tree for ${config.branch}.`);
  }

  const tree = [];
  for (const change of changes) {
    const blobSha = await createGithubBlob(config, change.content);
    tree.push({
      path: change.path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
  }

  const newTree = await githubRequest(config, `/repos/${config.repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree,
    }),
  });

  const commit = await githubRequest(config, `/repos/${config.repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: newTree.sha,
      parents: [baseCommitSha],
    }),
  });

  await githubRequest(config, `/repos/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.sha;
}

async function publishArtifacts(profileId, baseline, config) {
  const changes = [];

  for (const filename of REPORT_FILENAMES) {
    const artifactPath = getArtifactPath(profileId, filename);
    const localContent = await readLocalArtifact(profileId, filename);
    if (localContent == null) {
      continue;
    }

    const baselineContent = baseline[artifactPath]?.content || null;
    if (localContent === baselineContent) {
      continue;
    }

    changes.push({
      path: artifactPath,
      content: localContent,
    });
  }

  return commitArtifactChanges(config, changes, `Update ${profileId} leads data`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);

  if (options.help) {
    printUsage();
    return 0;
  }

  const githubConfig = getGithubConfig();
  const baseline = await syncArtifactBaseline(options.profileId, githubConfig);

  await runPipeline({
    profileId: options.profileId,
    sendEmail: options.email,
  });

  await publishArtifacts(options.profileId, baseline, githubConfig);
  return 0;
}

if (require.main === module) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}

module.exports = {
  commitArtifactChanges,
  getArtifactPath,
  getGithubConfig,
  main,
  publishArtifacts,
  syncArtifactBaseline,
};
