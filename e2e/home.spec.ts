import { test, expect } from '@playwright/test';

test('home page shows user from API', async ({ page }) => {
  await page.goto('/');

  // Title renders
  await expect(page.getByRole('heading', { level: 1, name: /home-core web/i })).toBeVisible();

  // Section heading
  await expect(page.getByRole('heading', { level: 2, name: /User \(validated via Zod\)/i })).toBeVisible();

  // Data fetched from API and displayed
  await expect(page.getByText('Name: Ada Lovelace')).toBeVisible();
  await expect(page.getByText('Email: ada@example.com')).toBeVisible();
  await expect(page.getByText('ID: u_1')).toBeVisible();
});
