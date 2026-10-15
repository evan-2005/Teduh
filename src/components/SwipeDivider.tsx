import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

const KEY_STEP = 0.05;
const MIN_FRACTION = 0.03;
const MAX_FRACTION = 0.97;

const clamp = (value: number): number => Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, value));

interface SwipeDividerProps {
  fraction: number;
  onChange: (fraction: number) => void;
}

/** Draggable (and keyboard-operable) vertical divider with Before / After labels. */
export function SwipeDivider({ fraction, onChange }: SwipeDividerProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const moveTo = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) onChange(clamp((clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e.clientX);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onChange(clamp(fraction - KEY_STEP));
    else if (e.key === 'ArrowRight') onChange(clamp(fraction + KEY_STEP));
    else return;
    e.preventDefault();
  };

  return (
    <div ref={trackRef} className="swipe">
      <span className="swipe__label swipe__label--before" style={{ right: `${(1 - fraction) * 100}%` }}>
        Before
      </span>
      <span className="swipe__label swipe__label--after" style={{ left: `${fraction * 100}%` }}>
        After
      </span>
      <div
        className="swipe__handle"
        style={{ left: `${fraction * 100}%` }}
        role="slider"
        tabIndex={0}
        aria-label="Before and after divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <span className="swipe__grip" aria-hidden="true">
          ⇄
        </span>
      </div>
    </div>
  );
}
