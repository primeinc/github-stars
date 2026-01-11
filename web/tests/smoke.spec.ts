import { test, expect } from '@playwright/test';

test('has title and loads data', async ({ page }) => {
  const url = 'https://primeinc.github.io/github-stars/';
  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('Current URL:', page.url());
  console.log('Current Title:', await page.title());

  // Wait for the correct title
  await expect(page).toHaveTitle(/web/, { timeout: 30000 });

  console.log('Title verified. Waiting for "Star Vault" visibility...');

  // Wait for the main content to load
  await expect(page.getByText('Star Vault')).toBeVisible({ timeout: 15000 });

  console.log('Sidebar loaded. Verifying data load...');

  // Verify that some repositories are loaded
  const mainContent = page.locator('main');
  await expect(mainContent).not.toContainText('Loading repositories...', { timeout: 15000 });
  
  console.log('Data loaded successfully. Taking screenshot...');
  
  // Take a full page screenshot for verification
  await page.screenshot({ path: '../page-verification.png', fullPage: true });
});
