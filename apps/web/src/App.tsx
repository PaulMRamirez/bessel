// Scaffold shell. Phase 0 mounts the 3D viewport, the timeline, and the camera
// controls; this proves the build pipeline end to end, including the SPICE worker
// (CSPICE-WASM) reporting its toolkit version, and gives the e2e harness a known
// landmark to assert against.
import { useEffect, useState } from 'react';
import { connectSpice } from './spice.ts';

export function App(): JSX.Element {
  const [spiceVersion, setSpiceVersion] = useState<string>('connecting');

  useEffect(() => {
    const spice = connectSpice();
    let active = true;
    spice
      .tkvrsn()
      .then((v) => {
        if (active) setSpiceVersion(v);
      })
      .catch((err: unknown) => {
        if (active) setSpiceVersion(`error: ${err instanceof Error ? err.message : String(err)}`);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="bessel-shell">
      <h1>Bessel</h1>
      <p>SPICE-aware 3D mission visualization.</p>
      <p>
        SPICE engine: <span data-testid="spice-version">{spiceVersion}</span>
      </p>
      <canvas id="viewport" aria-label="3D viewport" width={640} height={480} />
    </main>
  );
}
