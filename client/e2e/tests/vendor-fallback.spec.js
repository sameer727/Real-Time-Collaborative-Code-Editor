const { test, expect } = require('@playwright/test');

test('vendor bundle is used and YMonaco binding completes', async ({ browser }) => {
  const page = await browser.newPage();

  // wait for server by trying to load the editor page
  let healthy = false;
  for (let i = 0; i < 20; i++) {
    try {
      const resp = await page.goto('/editor.html', { waitUntil: 'domcontentloaded', timeout: 5000 });
      if (resp && resp.ok()) { healthy = true; break; }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!healthy) throw new Error('Server not ready');

  // create a room via API
  await page.goto('/editor.html');
  const data = await page.evaluate(async () => {
    const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    return res.json();
  });
  const roomId = data.roomId;

  // open the editor page for the created room
  await page.goto(`/editor.html?room=${roomId}`);

  // Wait for diagnostics: prefer local vendor and YMonaco binding completion
  await page.waitForFunction(rid => {
    const d = window.__rtcDiag && window.__rtcDiag[rid];
    return !!d && d.usedVendor === 'local' && !!d.hasYMonaco;
  }, roomId, { timeout: 15000 });

  const diag = await page.evaluate(rid => window.__rtcDiag && window.__rtcDiag[rid], roomId);
  expect(diag).toBeTruthy();
  expect(diag.usedVendor).toBe('local');
  expect(diag.hasYMonaco).toBeTruthy();

  await page.close();
});
