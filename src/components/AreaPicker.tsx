import { AREA_INDEX } from '../data/areas';
import { listCustomAreas } from '../data/customAreas';
import { AREA_ID } from '../data/dataset';
import { CUSTOM_PREFIX } from '../data/load';

const SEED_ID = 'seed';

/** Switching area reloads the page with `?area=<id>`, so every panel starts clean. */
export function goToArea(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('area', id);
  window.location.assign(url);
}

const groups = [...new Set(AREA_INDEX.map((a) => a.group))];
const saved = listCustomAreas();

export function AreaPicker() {
  return (
    <label className="area-picker">
      <span className="area-picker__label">Area</span>
      <select value={AREA_ID} onChange={(e) => goToArea(e.target.value)} aria-label="Choose an area">
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {AREA_INDEX.filter((a) => a.group === group).map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </optgroup>
        ))}
        {saved.length > 0 && (
          <optgroup label="Places you looked up">
            {saved.map((a) => (
              <option key={a.slug} value={`${CUSTOM_PREFIX}${a.slug}`}>
                {a.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Offline demo">
          <option value={SEED_ID}>Invented neighbourhood</option>
        </optgroup>
      </select>
    </label>
  );
}
