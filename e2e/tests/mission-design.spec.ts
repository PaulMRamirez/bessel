import { test, expect } from '@playwright/test';
import { openAnalyze, expandCard } from './sample.ts';

// The editable mission-design workbench is mission-independent: from a cold boot the user
// builds a Mission Control Sequence in the segment editor (InitialState, coast, prograde burn,
// and a Target whose differential corrector tunes the burn to a desired radius), runs it via
// @bessel/propagator, renders the solved arc in the scene, and reports the per-iteration
// residual convergence, the solved delta-v, and the final state. It lives in the Orbit &
// Maneuver tab's "Mission control sequence" TaskCard. (STK_PARITY_SPEC §4.3; analysis-UX Phase 1.)

test('mission design edits a segment, runs the MCS, and reports corrector convergence', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready', { timeout: 60_000 });

  await openAnalyze(page, 'orbit-maneuver');
  await expandCard(page, 'mcs');

  // The default editable design has four segments; the Target row is segment index 3.
  await expect(page.getByTestId('mcs-segment-editor')).toBeVisible();
  await expect(page.getByTestId('mcs-add-segment')).toBeVisible();
  for (const i of [0, 1, 2, 3]) {
    await expect(page.getByTestId(`mcs-segment-${i}`)).toBeVisible();
  }

  // Edit the Target's desired radius via the new segment control to prove edits thread in.
  await page.getByTestId('mcs-segment-3-desired').fill('7300');
  await page.getByTestId('run-mcs').click();

  // The run surfaces a final-state readout, a converged differential-corrector report with the
  // solved delta-v, the per-iteration residual trace, and an altitude polyline along the arc.
  await expect(page.getByTestId('mcs-result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('mcs-final-state')).toContainText('km');
  await expect(page.getByTestId('mcs-dc-report')).toContainText('converged');
  await expect(page.getByTestId('mcs-solved-dv')).toContainText('delta-v');
  await expect(page.getByTestId('mcs-residuals-chart').locator('polyline')).toHaveCount(1);
  await expect(page.getByTestId('mcs-altitude-chart').locator('polyline')).toHaveCount(1);
});
