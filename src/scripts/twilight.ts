// twilight.ts: the phases of the evening by solar altitude. Pure, no DOM.
// The stage uses the phase to colour type and set its graduated filters.
// Nothing here is ever printed on the page.
export function phaseOf(alt: number): string {
  if (alt > 0) return 'golden';
  if (alt > -3) return 'sunset';
  if (alt > -6) return 'civil';
  if (alt > -12) return 'nautical';
  if (alt > -18) return 'astro';
  return 'night';
}
