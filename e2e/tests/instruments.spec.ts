import { test, expect, type Locator, type Page } from '@playwright/test';
import { loadCassiniSample } from './sample.ts';

// Phase 1 acceptance (SPEC Section 9): FOV cone rendering and footprint rendering
// on the Cassini sample mission. The FOV cone (cyan) comes from getfov; the
// footprint (yellow) comes from sincpt onto Saturn.

interface ColorStats {
  cyan: number;
  magenta: number;
  total: number;
}

async function colorStats(viewport: Locator): Promise<ColorStats> {
  return viewport.evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let cyan = 0;
    let magenta = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r > 24 || g > 24 || b > 24) total += 1;
      // FOV cone: blue dominant and bright.
      if (b > 70 && b >= g && b > r + 15) cyan += 1;
      // Footprint highlight: red and blue high, green low (magenta), distinct from
      // Saturn's tan surface (blue below green) and the cyan cone (low red).
      if (r > 140 && b > 110 && b > g + 20) magenta += 1;
    }
    return { cyan, magenta, total };
  });
}

// Scrub the timeline to roughly Saturn orbit insertion, where the geometry is
// compact and both the FOV cone and footprint sit clearly on Saturn.
async function scrubToSoi(page: Page): Promise<void> {
  await page.getByTestId('scrub').evaluate((el) => {
    const input = el as HTMLInputElement;
    const min = Number(input.min);
    const max = Number(input.max);
    const soi = min + (max - min) * 0.15;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(soi));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test.describe('Cassini instruments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });
    await loadCassiniSample(page);
    await scrubToSoi(page);
    await page.waitForTimeout(300);
  });

  test('FOV cone renders when instruments are enabled', async ({ page }) => {
    const viewport = page.getByTestId('viewport');
    const before = await colorStats(viewport);
    await page.getByTestId('toggle-instruments').click();
    await page.waitForTimeout(800);
    const after = await colorStats(viewport);
    // The cyan FOV cone adds a visible translucent region over the blue baseline
    // (trajectory and axis triad). The cone contributes a few hundred cyan pixels.
    expect(after.cyan).toBeGreaterThan(before.cyan + 120);
  });

  test('footprint renders on Saturn from a surface intercept', async ({ page }) => {
    const viewport = page.getByTestId('viewport');
    await page.getByTestId('toggle-instruments').click();
    // The footprint is computed asynchronously via sincpt; wait for points.
    await expect
      .poll(async () => Number(await viewport.getAttribute('data-footprint-points')), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(300);
    const stats = await colorStats(viewport);
    expect(stats.magenta).toBeGreaterThan(50);
  });
});
