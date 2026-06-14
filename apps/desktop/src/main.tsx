import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App(): JSX.Element {
  return (
    <main style={{ padding: '1rem' }}>
      <h1>Bessel Desktop</h1>
      <p>Electron shell. Phase 1 mounts the shared UI and the pal-electron bridge.</p>
    </main>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Bessel: #root element not found');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
