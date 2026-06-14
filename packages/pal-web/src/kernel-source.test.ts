import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { type AddressInfo } from 'node:net';
import { beforeAll, afterAll } from 'vitest';
import { kernelSourceContract } from '@bessel/pal/testing';
import { HttpKernelSource } from './index.ts';

const fixturesDir = fileURLToPath(new URL('../../../kernels/fixtures/', import.meta.url));

let server: Server;
let baseUrl = '';

// A minimal static server with HTTP range support, so the contract exercises the
// real fetch path (including readRange) rather than a stub.
beforeAll(async () => {
  server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').slice(1));
    let data: Buffer;
    try {
      data = readFileSync(join(fixturesDir, name));
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
    const range = req.headers.range;
    const match = range ? /bytes=(\d+)-(\d+)/.exec(range) : null;
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${data.length}` });
      res.end(data.subarray(start, end + 1));
    } else {
      res.writeHead(200);
      res.end(data);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}/`;
});

afterAll(() => {
  server.close();
});

kernelSourceContract('pal-web HttpKernelSource', () => ({
  source: new HttpKernelSource({ 'naif0012.tls': `${baseUrl}naif0012.tls` }),
  presentName: 'naif0012.tls',
  missingName: 'does-not-exist.bsp',
}));
