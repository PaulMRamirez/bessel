import { fileURLToPath } from 'node:url';
import { kernelSourceContract } from '@bessel/pal/testing';
import { NodeKernelSource } from './node.ts';

const fixturesDir = fileURLToPath(new URL('../../../kernels/fixtures/', import.meta.url));

kernelSourceContract('pal-electron NodeKernelSource', () => ({
  source: new NodeKernelSource(fixturesDir),
  presentName: 'naif0012.tls',
  missingName: 'does-not-exist.bsp',
}));
