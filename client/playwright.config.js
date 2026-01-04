/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
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

// In CI we start the server as a separate step; avoid starting it twice there.
if (!process.env.CI) {
  config.webServer = {
    command: 'node ../server/src/index.js',
    url: 'http://127.0.0.1:5000',
    timeout: 120000,
    reuseExistingServer: true
  };
}

module.exports = config;
