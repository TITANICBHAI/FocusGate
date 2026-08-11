const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const askpassScript = path.join(__dirname, 'github-askpass.cjs');
const repositoryUrl = 'https://github.com/TITANICBHAI/FocusGate.git';
const intervalMs = Math.max(
  15_000,
  Number.parseInt(process.env.GITHUB_SYNC_INTERVAL_SECONDS || '60', 10) *
    1_000,
);

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

function syncOnce() {
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    log(
      'GITHUB_PERSONAL_ACCESS_TOKEN is not configured; waiting for the secret before syncing.',
    );
    return;
  }

  ensureOrigin();
  const branch = currentBranch();
  const status = git(['status', '--porcelain']);

  if (status) {
    git(['add', '--all'], {stdio: 'inherit'});
    if (hasStagedChanges()) {
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
  }

  try {
    git(['push', 'origin', branch], {stdio: 'inherit'});
    log(`Pushed ${branch} to GitHub.`);
  } catch (error) {
    log(
      `Push could not complete: ${error.message.split('\n')[0]}. Will retry.`,
    );
  }
}

if (!fs.existsSync(path.join(projectRoot, '.git'))) {
  console.error('[github-sync] This project is not a Git repository.');
  process.exit(1);
}

log(
  `Watching ${repositoryUrl} every ${Math.round(intervalMs / 1000)} seconds.`,
);

let running = true;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    running = false;
    log(`Received ${signal}; stopping.`);
  });
}

async function main() {
  while (running) {
    try {
      syncOnce();
    } catch (error) {
      log(`Sync check failed: ${error.message.split('\n')[0]}. Will retry.`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(`[github-sync] ${error.message}`);
  process.exit(1);
});