import { useEffect, useRef } from 'react';
import { AreaPicker } from './components/AreaPicker';
import { MapView } from './components/MapView';
import { PlaceSearch } from './components/PlaceSearch';
import { AiView } from './components/views/AiView';
import { AppNav } from './components/views/AppNav';
import { OverviewView } from './components/views/OverviewView';
import { PlanBuilderView } from './components/views/PlanBuilderView';
import { SpecView } from './components/views/SpecView';
import { ENABLE_AI, FOOTER_DISCLAIMER } from './config';
import { meta } from './data/dataset';
import { useInitialPlan } from './hooks/useInitialPlan';
import { useNetworkView } from './hooks/useNetworkView';
import { useOptimizer } from './hooks/useOptimizer';
import { useScenarioStore, type AppView } from './store/scenario';

const PAGE_TITLES: Readonly<Record<AppView, string>> = {
  overview: 'Map and routes',
  plan: 'Plan builder',
  spec: 'Spec pack',
  ai: 'AI scan and explainer',
};

export function App() {
  const { before, after, journey } = useNetworkView();
  const mapMode = useScenarioStore((s) => s.scenario.mapMode);
  const storedView = useScenarioStore((s) => s.view);
  const view = storedView === 'ai' && !ENABLE_AI ? 'overview' : storedView;
  const comparison = mapMode === 'before' ? before.comparison : after.comparison;
  const { plans, selectedPlan } = useOptimizer();
  useInitialPlan(plans);
  const panelRef = useRef<HTMLElement>(null);
  // A new page starts at its top, not where the previous page was scrolled to.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [view]);

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="brand">Teduh</h1>
        <p className="tagline">Small changes. Cooler journeys.</p>
        <AppNav />
        <div className="shell__header-tools">
          <AreaPicker />
          <PlaceSearch />
        </div>
      </header>

      <aside ref={panelRef} className="shell__panel" aria-label={PAGE_TITLES[view]}>
        {view === 'overview' && <OverviewView plan={selectedPlan} journey={journey} comparison={comparison} />}
        {view === 'plan' && <PlanBuilderView plans={plans} selectedPlan={selectedPlan} />}
        {view === 'spec' && <SpecView />}
        {view === 'ai' && <AiView plan={selectedPlan} />}
      </aside>

      <main className="shell__map" aria-label="Map">
        <MapView before={before} after={after} />
      </main>

      <footer className="shell__footer">
        {FOOTER_DISCLAIMER}
        {meta.attribution && <span> {meta.attribution}.</span>}
      </footer>
    </div>
  );
}
