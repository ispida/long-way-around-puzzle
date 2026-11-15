/**
 * End-to-end tests against the built app (`vite preview` serves dist/).
 * Locally a pre-installed Chromium can be used via PW_CHROMIUM_PATH; CI installs Playwright's own.
 */
import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // The first-visit "How to play" pop-up counts as seen; tests/e2e/intro.spec.ts starts without it.
    storageState: {
      cookies: [],
      origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: "lwr:intro", value: "1" }] }],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: [
    {
      command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
