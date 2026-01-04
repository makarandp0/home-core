// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { test, expect } from '@playwright/test';

test('dashboard shows welcome page with quick links', async ({ page }) => {
  // With auth disabled (default for e2e), navigating to / redirects to /dashboard
  await page.goto('/dashboard');

  // App header renders
  await expect(page.getByRole('heading', { level: 1, name: /home-core web/i })).toBeVisible();

  // Dashboard welcome section
  await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
  await expect(page.getByText(/Your home dashboard/i)).toBeVisible();

  // Quick links are visible
  await expect(page.getByRole('button', { name: /Upload/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Documents/i })).toBeVisible();
});
