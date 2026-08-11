const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const buildDir = path.join(projectRoot, 'build');
const browser = (process.argv[2] || 'chrome').toLowerCase();
const archiveNames = {
  chrome: 'focusgate-chrome.zip',
  edge: 'focusgate-edge.zip',
};

if (!archiveNames[browser]) {
  console.error('Usage: node scripts/package-extension.cjs <chrome|edge>');
  process.exit(1);
}

const archivePath = path.join(buildDir, archiveNames[browser]);

if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error('dist/manifest.json was not found. Run "npm run build:extension" first.');
  process.exit(1);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'),
);

if (manifest.manifest_version !== 3) {
  console.error('The extension manifest must use Manifest V3.');
  process.exit(1);
}

const requiredIcons = ['16', '32', '48', '128'];
for (const size of requiredIcons) {
  const iconPath = path.join(distDir, 'icons', `icon-${size}.png`);
  if (!fs.existsSync(iconPath)) {
    console.error(`Missing required extension icon: ${path.relative(projectRoot, iconPath)}`);
    process.exit(1);
  }
}

if (!manifest.icons || !manifest.action?.default_icon) {
  console.error('The extension manifest must declare toolbar and package icons.');
  process.exit(1);
}

fs.mkdirSync(buildDir, {recursive: true});
fs.rmSync(archivePath, {force: true});

try {
  execFileSync('zip', ['-r', archivePath, '.'], {
    cwd: distDir,
    stdio: 'inherit',
  });
} catch (error) {
  console.error(
    'Could not create the ZIP archive. Install the "zip" command and try again.',
  );
  process.exit(error.status || 1);
}

console.log(`Created ${path.relative(projectRoot, archivePath)}`);