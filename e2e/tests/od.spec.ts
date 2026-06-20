import { test, expect } from '@playwright/test';

// The orbit-determination workbench is mission-independent: from a cold boot it drives
// @bessel/od batch least squares on a synthetic range / range-rate / angles measurement
// set generated from a known truth orbit, and reports the recovered state, the post-fit
// residual RMS, and a covariance summary. (Tapley-Schutz-Born §4.3; Vallado §10.2.)

test('orbit determination recovers a state with a residual RMS and covariance', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  await page.getByTestId('od-menu').click();
  await page.getByTestId('run-od').click();

  await expect(page.getByTestId('od-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('od-rms')).toContainText('RMS');
  await expect(page.getByTestId('od-rms')).toContainText('observations');
  await expect(page.getByTestId('od-estimate')).toContainText('Estimated state');
  await expect(page.getByTestId('od-covariance')).toContainText('km');
});
