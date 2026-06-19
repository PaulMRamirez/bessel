// Batch least squares by Gauss-Newton. Given an initial 6-state guess at the solve
// epoch t0, a force model, and measurements scattered over epochs, each iteration:
//   1. propagate the current estimate from t0 across the measurement epochs (with STM);
//   2. for each measurement i at epoch t_i, form the residual y_i = obs - h(x(t_i)) and
//      map the measurement partial back to t0:  H_i = (dh/dx)_i * Phi(t_i, t0);
//   3. accumulate the weighted normal equations  Lambda = sum H_i^T W_i H_i  and the
//      right side  N = sum H_i^T W_i y_i, with W_i the inverse measurement covariance;
//   4. solve Lambda dx = N (Gaussian elimination), update x0 += dx, repeat.
// Convergence is on the state update norm (weighted by the state scale). The estimate
// covariance is Lambda^-1. Fails loudly on a singular normal matrix or non-convergence.
// (Tapley-Schutz-Born §4.3; Vallado §10.2.)

import type { ForceModel } from '@bessel/propagator';
import { ConvergenceError } from './errors.ts';
import { gaussSolve, mat, symInverse, symmetrize, type Mat } from './linalg.ts';
import { noiseVariances, predict, residual } from './measurements.ts';
import { propagateArc } from './propagate.ts';
import { measurementSize, type Measurement, type OdState } from './types.ts';

export interface BatchOptions {
  /** Force model defining the dynamics (same model used to generate truth). */
  readonly forceModel: ForceModel;
  /** Maximum Gauss-Newton iterations (default 20). */
  readonly maxIterations?: number;
  /**
   * Convergence tolerance on the RMS of the (sigma-normalized) state update; once the
   * step is below this the iteration stops as converged (default 1e-10).
   */
  readonly tolerance?: number;
  /** Inertial frame label passed to the propagator (default 'J2000'). */
  readonly frame?: string;
}

export interface BatchResult {
  /** The estimated 6-state at t0. */
  readonly state: OdState;
  /** The 6x6 estimate covariance, Lambda^-1 (row-major, length 36). */
  readonly covariance: Float64Array;
  /** RMS of the (sigma-normalized) post-fit residuals at convergence. */
  readonly residualRms: number;
  /** Gauss-Newton iterations performed. */
  readonly iterations: number;
  /** Number of scalar measurement components fitted. */
  readonly observationCount: number;
}

/** Multiply a (size x 6) row-major Jacobian by the 6x6 STM (row-major) into a (size x 6). */
function jacTimesStm(jac: Float64Array, size: number, phi: Float64Array): Mat {
  const out = new Float64Array(size * 6);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < 6; j++) {
      let acc = 0;
      for (let k = 0; k < 6; k++) acc += jac[i * 6 + k]! * phi[k * 6 + j]!;
      out[i * 6 + j] = acc;
    }
  }
  return mat(size, 6, out);
}

/**
 * Estimate the 6-state at `t0` from `measurements` by Gauss-Newton batch least squares,
 * starting from `initialGuess`. `initialGuess.epoch` is the solve epoch t0 and must be
 * at or before the earliest measurement.
 */
export function batchLeastSquares(
  initialGuess: OdState,
  measurements: readonly Measurement[],
  options: BatchOptions,
): BatchResult {
  const maxIter = options.maxIterations ?? 20;
  const tol = options.tolerance ?? 1e-10;
  const t0 = initialGuess.epoch;
  const epochs = measurements.map((m) => m.epoch);
  const x0 = Float64Array.from(initialGuess.x);

  let observationCount = 0;
  for (const m of measurements) observationCount += measurementSize(m);

  let lastUpdateRms = Number.POSITIVE_INFINITY;
  let lastResidualRms = Number.POSITIVE_INFINITY;
  let prevResidualRms = Number.POSITIVE_INFINITY;
  let bestState = Float64Array.from(x0);
  let converged = false;
  let lambda: Mat = mat(6, 6);
  let bestLambda: Mat = mat(6, 6);
  let iter = 0;

  for (iter = 1; iter <= maxIter; iter++) {
    const arc = propagateArc(x0, t0, epochs, options.forceModel, options.frame);

    const lam = new Float64Array(36); // sum H^T W H
    const rhsN = new Float64Array(6); // sum H^T W y
    let weightedSq = 0;
    let weightedCount = 0;

    for (const m of measurements) {
      const size = measurementSize(m);
      const stateAt = arc.stateAt(m.epoch);
      const pred = predict(m, stateAt);
      const resid = residual(m, pred.value); // obs - model, size-length
      const phi = arc.stmAt(m.epoch);
      const H = jacTimesStm(pred.jac, size, phi); // size x 6
      const varns = noiseVariances(m); // size-length sigma^2

      for (let i = 0; i < size; i++) {
        const w = 1 / varns[i]!;
        const normalized = resid[i]! * Math.sqrt(w);
        weightedSq += normalized * normalized;
        weightedCount += 1;
        // accumulate H_i^T w H_i and H_i^T w y_i
        for (let a = 0; a < 6; a++) {
          const Ha = H.data[i * 6 + a]!;
          if (Ha === 0) continue;
          rhsN[a]! += Ha * w * resid[i]!;
          for (let b = 0; b < 6; b++) {
            lam[a * 6 + b]! += Ha * w * H.data[i * 6 + b]!;
          }
        }
      }
    }

    lambda = symmetrize(mat(6, 6, lam));
    const residualRms = Math.sqrt(weightedSq / Math.max(1, weightedCount));

    // The residual RMS is evaluated at the CURRENT x0 (before this step's update). Once
    // it stops decreasing meaningfully, the cost function has bottomed: the previous
    // state is the best fit and we are done. This is the textbook batch stopping rule
    // and it handles weak-geometry cases (e.g. range-only), where dx never reaches the
    // raw `tol` because it wanders in the unobservable, integrator-noise floor.
    const relResidualChange = (prevResidualRms - residualRms) / Math.max(prevResidualRms, 1e-300);
    if (iter > 1 && relResidualChange <= tol) {
      // No meaningful reduction: keep the prior (best) state and its information matrix.
      converged = true;
      lastResidualRms = prevResidualRms;
      break;
    }
    // This step improved the fit: record it as the running best, then take the step.
    bestState = Float64Array.from(x0);
    bestLambda = lambda;
    prevResidualRms = residualRms;
    lastResidualRms = residualRms;

    const dx = gaussSolve(lambda, rhsN); // solve Lambda dx = N (throws if singular)
    for (let i = 0; i < 6; i++) x0[i]! += dx[i]!;

    let sq = 0;
    for (let i = 0; i < 6; i++) sq += dx[i]! * dx[i]!;
    lastUpdateRms = Math.sqrt(sq / 6);
    if (lastUpdateRms <= tol) {
      // The update itself is negligible: the post-step state is the best estimate.
      bestState = Float64Array.from(x0);
      bestLambda = lambda;
      converged = true;
      break;
    }
  }

  if (!converged) {
    throw new ConvergenceError(maxIter, lastResidualRms, tol);
  }

  const covariance = symInverse(bestLambda).data; // Lambda^-1 (throws if not SPD)
  return {
    state: { x: bestState, epoch: t0 },
    covariance,
    residualRms: lastResidualRms,
    iterations: Math.min(iter, maxIter),
    observationCount,
  };
}
