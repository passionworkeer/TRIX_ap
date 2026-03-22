// Clean stale web app artifacts from dist-desktop/renderer/
// These files come from an old build configuration that mixed web app output
const fs = require('fs');
const path = require('path');

const rendererDir = path.join(__dirname, 'dist-desktop/renderer');
const staleItems = [
  '3d',
  'companion-check.html',
  'env-check.html',
  'pairing.html',
  'manifest.json',
  'sw.js',
  'desktop',
];

let cleaned = 0;
staleItems.forEach(item => {
  const fullPath = path.join(rendererDir, item);
  try {
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      const stats = fs.statSync(fullPath);
      console.log(`Removed stale: ${item}`);
      cleaned++;
    }
  } catch (e) {
    // ignore
  }
});
console.log(`Cleaned ${cleaned} stale artifact(s)`);
