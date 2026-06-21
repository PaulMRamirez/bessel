import { test, expect } from '@playwright/test';

// The first-run welcome card is the front door on a cold open: it offers the bundled
// mission, a tour, or just exploring, and once dismissed it stays dismissed (persisted
// through PAL Storage), so it does not nag on the next visit.

test('the welcome card shows on first run, dismisses, and stays dismissed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });
  await expect(page.getByTestId('welcome-card')).toBeVisible();

  await page.getByTestId('welcome-explore').click();
  await expect(page.getByTestId('welcome-card')).toHaveCount(0);

  // Reloading in the same context (storage persisted) does not show the card again.
  await page.reload();
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });
  await expect(page.getByTestId('welcome-card')).toHaveCount(0);
});

test('loading the sample mission from the welcome card loads it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });
  await expect(page.getByTestId('welcome-card')).toBeVisible();
  await expect(page.getByTestId('select-Cassini')).toHaveCount(0);

  await page.getByTestId('welcome-load-sample').click();
  await expect(page.getByTestId('welcome-card')).toHaveCount(0);
  await expect(page.getByTestId('select-Cassini')).toBeVisible({ timeout: 30_000 });
});
