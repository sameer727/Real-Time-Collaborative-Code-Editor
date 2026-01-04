const { test, expect } = require('@playwright/test');

test('collaboration updates propagate between two pages', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  // wait for server to be ready by trying to load /editor.html
  async function waitForServerViaPage(page, retries = 20, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const resp = await page.goto('/editor.html', { waitUntil: 'domcontentloaded', timeout: 5000 });
        if (resp && resp.ok()) return true;
      } catch (e) {
        // ignore
      }
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error('Server did not become ready');
  }

  await waitForServerViaPage(page1);

  // Create a room via server API from the browser context (avoids Node fetch issues)
  await page1.goto('/editor.html');
  const data = await page1.evaluate(async () => {
    const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    return res.json();
  });
  const roomId = data.roomId;

  await page1.goto(`/editor.html?room=${roomId}`);
  await page2.goto(`/editor.html?room=${roomId}`);

  // Wait for editors and Yjs binding to be available
  await page1.waitForFunction((rid) => !!(window.__rtcEditors && window.__rtcEditors[rid] && window.__rtcDiag && window.__rtcDiag[rid] && window.__rtcDiag[rid].hasYMonaco), roomId, { timeout: 15000 });
  await page2.waitForFunction((rid) => !!(window.__rtcEditors && window.__rtcEditors[rid] && window.__rtcDiag && window.__rtcDiag[rid] && window.__rtcDiag[rid].hasYMonaco), roomId, { timeout: 15000 });

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
