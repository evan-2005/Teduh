import type { BasemapStyle } from '../store/scenario';

export interface TileSource {
  label: string;
  url: string;
  attribution: string;
  subdomains?: string;
  /** Highest zoom the provider has real tiles for; higher zooms upscale this one. */
  maxNativeZoom?: number;
  /** CSS class on the tile layer, e.g. to grey it out. */
  className?: string;
}

/** Tile sources need the internet. The "Area layers" work offline. */
export const TILE_SOURCES: Readonly<Record<Exclude<BasemapStyle, 'none'>, TileSource>> = {
  streets: {
    label: 'Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  // The OpenStreetMap tiles in quiet greys, so the shade and the plan stand out. Sharp at every zoom.
  light: {
    label: 'Light',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    className: 'tiles--light',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
  },
};

export const BASEMAP_CHOICES: readonly { value: BasemapStyle; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'streets', label: 'Streets' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'none', label: 'None' },
];
