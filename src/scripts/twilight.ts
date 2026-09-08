// twilight.ts — the shared clock of the evening. Pure functions, no DOM.
// Site: 27.99°N 86.93°E (Khumbu), 20 October. Sunset 17:32 NPT; the sun
// sinks ~12.4° per hour at this latitude and date.
export const SUNSET_MIN = 17 * 60 + 32;
export const SINK_DEG_PER_HOUR = 12.4;

export function phaseOf(alt: number): string {
  if (alt > 0) return 'golden';
  if (alt > -3) return 'sunset';
  if (alt > -6) return 'civil';
  if (alt > -12) return 'nautical';
  if (alt > -18) return 'astro';
  return 'night';
}
export const PHASE_LABEL: Record<string, string> = {
  golden: 'GOLDEN HOUR', sunset: 'SUNSET · ALPENGLOW', civil: 'CIVIL TWILIGHT',
  nautical: 'NAUTICAL TWILIGHT', astro: 'ASTRONOMICAL TWILIGHT', night: 'NIGHT',
};
/** local clock (HH:MM NPT) for a solar altitude in degrees */
export function clockOf(alt: number): string {
  const m = SUNSET_MIN - (alt * 60) * (1 / SINK_DEG_PER_HOUR);
  const h = Math.floor(m * (1 / 60));
  const mm = Math.round(m - h * 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
/** "+4°", "−5°" */
export function sunLabel(alt: number): string {
  return `${alt > 0 ? '+' : alt < 0 ? '−' : ''}${Math.abs(alt)}°`;
}
