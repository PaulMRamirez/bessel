// Typed, located errors for orbit determination. Fail loudly (CLAUDE.md): a singular
// normal matrix, a non-convergent batch iteration, a non-positive-definite covariance,
// or a malformed measurement throws a typed error rather than returning a corrupt
// estimate. These extend the propagator IntegrationError so a caller catching the
// propagation/estimation family catches both. (Vallado §10; Tapley-Schutz-Born §4.)

import { IntegrationError } from '@bessel/propagator';

/** Base for every orbit-determination failure (extends IntegrationError). */
export class OdError extends IntegrationError {
  constructor(message: string) {
    super(message);
    this.name = 'OdError';
  }
}

/** A dense linear solve hit a (near) singular matrix: the information was rank deficient. */
export class SingularMatrixError extends OdError {
  constructor(message: string) {
    super(message);
    this.name = 'SingularMatrixError';
  }
}

/** The batch least-squares iteration did not converge within the iteration budget. */
export class ConvergenceError extends OdError {
  constructor(iterations: number, lastRms: number, tol: number) {
    super(
      `batch least squares did not converge in ${iterations} iterations ` +
        `(last residual RMS ${lastRms}, state-update tolerance ${tol})`,
    );
    this.name = 'ConvergenceError';
  }
}

/** A measurement, observer geometry, or filter input was malformed. */
export class MeasurementError extends OdError {
  constructor(message: string) {
    super(message);
    this.name = 'MeasurementError';
  }
}
