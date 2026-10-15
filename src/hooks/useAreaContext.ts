import { useEffect, useState } from 'react';
import { loadContext } from '../data/context';
import { AREA_ID } from '../data/dataset';
import type { AreaContext } from '../types';

/** The area's buildings, parks, trees and landmarks, loaded once. Null while loading or if none. */
export function useAreaContext(): AreaContext | null {
  const [context, setContext] = useState<AreaContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadContext(AREA_ID)
      .then((loaded) => !cancelled && setContext(loaded))
      .catch(() => !cancelled && setContext(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return context;
}
