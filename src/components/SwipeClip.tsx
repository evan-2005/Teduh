import type { Map as LeafletMap } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export const BEFORE_PANE = 'beforePane';
export const AFTER_PANE = 'afterPane';
export const DESTINATION_PANE = 'destinationPane';

const MAP_EVENTS = 'move zoom viewreset resize';

/**
 * Clip the pane to everything right of the divider. Panes live in layer-point space, which
 * shifts as the map pans, so the divider (a container x fraction) is converted on every move.
 */
function clipRightOf(map: LeafletMap, pane: HTMLElement, fraction: number): void {
  const size = map.getSize();
  const topLeft = map.containerPointToLayerPoint([0, 0]);
  const bottomRight = map.containerPointToLayerPoint(size);
  const x = map.containerPointToLayerPoint([fraction * size.x, 0]).x;
  pane.style.clipPath =
    `polygon(${x}px ${topLeft.y}px, ${bottomRight.x}px ${topLeft.y}px, ` +
    `${bottomRight.x}px ${bottomRight.y}px, ${x}px ${bottomRight.y}px)`;
}

interface SwipeClipProps {
  /** Clip only in swipe mode; otherwise the after pane is shown whole. */
  active: boolean;
  /** Divider position as a fraction (0..1) of the map width. */
  fraction: number;
}

export function SwipeClip({ active, fraction }: SwipeClipProps) {
  const map = useMap();

  useEffect(() => {
    const pane = map.getPane(AFTER_PANE);
    if (!pane || !active) return;
    const update = () => clipRightOf(map, pane, fraction);
    update();
    map.on(MAP_EVENTS, update);
    return () => {
      map.off(MAP_EVENTS, update);
      pane.style.clipPath = '';
    };
  }, [map, active, fraction]);

  return null;
}
