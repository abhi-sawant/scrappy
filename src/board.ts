/* Shared editor state and the artboard builder.
   Photos and text live in plain state objects so the exporter can rebuild the artboard and cut it into squares. */

import { $, $$ } from './dom';
import { SLIDE, slideH, resetSlots, type Template } from './templates';
import { TEMPLATES } from './catalog';

export type Key = string | number;
export interface Photo { src: string; blob?: Blob | null; nw: number; nh: number; z: number; x: number; y: number }
export type Photos = Record<string, Photo>;
export type Texts = Record<string, string>;

export const state = {
  tpl: null as Template | null,
  photos: {} as Record<string, Photos>,   // tplId -> { slotIdx: {src, nw, nh, z, x, y} }
  texts: {} as Record<string, Texts>,     // tplId -> { handIdx: string }
  sel: null as Key | null,                // selected slot index
  slide: 0,
  S: 300,
  pickIdx: null as Key | null,
  board: null as HTMLElement | null,
  pos: null as HTMLElement | null
};

export const byId = (id: string) => TEMPLATES.find((t) => t.id === id);
export const photosOf = (id: string) => (state.photos[id] ||= {});
export const textsOf = (id: string) => (state.texts[id] ||= {});


/* ---------- artboard construction ---------- */
let boardUid = 0;
/* every copy of this slot's photo: a photo that crosses a slide edge is drawn once per slide, all sharing one slot */
function linked(slot: HTMLElement) {
  const root = slot.closest<HTMLElement>('.board');
  return root ? $$(`.slot[data-slot="${slot.dataset.slot}"]`, root) : [slot];
}

export function layoutPhoto(slot: HTMLElement, ph: Photo) {
  const sw = slot.parentElement!;
  const W = parseFloat(sw.style.width), H = parseFloat(sw.style.height);
  const base = Math.max(W / ph.nw, H / ph.nh), s = base * ph.z;
  const iw = ph.nw * s, ih = ph.nh * s;
  const mx = (iw - W) / 2 / W, my = (ih - H) / 2 / H;
  ph.x = Math.max(-mx, Math.min(mx, ph.x)); ph.y = Math.max(-my, Math.min(my, ph.y));
  for (const p of linked(slot)) {
    const img = $<HTMLImageElement>('.photo', p);
    img.style.width = iw + 'px'; img.style.height = ih + 'px';
    img.style.left = ((W - iw) / 2 + ph.x * W) + 'px'; img.style.top = ((H - ih) / 2 + ph.y * H) + 'px';
  }
}

export function applyPhoto(slot: HTMLElement, ph?: Photo | null) {
  for (const s of linked(slot)) {
    const img = $<HTMLImageElement>('.photo', s);
    if (!ph) { s.removeAttribute('data-filled'); img.hidden = true; img.removeAttribute('src'); continue; }
    img.src = ph.src; img.hidden = false; s.dataset.filled = '1';
  }
  if (ph) layoutPhoto(slot, ph);
}

/* text that crosses a slide edge has read-only copies on the next slides; keep them showing the original */
export function syncTwins(h: HTMLElement) {
  const root = h.closest<HTMLElement>('.board');
  if (root && h.dataset.twin) $$(`.hand[data-copy][data-twin="${h.dataset.twin}"]`, root).forEach((c) => { c.textContent = h.innerText; });
}

export function buildBoard(tpl: Template, { editing = false, photos = photosOf(tpl.id), texts = textsOf(tpl.id) }: { editing?: boolean; photos?: Photos; texts?: Texts } = {}) {
  resetSlots();
  const el = document.createElement('div');
  el.className = 'board' + (editing ? ' editing' : '');
  el.style.width = tpl.slides * SLIDE + 'px';
  el.style.height = slideH(tpl) + 'px';
  // gradient/filter ids must be unique per board: url(#id) binds to the first match in the document, even inside a hidden screen
  const uid = ++boardUid;
  el.innerHTML = tpl.build().replace(/(id="|url\(#)([\w-]+)/g, `$1$2-${uid}`);
  $$('.slot:not([data-piece])', el).forEach((s) => applyPhoto(s, photos[s.dataset.slot!]));
  $$('.hand:not([data-copy])', el).forEach((h, i) => {
    h.dataset.h = String(i);
    if (texts[i] !== undefined) h.textContent = texts[i];
    if (!editing) h.removeAttribute('contenteditable');
  });
  $$('.hand[data-twin]:not([data-copy])', el).forEach(syncTwins);
  return el;
}
