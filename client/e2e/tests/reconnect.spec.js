const { test, expect } = require('@playwright/test');

test('saved snapshot restores on reconnect', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  // Wait for server
  async function waitForServer(page, retries = 20, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await page.request.get('/api/health');
        if (res.ok()) return true;
      } catch (e) {}
      await new Promise(r => setTimeout(r, delay));
    }
    throw new Error('Server did not become ready');
  }

  await waitForServer(page1);

  // Create room via browser
  await page1.goto('/editor.html');
  const data = await page1.evaluate(async () => {
    const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    return res.json();
  });
  const roomId = data.roomId;

  // Join and set text
  await page1.goto(`/editor.html?room=${roomId}`);

  // forward console logs for debugging
  page1.on('console', m => console.log('PAGE1:', m.text()));
  page2.on('console', m => console.log('PAGE2:', m.text()));

  // quick diagnostics: check global objects
  const globals = await page1.evaluate(() => ({ hasMonaco: !!window.monaco, hasY: !!window.Y, hasYMonaco: !!window.YMonaco }));
  console.log('DIAG:', globals);

  // wait for editor/ydoc/forceSave and vendor libs (longer timeout)
  await page1.waitForFunction((rid) => {
    const diag = window.__rtcDiag && window.__rtcDiag[rid];
    return !!diag && diag.hasMonaco && diag.hasY && diag.hasYMonaco && !!(window.__rtcEditors && window.__rtcEditors[rid]) && !!(window.__rtcForceSave && window.__rtcYDocs && window.__rtcYDocs[rid]);
  }, roomId, { timeout: 60000 });

  // set editor value
  await page1.evaluate((rid) => {
    window.__rtcEditors[rid].setValue('console.log("persisted")');
  }, roomId);

  // Force save (synchronous from test perspective)
  await page1.evaluate(async (rid) => { await window.__rtcForceSave(rid); }, roomId);

  // Close first page to simulate disconnect
  await page1.close();

  // Re-open in new page (reconnect)
  await page2.goto(`/editor.html?room=${roomId}`);
  await page2.waitForFunction((rid) => {
    const diag = window.__rtcDiag && window.__rtcDiag[rid];
    return !!diag && diag.hasMonaco && diag.hasY && diag.hasYMonaco && !!(window.__rtcEditors && window.__rtcEditors[rid]);
  }, roomId, { timeout: 45000 });

  // Wait for value to be present
  await page2.waitForFunction((rid) => window.__rtcEditors[rid].getValue().includes('persisted'), roomId);
  const value = await page2.evaluate((rid) => window.__rtcEditors[rid].getValue(), roomId);
  expect(value).toContain('persisted');

  await page2.close();
});