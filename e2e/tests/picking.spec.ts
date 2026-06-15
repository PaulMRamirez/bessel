import { test, expect } from '@playwright/test';

// Phase B: clicking a body in the 3D viewport selects and centers it (raycasting).
// Saturn is the initial focus and sits at the screen center, so a click in the
// middle of the viewport picks it.

test('clicking a body in the viewport selects and centers it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-selection', '');

  // Playwright clicks the element center by default; Saturn is there.
  await viewport.click();

  await expect(viewport).toHaveAttribute('data-selection', /Saturn/, { timeout: 5_000 });
  await expect(viewport).toHaveAttribute('data-cam-target', 'Saturn');
});
