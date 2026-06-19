// Tiny dense linear algebra for the differential corrector. Systems are at most ~6x6, so
// plain Gaussian elimination with partial pivoting is both sufficient and exact enough; no
// external dependency. Three solve shapes: square (m == n), least-squares (m > n, normal
// equations), and minimum-norm (m < n, underdetermined). Matrices are row-major Float64.
// (STK_PARITY_SPEC §4.3.)

/** Solve A x = b for a square n x n A (partial pivoting). Returns x; throws on singularity. */
export function solveSquare(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const m = Float64Array.from(A);
  const x = Float64Array.from(b);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r * n + col]!) > Math.abs(m[piv * n + col]!)) piv = r;
    if (m[piv * n + col] === 0) throw new Error('singular matrix in solveSquare');
    if (piv !== col) {
      for (let c = 0; c < n; c++) {
        const tmp = m[piv * n + c]!;
        m[piv * n + c] = m[col * n + c]!;
        m[col * n + c] = tmp;
      }
      const tb = x[piv]!;
      x[piv] = x[col]!;
      x[col] = tb;
    }
    const d = m[col * n + col]!;
    for (let r = col + 1; r < n; r++) {
      const f = m[r * n + col]! / d;
      for (let c = col; c < n; c++) m[r * n + c]! -= f * m[col * n + c]!;
      x[r]! -= f * x[col]!;
    }
  }
  for (let row = n - 1; row >= 0; row--) {
    let s = x[row]!;
    for (let c = row + 1; c < n; c++) s -= m[row * n + c]! * x[c]!;
    x[row] = s / m[row * n + row]!;
  }
  return x;
}

/** A^T A (n x n) and A^T b (n) for an m x n A. */
function normalEquations(A: Float64Array, b: Float64Array, m: number, n: number): { ata: Float64Array; atb: Float64Array } {
  const ata = new Float64Array(n * n);
  const atb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += A[k * n + i]! * A[k * n + j]!;
      ata[i * n + j] = s;
    }
    let sb = 0;
    for (let k = 0; k < m; k++) sb += A[k * n + i]! * b[k]!;
    atb[i] = sb;
  }
  return { ata, atb };
}

/** Least-squares solve for an overdetermined system (m > n): (A^T A) x = A^T b. */
export function solveLeastSquares(A: Float64Array, b: Float64Array, m: number, n: number): Float64Array {
  const { ata, atb } = normalEquations(A, b, m, n);
  return solveSquare(ata, atb, n);
}

/** Minimum-norm solve for an underdetermined system (m < n): x = A^T (A A^T)^-1 b. */
export function solveMinNorm(A: Float64Array, b: Float64Array, m: number, n: number): Float64Array {
  const aat = new Float64Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[i * n + k]! * A[j * n + k]!;
      aat[i * m + j] = s;
    }
  }
  const y = solveSquare(aat, b, m); // (A A^T) y = b
  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += A[i * n + j]! * y[i]!;
    x[j] = s;
  }
  return x;
}

/** A pivot-ratio condition proxy for the square or normal system of an m x n A. */
export function conditionEstimate(A: Float64Array, m: number, n: number): number {
  const sq = m === n ? Float64Array.from(A) : normalEquations(A, new Float64Array(m), m, n).ata;
  const dim = n;
  const work = Float64Array.from(sq);
  let maxPiv = 0;
  let minPiv = Infinity;
  for (let col = 0; col < dim; col++) {
    let piv = col;
    for (let r = col + 1; r < dim; r++) if (Math.abs(work[r * dim + col]!) > Math.abs(work[piv * dim + col]!)) piv = r;
    const pv = Math.abs(work[piv * dim + col]!);
    if (pv === 0) return Infinity;
    maxPiv = Math.max(maxPiv, pv);
    minPiv = Math.min(minPiv, pv);
    if (piv !== col) for (let c = 0; c < dim; c++) {
      const tmp = work[piv * dim + c]!;
      work[piv * dim + c] = work[col * dim + c]!;
      work[col * dim + c] = tmp;
    }
    const d = work[col * dim + col]!;
    for (let r = col + 1; r < dim; r++) {
      const f = work[r * dim + col]! / d;
      for (let c = col; c < dim; c++) work[r * dim + c]! -= f * work[col * dim + c]!;
    }
  }
  return maxPiv / minPiv;
}
