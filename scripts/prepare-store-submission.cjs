const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');
const submissionDir = path.join(buildDir, 'store-submission');

const requiredFiles = [
  'focusgate-extension.zip',
  'focusgate-firefox.zip',
];
const requiredAssets = [
  'icon-128.png',
  'screenshot-popup.png',
  'screenshot-onboarding.png',
  'screenshot-blocked.png',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(buildDir, file))) {
    console.error(`Missing package: build/${file}`);
    process.exit(1);
  }
}
for (const file of requiredAssets) {
  if (!fs.existsSync(path.join(projectRoot, 'store-assets', file))) {
    console.error(`Missing store asset: store-assets/${file}`);
    process.exit(1);
  }
}

fs.rmSync(submissionDir, {recursive: true, force: true});
fs.mkdirSync(path.join(submissionDir, 'store-assets'), {recursive: true});

for (const file of requiredFiles) {
  fs.copyFileSync(path.join(buildDir, file), path.join(submissionDir, file));
}
for (const file of ['LICENSE', 'STORE_LISTING.md']) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(submissionDir, file));
}
for (const file of requiredAssets) {
  fs.copyFileSync(
    path.join(projectRoot, 'store-assets', file),
    path.join(submissionDir, 'store-assets', file),
  );
}

console.log(`Prepared ${path.relative(projectRoot, submissionDir)}`);