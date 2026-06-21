import { test, expect } from '@playwright/test';
import { openAnalyze } from './sample.ts';

// The mission-design workbench is mission-independent: from a cold boot it assembles a
// small Mission Control Sequence (initial LEO state, coast, impulsive prograde burn, and
// a Target whose differential corrector tunes the burn to a desired radius), runs it via
// @bessel/propagator runMission, renders the propagated arc in the scene, and reports the
// final state plus the corrector convergence. (STK_PARITY_SPEC §4.3.)

test('mission design runs an MCS and reports corrector convergence', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  await openAnalyze(page, 'maneuver');
  // Tune one parameter to prove the controls thread into the run, then run the sequence.
  await page.getByTestId('mcs-target-radius').fill('7300');
  await page.getByTestId('run-mcs').click();

  // The run surfaces a final-state readout, a converged differential-corrector report,
  // and an altitude polyline along the propagated arc.
  await expect(page.getByTestId('mcs-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('mcs-final-state')).toContainText('km');
  await expect(page.getByTestId('mcs-dc-report')).toContainText('converged');
  await expect(page.getByTestId('mcs-altitude-chart').locator('polyline')).toHaveCount(1);
});
