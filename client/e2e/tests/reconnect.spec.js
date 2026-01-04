const { test, expect } = require('@playwright/test');

// Test that forcing a save, closing and reopening restores the document
test('reconnect restores persisted content', async ({ browser }) => {
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

  // create room
  await page.goto('/editor.html');
  const data = await page.evaluate(async () => {
    const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    return res.json();
  });
  const roomId = data.roomId;

  await page.goto(`/editor.html?room=${roomId}`);

  // wait for editor & ydoc and runtime bindings to be ready
  await page.waitForFunction(rid => !!(window.__rtcEditors && window.__rtcEditors[rid] && window.__rtcYDocs && window.__rtcYDocs[rid] && window.__rtcDiag && window.__rtcDiag[rid] && window.__rtcDiag[rid].hasYMonaco), roomId, { timeout: 15000 });

  // set value in editor
  await page.evaluate(rid => {
    window.__rtcEditors[rid].setValue('// reconnect test\nconsole.log("reconnect-success");');
  }, roomId);

  // capture Yjs update from page and persist via API
  const updateBase64 = await page.evaluate(rid => {
    const ydoc = window.__rtcYDocs[rid];
    const update = Y.encodeStateAsUpdate(ydoc);
    // convert Uint8Array to base64
    let s = '';
    for (let i = 0; i < update.length; i++) s += String.fromCharCode(update[i]);
    return btoa(s);
  }, roomId);

  await page.request.post(`/api/rooms/${roomId}/save`, { data: { updateBase64 } });

  // close page (simulate leaving)
  await page.close();

  // open new page to same room
  const page2 = await browser.newPage();
  await page2.goto(`/editor.html?room=${roomId}`);

  // wait for editor to load and for the content to appear
  await page2.waitForFunction(rid => window.__rtcEditors && window.__rtcEditors[rid] && window.__rtcEditors[rid].getValue && window.__rtcEditors[rid].getValue().includes('reconnect-success'), roomId, { timeout: 10000 });

  const value = await page2.evaluate(rid => window.__rtcEditors[rid].getValue(), roomId);
  expect(value).toContain('reconnect-success');

  await page2.close();
});