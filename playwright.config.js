// playwright.config.js
module.exports = {
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: "retain-on-failure",
  },
  timeout: 60000,
};

// playwright.config.js
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
