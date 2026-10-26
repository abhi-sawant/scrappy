/* The full template list: the real-photo collages first, then the illustrated sets. */

import { TEMPLATES as ILLUSTRATED, resetSlots, type Template } from './templates';
import { REAL_DEFS, takeSamples } from './realistic';

const REAL: Template[] = REAL_DEFS.map((t) => {
  resetSlots();
  const html = t.build();
  return { ...t, photoCount: new Set(html.match(/data-slot="\d+"/g)).size, samples: takeSamples().slice() };
});

export const TEMPLATES: Template[] = [...REAL, ...ILLUSTRATED];
