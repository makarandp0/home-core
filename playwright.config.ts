// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start API and Web for tests
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
});
