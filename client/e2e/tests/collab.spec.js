const { test, expect } = require('@playwright/test');

test('collaboration updates propagate between two pages', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();
  // wait for server to be ready (poll /api/health)
  async function waitForServer(page, retries = 20, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await page.request.get('/api/health');
        if (res.ok()) return true;
      } catch (e) {
        // ignore
      }
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error('Server did not become ready');
  }

  await waitForServer(page1);

  // Create a room via server API from the browser context (avoids Node fetch issues)
  await page1.goto('/editor.html');
  const data = await page1.evaluate(async () => {
    const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    return res.json();
  });
  const roomId = data.roomId;

  await page1.goto(`/editor.html?room=${roomId}`);
  await page2.goto(`/editor.html?room=${roomId}`);

  // Wait for editors and vendor libs to be available
  await page1.waitForFunction((rid) => {
    const diag = window.__rtcDiag && window.__rtcDiag[rid];
    return !!diag && diag.hasMonaco && diag.hasY && diag.hasYMonaco && !!(window.__rtcEditors && window.__rtcEditors[rid]);
  }, roomId, { timeout: 45000 });
  await page2.waitForFunction((rid) => {
    const diag = window.__rtcDiag && window.__rtcDiag[rid];
    return !!diag && diag.hasMonaco && diag.hasY && diag.hasYMonaco && !!(window.__rtcEditors && window.__rtcEditors[rid]);
  }, roomId, { timeout: 45000 });

  // Set value in page1
  await page1.evaluate((rid) => {
    window.__rtcEditors[rid].setValue('console.log("hello-playwright")');
  }, roomId);

  // Wait for page2 to observe the change
  await page2.waitForFunction((rid) => {
    return window.__rtcEditors && window.__rtcEditors[rid] && window.__rtcEditors[rid].getValue().includes('hello-playwright');
  }, roomId);

  const value = await page2.evaluate((rid) => window.__rtcEditors[rid].getValue(), roomId);
  expect(value).toContain('hello-playwright');

  await page1.close();
  await page2.close();
});
