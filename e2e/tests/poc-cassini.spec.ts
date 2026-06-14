import { test, expect, type Locator } from '@playwright/test';

// Phase 0 acceptance (SPEC Section 9): load the fixture catalog, assert the
// trajectory renders (a non-empty WebGL frame), and assert that advancing the
// timeline changes the rendered frame. "Renders" is measured by reading the
// canvas, never by visual judgement.

/** Count non-background pixels and a coarse signature of the WebGL frame. */
async function frameStats(viewport: Locator): Promise<{ nonBackground: number; signature: number }> {
  return viewport.evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let nonBackground = 0;
    let signature = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      // Background is #05070b; anything brighter is rendered content.
      if (r > 24 || g > 24 || b > 24) {
        nonBackground += 1;
        signature = (signature + (i + 1) * (r + g * 3 + b * 7)) % 2147483647;
      }
    }
    return { nonBackground, signature };
  });
}

test('poc-cassini renders the trajectory and the timeline changes the frame', async ({ page }) => {
  await page.goto('/');

  // The SPICE worker loads CSPICE-WASM and samples the ephemerides before the
  // scene is ready; allow generous time for the first load.
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-ready', 'true');

  // The trajectory and Saturn render: the frame is not empty.
  const before = await frameStats(viewport);
  expect(before.nonBackground).toBeGreaterThan(200);

  // Advance the timeline by playing, then confirm the frame changed.
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('epoch')).not.toHaveText('', { timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Pause' }).click();

  const after = await frameStats(viewport);
  expect(after.signature).not.toBe(before.signature);
});
