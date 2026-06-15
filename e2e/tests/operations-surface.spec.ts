import { test, expect } from '@playwright/test';

// The Operations panel surfaces three core capabilities in the shell: the plugin
// registry (a missions list), the telemetry adapter (a predicted-versus-actual
// residual), and the scripting API (a guided tour).

test('operations panel: registry mission load, telemetry residual, and guided tour', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  // Plugin registry: loading the Cassini mission from the registry rebuilds the
  // scene (the spacecraft appears).
  await expect(page.getByTestId('telemetry-residual')).toHaveText('Telemetry: none');
  await page.getByTestId('mission-cassini-saturn').click();
  await expect(page.getByTestId('select-Cassini')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 30_000 });

  // Telemetry adapter: a predicted-versus-actual residual is published.
  await expect(page.getByTestId('telemetry-residual')).toContainText('km', { timeout: 10_000 });

  // Scripting API: the guided tour starts playback (Play becomes Pause).
  await page.getByTestId('run-tour').click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 5_000 });
});
