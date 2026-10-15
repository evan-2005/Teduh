import { useCallback, useEffect, useState } from 'react';
import { MAX_CANOPY_YEAR } from '../config';
import { useScenarioStore } from '../store/scenario';

const STEP_YEARS = 0.25;
const TICK_MS = 120;

/** Animates the canopy year from 0 to maturity. Switches the map to "future" canopy. */
export function useGrowthPlayback(): { playing: boolean; toggle: () => void } {
  const setScenario = useScenarioStore((s) => s.setScenario);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = useScenarioStore.getState().scenario.canopyYear + STEP_YEARS;
      if (next >= MAX_CANOPY_YEAR) {
        setScenario({ canopyYear: MAX_CANOPY_YEAR });
        setPlaying(false);
      } else {
        setScenario({ canopyYear: next });
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, setScenario]);

  const toggle = useCallback(() => {
    if (!playing) {
      const { canopyYear } = useScenarioStore.getState().scenario;
      setScenario({ canopy: 'future', canopyYear: canopyYear >= MAX_CANOPY_YEAR ? 0 : canopyYear });
    }
    setPlaying((p) => !p);
  }, [playing, setScenario]);

  return { playing, toggle };
}
