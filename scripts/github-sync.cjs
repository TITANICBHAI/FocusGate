const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const askpassScript = path.join(__dirname, 'github-askpass.cjs');
const repositoryUrl = 'https://github.com/TITANICBHAI/FocusGate.git';
const actionPollMs = Math.max(
  15_000,
  Number.parseInt(process.env.GITHUB_ACTION_POLL_SECONDS || '20', 10) *
    1_000,
);
const actionTimeoutMs = Math.max(
  60_000,
  Number.parseInt(process.env.GITHUB_ACTION_TIMEOUT_SECONDS || '900', 10) *
    1_000,
);
const workflowFile = 'build-extension.yml';

fs.chmodSync(askpassScript, 0o755);

const gitEnvironment = {
  ...process.env,
  GIT_ASKPASS: askpassScript,
  GIT_TERMINAL_PROMPT: '0',
};

function git(args, options = {}) {
  const result = execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: gitEnvironment,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
  return typeof result === 'string' ? result.trim() : '';
}

function log(message) {
  console.log(`[github-sync] ${new Date().toISOString()} ${message}`);
}

function ensureOrigin() {
  const origin = git(['remote', 'get-url', 'origin']);
  if (origin !== repositoryUrl) {
    git(['remote', 'set-url', 'origin', repositoryUrl]);
    log(`Configured origin as ${repositoryUrl}`);
  }
}

function currentBranch() {
  const branch = git(['branch', '--show-current']);
  if (!branch || branch === 'HEAD') {
    throw new Error('The repository is detached or has no checked-out branch.');
  }
  return branch;
}

function hasStagedChanges() {
  try {
    git(['diff', '--cached', '--quiet']);
    return false;
  } catch {
    return true;
  }
}

function commitChanges(branch) {
  const status = git(['status', '--porcelain']);
  if (!status) return;

  git(['add', '--all'], {stdio: 'inherit'});
  if (!hasStagedChanges()) return;

  git(
    [
      '-c',
      'user.name=FocusGate Replit Sync',
      '-c',
      'user.email=focusgate-replit-sync@users.noreply.github.com',
      'commit',
      '-m',
      'chore: sync Replit changes',
    ],
    {stdio: 'inherit'},
  );
  log(`Committed local changes on ${branch}.`);
}

function pushChanges(branch) {
  git(['push', 'origin', branch], {stdio: 'inherit'});
  const commitSha = git(['rev-parse', 'HEAD']);
  log(`Pushed ${branch} to GitHub at ${commitSha}.`);
  return commitSha;
}

async function githubRequest(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub API returned ${response.status}: ${details.slice(0, 240)}`,
    );
  }
  return response.json();
}

async function waitForExtensionBuild(commitSha) {
  const apiBase =
    'https://api.github.com/repos/TITANICBHAI/FocusGate/actions/workflows';
  const runsUrl = `${apiBase}/${workflowFile}/runs?head_sha=${commitSha}&event=push&per_page=20`;
  const startedAt = Date.now();
  let lastStatus = '';

  log(`Waiting for ${workflowFile} to start for ${commitSha}.`);

  while (Date.now() - startedAt < actionTimeoutMs) {
    const data = await githubRequest(runsUrl);
    const run = data.workflow_runs?.find(
      (candidate) =>
        candidate.head_sha === commitSha &&
        candidate.path?.endsWith(`.github/workflows/${workflowFile}`),
    );

    if (!run) {
      await new Promise((resolve) => setTimeout(resolve, actionPollMs));
      continue;
    }

    const state = `${run.status}:${run.conclusion || ''}`;
    if (state !== lastStatus) {
      lastStatus = state;
      log(`Extension build #${run.run_number}: ${run.status}.`);
    }

    if (run.status === 'completed') {
      if (run.conclusion !== 'success') {
        throw new Error(
          `Extension build ${run.conclusion}. Review ${run.html_url}`,
        );
      }

      const artifacts = await githubRequest(
        `https://api.github.com/repos/TITANICBHAI/FocusGate/actions/runs/${run.id}/artifacts`,
      );
      const artifact = artifacts.artifacts?.find(
        (candidate) => !candidate.expired,
      );
      log(
        artifact
          ? `Extension build succeeded. Download artifact: ${artifact.archive_download_url}`
          : `Extension build succeeded. Review ${run.html_url}`,
      );
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, actionPollMs));
  }

  throw new Error(
    `Timed out waiting for ${workflowFile}. Check ${apiBase}/${workflowFile}`,
  );
}

async function syncOnce() {
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    throw new Error(
      'GITHUB_PERSONAL_ACCESS_TOKEN is not configured in Replit Secrets.',
    );
  }

  ensureOrigin();
  const branch = currentBranch();
  commitChanges(branch);
  const commitSha = pushChanges(branch);
  await waitForExtensionBuild(commitSha);
}

if (!fs.existsSync(path.join(projectRoot, '.git'))) {
  console.error('[github-sync] This project is not a Git repository.');
  process.exit(1);
}

async function main() {
  try {
    await syncOnce();
    log('Sync and extension build watch completed; exiting.');
  } catch (error) {
    console.error(`[github-sync] ${error.message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[github-sync] ${error.message}`);
  process.exit(1);
});