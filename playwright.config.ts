import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://localhost:3001", ...devices["Desktop Chrome"] },
});
