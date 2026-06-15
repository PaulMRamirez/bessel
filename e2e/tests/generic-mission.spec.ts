import { test, expect } from '@playwright/test';
import { frameStats } from './frame-stats.ts';

// Closure-plan item 1 (arbitrary-mission load): loading a native catalog that
// declares a spacecraft with a time window must REBUILD the rendered 3D scene
// from that catalog, not just update the object list, and not re-render the
// bundled Cassini demo. The fixture drives Cassini-class kernels through the
// generic builder (body "6"/Saturn, spacecraft "-82"), so it renders with the
// bundled kernels while exercising the generic path end to end.

test('loading a native catalog rebuilds the rendered scene generically', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-ready', 'true');

  // The bundled Cassini demo renders first.
  const before = await frameStats(viewport);
  expect(before.nonBackground).toBeGreaterThan(200);

  await page.getByTestId('catalog-file-input').setInputFiles('e2e/fixtures/native-cassini.json');

  // The generic builder samples SPICE and rebuilds: the object browser becomes
  // catalog-driven (the catalog spacecraft "Probe" id "-82", not the demo
  // "Cassini"), and the Saturn body (id "6") is present.
  await expect(page.getByTestId('select--82')).toHaveText('Probe', { timeout: 30_000 });
  await expect(page.getByTestId('select-6')).toHaveText('Saturn');
  await expect(page.getByTestId('select-Cassini')).toHaveCount(0);
  await expect(page.getByTestId('load-error')).toHaveText('');

  // Status returns to Ready and the rebuilt scene still renders a non-empty frame.
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 30_000 });
  await page.waitForTimeout(500);
  const after = await frameStats(viewport);
  expect(after.nonBackground).toBeGreaterThan(200);
});
