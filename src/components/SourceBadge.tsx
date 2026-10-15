import type { DataSource } from '../types';

export function SourceBadge({ source }: { source: DataSource }) {
  return <span className={`badge badge--${source}`}>{source}</span>;
}
