import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { SourceBadge } from '../../components/SourceBadge';
import { TIME_SLOTS } from '../../config';
import { dataset } from '../../data/dataset';
import { nearestSlot } from '../../lib/clock';
import { createLatestTracker } from '../../lib/latest';
import { useScenarioStore } from '../../store/scenario';
import type { TimeSlot } from '../../types';
import { requestShadeScan } from './client';
import { downscalePhoto } from './downscale';
import { overrideFromScan, type ScannedPhoto } from './override';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; scan: ScannedPhoto };

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/** "Jengka Avenue (Main road) · seg-116": readable enough to find a path in a long list. */
const segmentLabel = (id: string, notes: string | undefined): string => {
  const [kind, street] = (notes ?? '').split(':').map((part) => part.trim());
  return street ? `${street} (${kind}) · ${id}` : `${kind || 'Path'} · ${id}`;
};

/** Every path, sorted by street name so the ones on one street sit together. */
const SEGMENT_OPTIONS = dataset.neighbourhood.segments
  .map((s) => ({ id: s.id, label: segmentLabel(s.id, s.notes) }))
  .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

/** Start on a path the demo talks about: the open item's first path, else the first candidate's. */
const defaultSegmentId = (interventionId: string | null): string => {
  const open = dataset.interventions.find((i) => i.id === interventionId) ?? dataset.interventions[0];
  return open?.segmentIds[0] ?? dataset.neighbourhood.segments[0]!.id;
};
const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';

/** Upload a path photo, review the AI estimate, adjust it, and confirm it onto the map. */
export function ShadeScanPanel() {
  const scenarioTime = useScenarioStore((s) => s.scenario.time);
  const overrides = useScenarioStore((s) => s.shadeOverrides);
  const applyShadeOverride = useScenarioStore((s) => s.applyShadeOverride);
  const clearShadeOverrides = useScenarioStore((s) => s.clearShadeOverrides);
  const openInterventionId = useScenarioStore((s) => s.selectedInterventionId);

  const [segmentId, setSegmentId] = useState(() => defaultSegmentId(openInterventionId));
  const [time, setTime] = useState<TimeSlot>(nearestSlot(scenarioTime));
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [adjusted, setAdjusted] = useState(0.5);
  const [confirmed, setConfirmed] = useState(false);
  const requests = useRef(createLatestTracker());

  /** Any change to the form makes the current estimate (and any reply in flight) stale. */
  const resetEstimate = () => {
    requests.current.cancel();
    setStatus({ kind: 'idle' });
    setConfirmed(false);
  };

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    resetEstimate();
  };

  const scan = async () => {
    if (!file) return;
    const isCurrent = requests.current.start();
    setStatus({ kind: 'loading' });
    setConfirmed(false);
    try {
      const image = await downscalePhoto(file);
      const result = await requestShadeScan({ image, segmentId, time });
      if (!isCurrent()) return;
      setAdjusted(result.shadeFraction);
      setStatus({ kind: 'done', scan: { result, time } });
    } catch (error) {
      if (isCurrent()) setStatus({ kind: 'error', message: toMessage(error) });
    }
  };

  const confirm = (scan: ScannedPhoto) => {
    applyShadeOverride(overrideFromScan(scan, adjusted));
    setConfirmed(true);
  };

  return (
    <section className="card" aria-label="AI shade scan">
      <h3 className="card__title">AI shade scan</h3>
      <p className="card__hint">
        Upload a survey photo. The estimate is only applied after you confirm it.
      </p>

      <label className="field field--tight">
        <span className="field__label">Path segment</span>
        <select
          value={segmentId}
          onChange={(e) => {
            setSegmentId(e.target.value);
            resetEstimate();
          }}
        >
          {SEGMENT_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field field--tight">
        <span className="field__label">Time of the photo</span>
        <select
          value={time}
          onChange={(e) => {
            setTime(e.target.value as TimeSlot);
            resetEstimate();
          }}
        >
          {TIME_SLOTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="field field--tight">
        <span className="field__label">Photo (JPEG, PNG or WebP, up to 5 MB)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
      </label>

      {previewUrl && <img className="scan__preview" src={previewUrl} alt="Survey photo preview" />}

      <button
        type="button"
        className="button"
        disabled={!file || status.kind === 'loading'}
        onClick={scan}
      >
        {status.kind === 'loading' ? 'Estimating…' : 'Estimate shade'}
      </button>

      {status.kind === 'error' && (
        <p className="scan__error" role="alert">
          {status.message}
        </p>
      )}

      {status.kind === 'done' && (
        <div className="scan__result">
          <p>
            {status.scan.result.isMock && <span className="badge badge--missing">MOCK</span>}
            AI estimate: <span className="num">{percent(status.scan.result.shadeFraction)}</span> shaded,{' '}
            {status.scan.result.confidence} confidence
          </p>
          {status.scan.result.source && (
            <p className="card__hint">Estimated by {status.scan.result.source}.</p>
          )}
          <p className="card__hint">
            Sources: {status.scan.result.shadeSources.join(', ') || 'none named'}. Obstacles:{' '}
            {status.scan.result.obstacles.join(', ') || 'none seen'}.
          </p>
          <p className="card__hint">{status.scan.result.notes}</p>
          <label className="field">
            <span className="field__label">
              Your value: <span className="num">{percent(adjusted)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={adjusted}
              onChange={(e) => setAdjusted(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="button button--primary"
            onClick={() => confirm(status.scan)}
          >
            Confirm and apply to map
          </button>
          {confirmed && (
            <p className="card__hint" role="status">
              Applied to {status.scan.result.segmentId} at {status.scan.time} as{' '}
              <SourceBadge source="ai-confirmed" />
            </p>
          )}
        </div>
      )}

      {overrides.length > 0 && (
        <p className="card__hint">
          {overrides.length} confirmed edit{overrides.length === 1 ? '' : 's'} on the map.{' '}
          <button type="button" className="link-button" onClick={clearShadeOverrides}>
            Undo all
          </button>
        </p>
      )}
    </section>
  );
}
