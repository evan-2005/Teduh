import { useState, type FormEvent } from 'react';
import { analysePlace, AnalyseError } from '../data/analysePlace';
import { searchPlaces, SearchError, type Place } from '../data/geocode';
import { goToArea } from './AreaPicker';

type Status =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'analysing'; message: string }
  | { kind: 'error'; message: string };

const messageOf = (error: unknown): string =>
  error instanceof SearchError || error instanceof AnalyseError
    ? error.message
    : 'Something went wrong. Try again.';

/** Look up any place by name; the app downloads its map data and analyses it in the browser. */
export function PlaceSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'searching' || status.kind === 'analysing';

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'searching' });
    try {
      setPlaces(await searchPlaces(query));
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({ kind: 'error', message: messageOf(error) });
    }
  };

  const analyse = async (place: Place) => {
    try {
      const id = await analysePlace(place, (message) => setStatus({ kind: 'analysing', message }));
      goToArea(id);
    } catch (error) {
      setStatus({ kind: 'error', message: messageOf(error) });
    }
  };

  return (
    <div className="place-search">
      <button
        type="button"
        className="place-search__toggle"
        aria-expanded={open}
        aria-controls="place-search-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Look up a place
      </button>
      {open && (
        <div id="place-search-panel" className="place-search__panel">
          <form onSubmit={search} role="search">
            <label className="field__label" htmlFor="place-query">
              Town, neighbourhood or landmark
            </label>
            <div className="place-search__row">
              <input
                id="place-query"
                type="search"
                value={query}
                placeholder="e.g. Taman Desa, Kuala Lumpur"
                onChange={(e) => setQuery(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className="button" disabled={busy || query.trim().length < 2}>
                Search
              </button>
            </div>
          </form>

          {status.kind === 'searching' && <p className="card__hint">Searching…</p>}
          {status.kind === 'analysing' && (
            <p className="place-search__progress" role="status">
              {status.message}
            </p>
          )}
          {status.kind === 'error' && (
            <p className="scan__error" role="alert">
              {status.message}
            </p>
          )}

          {places && places.length === 0 && status.kind === 'idle' && (
            <p className="card__hint">No places found. Try a nearby town or neighbourhood name.</p>
          )}
          {places && places.length > 0 && (
            <ul className="place-search__results">
              {places.map((place) => (
                <li key={place.id}>
                  <button type="button" disabled={busy} onClick={() => analyse(place)}>
                    <strong>{place.name}</strong>
                    <span>{place.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="card__hint">
            Choosing a place downloads about 1 MB of map data and takes up to a minute. It needs the
            internet, and works best for built-up residential areas.
          </p>
        </div>
      )}
    </div>
  );
}
