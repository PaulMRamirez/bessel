// Typed, located errors for numerical propagation. Fail loudly (CLAUDE.md): a
// step-size collapse, too many rejections, or a non-finite acceleration throws
// rather than silently returning a corrupt arc. (STK_PARITY_SPEC §4.2.)

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationError';
  }
}
