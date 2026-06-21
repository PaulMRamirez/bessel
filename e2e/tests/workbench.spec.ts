import { test, expect } from '@playwright/test';
import { loadCassiniSample, openAnalyze } from './sample.ts';

// The consolidated Analyze dock is pinnable: unlike the former popovers it stays
// mounted and keeps its results across tab switches, canvas clicks, and timeline
// scrubbing, and it does not auto-dismiss on Escape. This is the locked UX guarantee
// the auto-dismissing popovers could not give.

test('the Analyze dock keeps results across tab switches, canvas clicks, and scrubbing', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });
  await loadCassiniSample(page);

  // Compute an eclipse on the Access & Coverage tab.
  await openAnalyze(page, 'access');
  await page.getByTestId('compute-eclipse').click();
  await expect(page.getByTestId('eclipse-result')).toBeVisible({ timeout: 20_000 });

  // Switch to another tab and back; the eclipse result is still there (read from the
  // store, not recomputed).
  await page.getByTestId('tab-od').click();
  await expect(page.getByTestId('eclipse-result')).toHaveCount(0);
  await page.getByTestId('tab-access').click();
  await expect(page.getByTestId('eclipse-result')).toBeVisible();

  // Clicking the canvas and scrubbing the timeline do not dismiss the dock or its result.
  await page.getByTestId('viewport').click({ position: { x: 80, y: 80 } });
  await expect(page.getByTestId('analyze-workbench')).toBeVisible();
  await expect(page.getByTestId('eclipse-result')).toBeVisible();
  const scrub = page.getByTestId('scrub');
  await scrub.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('analyze-workbench')).toBeVisible();

  // Escape does not close the dock (no auto-dismiss); only the explicit close does.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('analyze-workbench')).toBeVisible();
  await page.getByTestId('analyze-close').click();
  await expect(page.getByTestId('analyze-workbench')).toHaveCount(0);
});
