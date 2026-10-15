import indexRaw from '../../data/areas/index.json';

export interface AreaIndexEntry {
  slug: string;
  name: string;
  group: string;
  center: [number, number];
}

/** Areas that ship with the app (built by `npm run data:areas`). */
export const AREA_INDEX: readonly AreaIndexEntry[] = indexRaw as AreaIndexEntry[];

export const DEFAULT_AREA_ID = 'ss4-petaling-jaya';
