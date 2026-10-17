import { ENABLE_AI } from '../../config';
import { useScenarioStore, type AppView } from '../../store/scenario';

interface Page {
  view: AppView;
  label: string;
}

const PAGES: readonly Page[] = [
  { view: 'overview', label: 'Map & routes' },
  { view: 'plan', label: 'Plan builder' },
  { view: 'spec', label: 'Spec pack' },
  ...(ENABLE_AI ? [{ view: 'ai' as const, label: 'AI scan' }] : []),
];

/** The app's pages. The map stays in place; the side panel changes. */
export function AppNav() {
  const view = useScenarioStore((s) => s.view);
  const setView = useScenarioStore((s) => s.setView);
  return (
    <nav className="app-nav" aria-label="Pages">
      {PAGES.map((page, index) => (
        <button
          key={page.view}
          type="button"
          className="app-nav__item"
          aria-current={view === page.view ? 'page' : undefined}
          onClick={() => setView(page.view)}
        >
          <span className="app-nav__step num">{index + 1}</span>
          {page.label}
        </button>
      ))}
    </nav>
  );
}
