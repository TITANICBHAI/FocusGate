const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const buildDir = path.join(projectRoot, 'build');
const firefoxDistDir = path.join(buildDir, 'firefox-dist');
const archivePath = path.join(buildDir, 'focusgate-firefox.zip');
const manifestPath = path.join(distDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('dist/manifest.json was not found. Run "npm run build:extension" first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  console.error('The Firefox manifest must use Manifest V3.');
  process.exit(1);
}

fs.mkdirSync(buildDir, {recursive: true});
fs.rmSync(firefoxDistDir, {recursive: true, force: true});
fs.cpSync(distDir, firefoxDistDir, {recursive: true});

const firefoxManifest = {
  ...manifest,
  browser_specific_settings: {
    gecko: {
      id: 'focusgate@tbtechs.com',
      strict_min_version: '128.0',
    },
  },
};
fs.writeFileSync(
  path.join(firefoxDistDir, 'manifest.json'),
  `${JSON.stringify(firefoxManifest, null, 2)}\n`,
);

fs.rmSync(archivePath, {force: true});
try {
  execFileSync('zip', ['-r', archivePath, '.'], {
    cwd: firefoxDistDir,
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Could not create the Firefox ZIP archive. Install the "zip" command and try again.');
  process.exit(error.status || 1);
}

fs.rmSync(firefoxDistDir, {recursive: true, force: true});
console.log(`Created ${path.relative(projectRoot, archivePath)}`);