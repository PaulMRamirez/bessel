import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Phase 2 acceptance (SPEC Section 9): an accessibility scan with zero serious or
// critical violations on the main view, and a second load that works offline
// against the OPFS kernel cache.

test('the main view has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    seriousOrCritical,
    JSON.stringify(
      seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

test('a second load works offline against the OPFS kernel cache', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  // Let the service worker activate (app shell plus wasm precache) and the kernels
  // settle into the OPFS cache.
  await page.evaluate(async () => {
    await navigator.serviceWorker?.ready;
  });
  await page.waitForTimeout(1500);

  await context.setOffline(true);
  await page.reload();

  // The shell and wasm come from the service worker precache; the kernels come
  // from the OPFS cache; no network is available.
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });
  const ready = await page.getByTestId('viewport').getAttribute('data-ready');
  expect(ready).toBe('true');
});
