const { execSync, spawn } = require('child_process');
const { chromium } = require('playwright');

async function main() {
  const EXE_PATH = 'E:\\desktop\\TRIX-Setup-v2\\win-unpacked\\TRIX Companion.exe';

  // Kill existing Electron instance
  console.log('Stopping existing TRIX Companion...');
  try {
    execSync('taskkill /PID 55304 /F', { stdio: 'ignore' });
  } catch (e) {
    // Already gone or can't kill
    console.log('Kill result (ignored):', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));

  // Launch with remote debugging
  console.log('Launching with --remote-debugging-port=9222...');
  const electronProc = spawn(EXE_PATH, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  electronProc.unref();

  // Wait for CDP to become available
  console.log('Waiting for CDP port 9222...');
  let cdpReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const http = require('http');
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9222/json', res => {
          resolve(res);
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      cdpReady = true;
      console.log('CDP port ready after', (i + 1) * 1000, 'ms');
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!cdpReady) {
    console.error('CDP port 9222 never became available');
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 3000)); // extra buffer for windows

  // Connect via CDP
  console.log('Connecting via CDP...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');

  const contexts = browser.contexts();
  console.log('Contexts:', contexts.length);

  let floatPage = null;

  for (const ctx of contexts) {
    const pages = await ctx.pages();
    console.log(`Context has ${pages.length} pages`);
    for (const p of pages) {
      const title = await p.title().catch(() => 'N/A');
      console.log(`  Page title: "${title}"`);
      if (title.includes('Float')) {
        floatPage = p;
        break;
      }
    }
    if (floatPage) break;
  }

  // Also try CDP Target.getTargets
  if (!floatPage) {
    try {
      const cdpSession = await browser.newCDPSession(browser);
      const resp = await cdpSession.send('Target.getTargets');
      console.log('CDP Targets:', JSON.stringify(resp.targetInfos, null, 2));
      for (const t of resp.targetInfos || []) {
        if (t.title && t.title.toLowerCase().includes('float')) {
          console.log('Found float target via CDP:', t.targetId);
          // Try to find existing page by title
          for (const ctx of browser.contexts()) {
            for (const p of await ctx.pages()) {
              if ((await p.title().catch(() => '')).includes('Float')) {
                floatPage = p;
                break;
              }
            }
            if (floatPage) break;
          }
        }
      }
    } catch (e) {
      console.log('CDP Target.getTargets error:', e.message);
    }
  }

  if (!floatPage) {
    console.log('Float window not found among', contexts.length, 'contexts.');
    // Take screenshot of all pages
    for (const ctx of contexts) {
      const pages = await ctx.pages();
      for (const p of pages) {
        const title = await p.title().catch(() => 'N/A');
        console.log(`Screenshooting: "${title}"`);
        await p.screenshot({ path: `E:/desktop/float-pet-new-${title.replace(/[^a-z0-9]/gi, '_')}.png` });
        console.log('Saved for:', title);
      }
    }
  } else {
    console.log('Screenshotting float page:', await floatPage.title());
    await floatPage.screenshot({ path: 'E:/desktop/float-pet-new.png', fullPage: false });
    console.log('Saved to E:/desktop/float-pet-new.png');
  }

  await browser.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
