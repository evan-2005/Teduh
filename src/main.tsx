// Self-hosted so the demo works offline. Slab headings, humanist body, mono numbers.
import '@fontsource/zilla-slab/latin-500.css';
import '@fontsource/zilla-slab/latin-500-italic.css';
import '@fontsource/zilla-slab/latin-600.css';
import '@fontsource/zilla-slab/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/views.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

function FatalError({ message }: { message: string }) {
  return (
    <main className="fatal" role="alert">
      <h1 className="brand">Teduh</h1>
      <p>The app could not start.</p>
      <pre className="fatal__detail">{message}</pre>
      <p>
        If you edited a file in <code>data/</code>, check it against the schema in{' '}
        <code>src/data/load.ts</code>.
      </p>
    </main>
  );
}

// App imports validate data/*.json at load time, so import it lazily to catch bad data.
try {
  const { App } = await import('./App');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  root.render(<FatalError message={error instanceof Error ? error.message : String(error)} />);
}
