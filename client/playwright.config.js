/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './e2e/tests',
  timeout: 60000,
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:5000',
    actionTimeout: 60000,
    navigationTimeout: 60000,
    // Keep helpful artifacts for CI failures
    screenshot: 'only-on-failure',
    trace: 'on'
  }
};
