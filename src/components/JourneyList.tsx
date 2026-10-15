import { dataset } from '../data/dataset';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';
import { SourceBadge } from './SourceBadge';

const destinations = dataset.neighbourhood.destinations;
const nameOf = (id: string): string => destinations.find((d) => d.id === id)?.name ?? id;
const journeyById = new Map(dataset.journeys.map((j) => [j.id, j]));

export function JourneyList({ plan }: { plan: PlanResult }) {
  const selectedJourneyId = useScenarioStore((s) => s.selectedJourneyId);
  const selectJourney = useScenarioStore((s) => s.selectJourney);

  return (
    <section aria-label="Journeys">
      <h3 className="card__title">Journeys</h3>
      <ul className="journeys">
        {plan.journeys.map(({ journeyId, before, after }) => {
          const journey = journeyById.get(journeyId)!;
          const improved = plan.journeysImproved.includes(journeyId);
          return (
            <li key={journeyId}>
              <button
                type="button"
                className="journey"
                aria-pressed={journeyId === selectedJourneyId}
                onClick={() => selectJourney(journeyId)}
              >
                <span className="journey__title">
                  {nameOf(journey.originId)} → {nameOf(journey.destinationId)}
                  {improved && <span className="journey__tick"> improved</span>}
                </span>
                <span className="journey__meta num">
                  sun {before.sunMin.toFixed(1)} → {after.sunMin.toFixed(1)} min · exposed{' '}
                  {Math.round(before.longestExposedM)} → {Math.round(after.longestExposedM)} m
                </span>
                <span className="journey__meta">
                  {journey.dailyTrips} trips/day <SourceBadge source={journey.tripsSource} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
