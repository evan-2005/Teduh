import type { ShadeOverride, ShadeScanResult, TimeSlot } from '../../types';

/** A finished scan: the estimate plus the time slot the photo was taken for. */
export interface ScannedPhoto {
  result: ShadeScanResult;
  time: TimeSlot;
}

/**
 * The map edit to apply when a person confirms a scan. It always targets the segment and time
 * that were scanned, never whatever the form shows now.
 */
export function overrideFromScan(scan: ScannedPhoto, shade: number): ShadeOverride {
  return { segmentId: scan.result.segmentId, time: scan.time, shade, source: 'ai-confirmed' };
}
