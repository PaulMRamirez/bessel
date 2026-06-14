// Phase 0 shell: the Cassini-at-Saturn viewer plus a header landmark. The viewer
// owns the SPICE worker, the scene, and the timeline and camera controls.
import { BesselViewer } from './viewer.tsx';

export function App(): JSX.Element {
  return (
    <main className="bessel-shell">
      <header className="bessel-header">
        <h1>Bessel</h1>
        <span className="bessel-subtitle">Cassini at Saturn</span>
      </header>
      <BesselViewer />
    </main>
  );
}
