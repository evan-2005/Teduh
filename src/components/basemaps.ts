import type { BasemapStyle } from '../store/scenario';

export interface TileSource {
  label: string;
  url: string;
  attribution: string;
  subdomains?: string;
  /** Highest zoom the provider has real tiles for; higher zooms upscale this one. */
  maxNativeZoom?: number;
}

/** Tile sources need the internet. The "Area layers" work offline. */
export const TILE_SOURCES: Readonly<Record<Exclude<BasemapStyle, 'none'>, TileSource>> = {
  streets: {
    label: 'Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  light: {
    label: 'Light',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ',
    maxNativeZoom: 15,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
  },
};

export const BASEMAP_CHOICES: readonly { value: BasemapStyle; label: string }[] = [
  { value: 'streets', label: 'Streets' },
  { value: 'light', label: 'Light' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'none', label: 'None' },
];
