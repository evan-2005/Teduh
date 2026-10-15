import type { FabricationSpec } from '../../types';

const CSV_HEADER = ['item', 'qty', 'unit', 'unitCost', 'total'] as const;

/** Quote a CSV field only when it needs it. */
const csvField = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Header plus exactly one row per bill-of-materials line. */
export function toCsv(spec: FabricationSpec): string {
  const rows = spec.bom.map((l) => [l.item, l.qty, l.unit, l.unitCost, l.total].map(csvField).join(','));
  return [CSV_HEADER.join(','), ...rows].join('\n') + '\n';
}

export const toJson = (spec: FabricationSpec): string => JSON.stringify(spec, null, 2);

/** Trigger a browser download. Browser-only; not covered by unit tests. */
export function downloadFile(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
