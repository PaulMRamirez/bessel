import { test, expect } from '@playwright/test';

test('app shell renders the Bessel landmark and PWA manifest', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bessel' })).toBeVisible();
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
});
