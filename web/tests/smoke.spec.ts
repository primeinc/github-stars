import { test, expect } from '@playwright/test';

test('has title and loads data', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/web/);

  // Wait for the main content to load
  // The app shows "Star Vault" in the sidebar
  await expect(page.getByText('Star Vault')).toBeVisible({ timeout: 15000 });

  // Verify that some repositories are loaded
  // The app displays repository names as links
  const repoList = page.locator('main');
  await expect(repoList).not.toContainText('Loading repositories...');
  
  // Take a full page screenshot for verification
  await page.screenshot({ path: '../page-verification.png', fullPage: true });
});
