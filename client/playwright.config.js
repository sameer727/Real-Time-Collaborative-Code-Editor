/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './e2e/tests',
  timeout: 30000,
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:5000'
  }
};
