import { TIME_SLOTS } from '../config';
import type { PathSegment } from '../types';
import { SourceBadge } from './SourceBadge';

interface SegmentPopupProps {
  segment: PathSegment;
  lengthM: number;
  /** Shade now in use (after overrides and interventions). */
  effectiveShade: number;
}

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

export function SegmentPopup({ segment, lengthM, effectiveShade }: SegmentPopupProps) {
  return (
    <div className="segment-popup">
      <strong>{segment.id}</strong>
      <p>
        {Math.round(lengthM)} m long, {segment.widthM} m wide
      </p>
      <p>
        Shade now: <span className="num">{percent(effectiveShade)}</span>
      </p>
      <table>
        <tbody>
          {TIME_SLOTS.map((t) => (
            <tr key={t}>
              <th scope="row">{t}</th>
              <td className="num">{percent(segment.shade[t])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Source: <SourceBadge source={segment.shadeSource} />
      </p>
      {segment.notes && <p>{segment.notes}</p>}
    </div>
  );
}
