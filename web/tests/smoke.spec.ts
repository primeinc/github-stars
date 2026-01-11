import { test, expect } from '@playwright/test';

test('has title and loads repository data', async ({ page }) => {
  const url = 'https://primeinc.github.io/github-stars/';
  console.log(`Navigating to: ${url}`);
  
  // Use a longer timeout for initial navigation
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('Current URL:', page.url());
  console.log('Current Title:', await page.title());

  // Wait for the correct title
  await expect(page).toHaveTitle(/web/, { timeout: 30000 });

  console.log('Title verified. Checking for application shell...');

  // Wait for the application shell to load (sidebar should contain categories)
  await expect(page.getByText('Categories', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Star Vault', { exact: true })).toBeVisible({ timeout: 15000 });

  console.log('App shell loaded. Verifying repository list...');

  // Wait for at least one repository card to appear
  const cards = page.locator('main h3, main .repository-card');
  await expect(cards.first()).toBeVisible({ timeout: 20000 });
  
  const count = await cards.count();
  console.log(`Found ${count} repository elements.`);
  expect(count).toBeGreaterThan(0);

  // Check that "Loading repositories..." is gone
  await expect(page.locator('body')).not.toContainText('Loading repositories...', { timeout: 10000 });
  
  console.log('Verification successful. Taking screenshot...');
  await page.screenshot({ path: '../page-verification.png', fullPage: true });
});
