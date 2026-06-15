import { expect, type Page } from '@playwright/test';

// The app now boots into a neutral inner-solar-system scene; the Cassini demo is
// a loadable sample. This helper loads it through the one-click sample button and
// waits for the generic builder to rebuild the rich Cassini-at-Saturn scene
// (spacecraft, FOV instrument, rings, atmosphere), focusing Saturn.
export async function loadCassiniSample(page: Page): Promise<void> {
  await page.getByTestId('load-sample-cassini-saturn.json').click();
  await expect(page.getByTestId('select-Cassini')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 30_000 });
  // Let the rebuilt scene settle (positions, instrument FOV) before assertions.
  await page.waitForTimeout(300);
}
