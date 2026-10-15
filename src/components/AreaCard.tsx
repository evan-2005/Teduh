import { meta } from '../data/dataset';
import type { DataSource } from '../types';
import { SourceBadge } from './SourceBadge';

const SOURCE_BADGE: Readonly<Record<typeof meta.source, DataSource>> = {
  synthetic: 'estimated',
  openstreetmap: 'estimated',
  surveyed: 'surveyed',
};

const SOURCE_TEXT: Readonly<Record<typeof meta.source, string>> = {
  synthetic: 'Invented demo layout',
  openstreetmap: 'Real streets and buildings from OpenStreetMap',
  surveyed: 'Field survey',
};

/** Which place this is, where the data comes from, and every modelling assumption. */
export function AreaCard() {
  return (
    <section className="area" aria-label="About this area">
      <h3 className="area__name">{meta.name}</h3>
      <p className="area__source">
        {SOURCE_TEXT[meta.source]} <SourceBadge source={SOURCE_BADGE[meta.source]} />
      </p>
      {meta.assumptions && meta.assumptions.length > 0 && (
        <details className="area__details">
          <summary>How this was built</summary>
          <ul>
            {meta.assumptions.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
