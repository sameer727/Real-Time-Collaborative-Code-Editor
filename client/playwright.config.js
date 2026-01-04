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
  },

  // Ensure the server is started and reachable before tests run
  webServer: {
    command: 'node ../server/src/index.js',
    url: 'http://127.0.0.1:5000',
    timeout: 120000,
    reuseExistingServer: true
  }
};
