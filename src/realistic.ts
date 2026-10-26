/* Real-photo collage templates.
   The look is the opposite of the cartoon sets: full-bleed photographs, torn paper edges, polaroids, pressed flowers
   and hand-drawn doodles laid over the pictures. There is almost no background, the photos are the background.

   Slides are 4:5 (1080 x 1350). Every slide is authored in a 1024 x 1280 coordinate space and scaled up by K, which is
   how the reference carousel was measured. Each slide lives in its own clipping container (.sl).

   A carousel has to read as one strip when swiped, so nothing may simply stop at a slide edge. Anything that crosses
   an edge is built with cross(): it is drawn once in every slide it touches, at the same place on the strip, and each
   slide crops its own part. Photo copies share one slot, so the user adds one photo and it carries across the seam.
   Where two different photos meet, the new one starts a little before the seam with a torn edge. */

import { SLIDE, rng, slotBox, nextSlot, box, samplePhoto, type Sample, type Template } from './templates';


const K = SLIDE / 1024;
const RW = 1024, RH = 1280;
export const REAL_H = Math.round(RH * K);

/* placeholder artwork (drawn scenes), so previews never show anyone's real photos */
const art = (k: number): Sample => ({ src: samplePhoto(k), w: 1200, h: 1200 });
const IMG = {
  bg: art(1), feet: art(2), boat: art(3), shop: art(4), strip: art(5), cut: art(6), lake: art(7), town: art(0),
  pause: art(2), bags: art(5), girl: art(6), pancake: art(3), pancake2: art(4), petunia: art(0), door: art(1), palace: art(7)
};

/* arch-shaped cut-out outline, px relative to the 481 x 465 box */
const CUT_PTS: number[][] = (() => {
  const w = 481, h = 465, r = w * 0.4;
  const arc = Array.from({ length: 25 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / 24;
    return [Math.round(w / 2 + Math.cos(a) * r), Math.round(r + Math.sin(a) * r)];
  });
  return [[Math.round(w * 0.1), h], ...arc, [Math.round(w * 0.9), h]];
})();

/* the sample photo of each slot, in slot order; filled while a template builds */
let cur: Sample[] = [];
export const takeSamples = () => cur;

/* one copy of a photo that crosses slide edges; all copies share the slot made for the first one */
interface Piece { sh: { im: Sample; idx?: number }; main: boolean }
type Src = Sample | Piece;

function pslot(x: number, y: number, w: number, h: number, clip: string, im: Src) {
  if ('sh' in im) {
    if (im.sh.idx === undefined) { im.sh.idx = nextSlot(); cur.push(im.sh.im); }
    return slotBox(x, y, w, h, clip, { idx: im.sh.idx, main: im.main });
  }
  cur.push(im);
  return slotBox(x, y, w, h, clip);
}

/* An element that starts on slide i at x and is w wide, drawn into every slide it reaches.
   Returns one copy per slide (slide i first). make gets the copy's x, the photo to use and the copy number;
   the copy showing the most of the element carries the "+" chip. */
function cross(i: number, x: number, w: number, make: (x: number, p: Piece, k: number) => string, im: Sample = IMG.bg): string[] {
  const n = Math.floor((x + w - 1) / RW) + 1, sh = { im };
  const vis = Array.from({ length: n }, (_, k) => Math.min(RW, x - k * RW + w) - Math.max(0, x - k * RW));
  const main = vis.indexOf(Math.max(...vis));
  return vis.map((_, k) => make(x - k * RW, { sh, main: k === main }, k));
}

/* ---------- shared bits ---------- */
let uid = 0;
const fx = (n: number) => n.toFixed(1);
const esc = (s: string) => s.replace(/<br>/g, ' ').replace(/"/g, '&quot;');

const sl = (i: number, inner: string) => `<div class="sl" style="left:${i * RW}px">${inner}</div>`;
const ref = (n: number, slides: string[]) =>
  `<div class="ref" style="width:${n * RW}px;height:${RH}px;transform:scale(${K})">${slides.map((s, i) => sl(i, s)).join('')}</div>`;

/* smooth 0..1 noise along an edge; three octaves give long swells plus small ragged bites */
function wave(seed: number) {
  const r = rng(seed * 31 + 5);
  const p = [r() * 6.28, r() * 6.28, r() * 6.28], f = [0.011 + r() * 0.006, 0.027 + r() * 0.01, 0.07 + r() * 0.03];
  return (t: number) => 0.5 + 0.5 * (0.55 * Math.sin(t * f[0] + p[0]) + 0.3 * Math.sin(t * f[1] + p[1]) + 0.15 * Math.sin(t * f[2] + p[2]));
}

interface RipOpt { edges: string; seed: number; paper?: number; fringe?: number; wave?: number; z?: number; rot?: number; paperColor?: string }

/* [paper outline, photo outline] of a rectangle whose listed edges are torn.
   The photo always sits a ragged fringe inside the paper, so a sliver of white shows along every tear. */
function ripPolys(w: number, h: number, o: RipOpt) {
  const r = rng(o.seed), paper = o.paper ?? 12, fringe = o.fringe ?? 24, macro = o.wave ?? 0, step = 9;
  const noise: Record<string, [(t: number) => number, (t: number) => number]> = {};
  for (const e of 'tblr') noise[e] = [wave(o.seed * 7 + e.charCodeAt(0)), wave(o.seed * 13 + e.charCodeAt(0))];
  /* paper offset and photo offset (both measured inward from the box edge) at position t along edge e */
  const at = (e: string, t: number): [number, number] => {
    if (!o.edges.includes(e)) return [0, 0];
    const [w1, w2] = noise[e];
    const p = Math.max(0, macro * w1(t) + paper * w2(t) + (r() - 0.5) * 4);
    return [p, p + 5 + fringe * w1(t * 1.7 + 9) * (0.45 + 0.55 * w2(t * 2.3)) + r() * 3];
  };
  const P: [number, number][][] = [[], []];
  const push = (fn: (v: number) => [number, number], t: number, e: string) => {
    const [a, b] = at(e, t);
    P[0].push(fn(a)); P[1].push(fn(b));
  };
  for (let x = 0; x <= w; x += step) push((v) => [x, v], x, 't');
  for (let y = 0; y <= h; y += step) push((v) => [w - v, y], y, 'r');
  for (let x = w; x >= 0; x -= step) push((v) => [x, h - v], x, 'b');
  for (let y = h; y >= 0; y -= step) push((v) => [v, y], y, 'l');
  return P.map((pts) => 'polygon(' + pts.map(([a, b]) => `${fx(Math.max(0, a))}px ${fx(Math.max(0, b))}px`).join(',') + ')');
}

/* a photo with torn paper edges and a white paper fringe behind the tear */
function rip(x: number, y: number, w: number, h: number, im: Src, o: RipOpt) {
  const [paperClip, photoClip] = ripPolys(w, h, o);
  return `<div class="frame torn real" style="${box(x, y, w, h, o.rot ?? 0, o.z ? `z-index:${o.z}` : '')}">` +
    `<i class="paper" style="background:${o.paperColor ?? '#f8f6f1'};clip-path:${paperClip}"></i>` +
    pslot(0, 0, w, h, photoClip, im) + `</div>`;
}

/* loose scrap of torn white paper */
function scrap(x: number, y: number, w: number, h: number, seed: number, rot = 0) {
  const [paperClip] = ripPolys(w, h, { edges: 'tblr', seed, paper: Math.min(w, h) * 0.18 });
  return `<div class="frame torn real" style="${box(x, y, w, h, rot)}"><i class="paper" style="background:#f8f6f1;clip-path:${paperClip}"></i></div>`;
}

const fullPhoto = (x: number, y: number, w: number, h: number, im: Src, z = 0) =>
  `<div class="frame bleed" style="${box(x, y, w, h, 0, z ? `z-index:${z}` : '')}">${pslot(0, 0, w, h, '', im)}</div>`;

function cutout(x: number, y: number, w: number, h: number, pts: number[][], im: Sample) {
  const clip = 'polygon(' + pts.map((p) => `${p[0]}px ${p[1]}px`).join(',') + ')';
  return `<div class="frame cutout" style="${box(x, y, w, h)}">${pslot(0, 0, w, h, clip, im)}</div>`;
}

interface PolPad { s: number; t: number; b: number }
function rpol(cx: number, cy: number, w: number, h: number, rot: number, pad: PolPad, im: Sample, extra = '') {
  return `<div class="frame polaroid real" style="${box(cx - w / 2, cy - h / 2, w, h, rot, 'background:linear-gradient(180deg,#fdfcf9,#efede7)')}">` +
    pslot(pad.s, pad.t, w - pad.s * 2, h - pad.t - pad.b, '', im) + extra + `</div>`;
}

/* editable handwriting / type */
/* twin: text that crosses a slide edge is drawn once per slide; the copies (copy: true) mirror the editable original */
interface NoteOpt { rot?: number; color?: string; font?: string; align?: string; extra?: string; z?: number; cls?: string; twin?: string; copy?: boolean }
function note(text: string, x: number, y: number, w: number, size: number, o: NoteOpt = {}) {
  const st = `left:${x}px;top:${y}px;width:${w}px;font-size:${size}px;color:${o.color ?? '#fff'};` +
    `${o.font ? `font-family:${o.font};` : ''}text-align:${o.align ?? 'center'};` +
    `${o.rot ? `transform:rotate(${o.rot}deg);` : ''}${o.z !== undefined ? `z-index:${o.z};` : ''}${o.extra ?? ''}`;
  const twin = o.twin ? ` data-twin="${o.twin}"${o.copy ? ' data-copy' : ''}` : '';
  const edit = o.copy ? '' : ' contenteditable="plaintext-only" spellcheck="false"';
  return `<div class="hand note ${o.cls ?? ''}"${edit}${twin} data-default="${esc(text)}" style="${st}">${text}</div>`;
}

/* ---------- pressed flowers ---------- */
interface Bloom {
  n: number; L: number; w: number; notch: number; stops: [number, string][]; edge: string; vein: string; veins: number;
  center: { r: number; c: [string, string]; dots: string; stamens?: number };
  back?: boolean; jitter?: number; tint?: [string, number];
}
const BLOOMS: Record<string, Bloom> = {
  daisy: {
    n: 17, L: 86, w: 15, notch: 6, edge: 'rgba(120,96,40,.42)', vein: 'rgba(125,100,45,.4)', veins: 3, back: true, jitter: 4,
    stops: [[0, '#f1dc8a'], [0.3, '#f6ebbb'], [1, '#faf2d2']],
    center: { r: 27, c: ['#e9c33f', '#a9791a'], dots: '#6f4f0e' }
  },
  daisyDry: {
    n: 18, L: 90, w: 15, notch: 7, edge: 'rgba(115,90,40,.5)', vein: 'rgba(120,95,45,.5)', veins: 3, back: true, jitter: 4,
    stops: [[0, '#e2c775'], [0.3, '#ecdca4'], [1, '#f1e4bb']],
    center: { r: 31, c: ['#d4aa2d', '#8a5f10'], dots: '#5a3f08' }
  },
  gerbera: {
    n: 30, L: 88, w: 10.5, notch: 0, edge: 'rgba(30,85,110,.5)', vein: 'rgba(210,240,246,.5)', veins: 2, back: true, jitter: 4,
    stops: [[0, '#6fb7c2'], [0.4, '#58a4bd'], [1, '#86c3d0']],
    center: { r: 25, c: ['#cfc54e', '#80792a'], dots: '#4f4a14' }
  },
  pink: {
    n: 5, L: 74, w: 46, notch: 9, edge: 'rgba(150,70,90,.35)', vein: 'rgba(160,60,90,.42)', veins: 6, jitter: 5,
    stops: [[0, '#d0637f'], [0.35, '#eca1b3'], [1, '#f7cfd6']],
    center: { r: 10, c: ['#e8a24c', '#a9551f'], dots: '#7a3a14', stamens: 12 }
  },
  hibiscus: {
    n: 5, L: 82, w: 54, notch: 6, edge: 'rgba(170,40,90,.3)', vein: 'rgba(180,30,90,.45)', veins: 7, jitter: 4,
    stops: [[0, '#d23a76'], [0.4, '#ee79a6'], [1, '#f6a7c2']],
    center: { r: 9, c: ['#f0b24c', '#b25a1d'], dots: '#6e2a10', stamens: 14 }
  },
  cream: {
    n: 5, L: 86, w: 52, notch: 5, edge: 'rgba(120,100,60,.35)', vein: 'rgba(140,120,70,.4)', veins: 6, jitter: 5, tint: ['#a58ec4', 0.45],
    stops: [[0, '#e6c963'], [0.35, '#f1e3a7'], [1, '#f7efcc']],
    center: { r: 12, c: ['#d98a2c', '#9b4d17'], dots: '#6b3510', stamens: 13 }
  },
  larkspur: {
    n: 5, L: 70, w: 44, notch: 8, edge: 'rgba(100,70,130,.4)', vein: 'rgba(120,90,150,.4)', veins: 5, jitter: 7, tint: ['#7f5fae', 0.6],
    stops: [[0, '#8f6cb8'], [0.3, '#e4d3e2'], [0.7, '#f1e7d6'], [1, '#f4ecd0']],
    center: { r: 12, c: ['#c9c34f', '#8f8a2a'], dots: '#575314', stamens: 9 }
  },
  orange: {
    n: 5, L: 72, w: 50, notch: 0, edge: 'rgba(190,100,20,.25)', vein: 'rgba(200,110,20,.3)', veins: 3, jitter: 3,
    stops: [[0, '#f59a28'], [0.5, '#f8ae44'], [1, '#fcc866']],
    center: { r: 12, c: ['#ffd96a', '#f2b233'], dots: '#c98a1a' }
  },
  yellow: {
    n: 6, L: 76, w: 46, notch: 4, edge: 'rgba(160,120,20,.3)', vein: 'rgba(170,130,20,.35)', veins: 4, jitter: 4,
    stops: [[0, '#e7b92a'], [0.5, '#f1d25a'], [1, '#f7e28a']],
    center: { r: 12, c: ['#d79a1d', '#9c6510'], dots: '#6a410c' }
  }
};
export type BloomKind = keyof typeof BLOOMS;

function petalPath(L: number, w: number, notch: number) {
  const c = 100, tip = c - L;
  return `M${c} ${c} C${fx(c - w * 0.62)} ${fx(c - L * 0.22)} ${fx(c - w * 0.92)} ${fx(c - L * 0.7)} ${fx(c - w * 0.5)} ${fx(tip + 3)} ` +
    `Q${c} ${fx(tip + notch - 4)} ${fx(c + w * 0.5)} ${fx(tip + 3)} C${fx(c + w * 0.92)} ${fx(c - L * 0.7)} ${fx(c + w * 0.62)} ${fx(c - L * 0.22)} ${c} ${c}Z`;
}

/* a pressed, slightly translucent flower, drawn from scratch so it can be any size without going soft */
export function pressed(kind: BloomKind, cx: number, cy: number, size: number, rot = 0, seed = 1) {
  const b = BLOOMS[kind], r = rng(seed * 97 + 3), id = ++uid;
  const stops = b.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const tint = b.tint ? `<radialGradient id="pt${id}" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="${b.L + 6}"><stop offset=".55" stop-color="${b.tint[0]}" stop-opacity="0"/><stop offset="1" stop-color="${b.tint[0]}" stop-opacity="${b.tint[1]}"/></radialGradient>` : '';
  const defs = `<defs><radialGradient id="pg${id}" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="${b.L + 6}">${stops}</radialGradient>${tint}` +
    `<radialGradient id="pc${id}" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="${b.center.c[0]}"/><stop offset="1" stop-color="${b.center.c[1]}"/></radialGradient>` +
    `<filter id="pf${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="${seed}" result="w"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="w" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="${seed + 4}" result="g"/>` +
    `<feColorMatrix in="g" type="matrix" values="0 0 0 0 .36 0 0 0 0 .27 0 0 0 0 .12 0 0 0 .95 -.3" result="s"/>` +
    `<feComposite in="s" in2="d" operator="in" result="s2"/><feMerge><feMergeNode in="d"/><feMergeNode in="s2"/></feMerge></filter></defs>`;

  const layer = (offset: number, scale: number, op: number) => {
    let g = '';
    for (let i = 0; i < b.n; i++) {
      const a = (360 / b.n) * (i + offset) + (r() - 0.5) * 2 * (b.jitter ?? 3);
      const L = b.L * scale * (0.93 + r() * 0.14), w = b.w * (0.9 + r() * 0.2) * (scale > 0.95 ? 1 : 0.95);
      const d = petalPath(L, w, b.notch);
      let veins = '';
      for (let k = 0; k < b.veins; k++) {
        const f = b.veins === 1 ? 0 : (k / (b.veins - 1) - 0.5) * 1.5;
        const x1 = 100 + f * w * 0.18, x2 = 100 + f * w * 0.62, yb = 100 - L * 0.14, yt = 100 - L * (0.74 + r() * 0.16);
        veins += `<path d="M${fx(x1)} ${fx(yb)} Q${fx((x1 + x2) / 2 + f * 3)} ${fx((yb + yt) / 2)} ${fx(x2)} ${fx(yt)}" fill="none" stroke="${b.vein}" stroke-width=".9"/>`;
      }
      g += `<g transform="rotate(${fx(a)} 100 100)" opacity="${op}"><path d="${d}" fill="url(#pg${id})" stroke="${b.edge}" stroke-width="1"/>` +
        (b.tint ? `<path d="${d}" fill="url(#pt${id})"/>` : '') + veins + `</g>`;
    }
    return g;
  };
  let body = b.back ? layer(0.5, 0.9, 0.95) : '';
  body += layer(0, 1, 1);

  const cR = b.center.r;
  let c = '';
  if (b.center.stamens) {
    for (let i = 0; i < b.center.stamens; i++) {
      const a = r() * 6.28, l = cR * (0.9 + r() * 1.4), x = 100 + Math.cos(a) * l, y = 100 + Math.sin(a) * l;
      c += `<path d="M100 100 L${fx(x)} ${fx(y)}" stroke="${b.center.c[1]}" stroke-width="1.4" opacity=".75"/><circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(2.2 + r() * 1.6)}" fill="${b.center.dots}"/>`;
    }
    c += `<circle cx="100" cy="100" r="${cR * 0.55}" fill="url(#pc${id})"/>`;
  } else {
    c += `<circle cx="100" cy="100" r="${cR}" fill="url(#pc${id})" stroke="rgba(80,50,10,.35)" stroke-width="1.2"/>`;
    for (let i = 0; i < Math.round(cR * 2.6); i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * cR * 0.92;
      c += `<circle cx="${fx(100 + Math.cos(a) * d)}" cy="${fx(100 + Math.sin(a) * d)}" r="${fx(0.9 + r() * 1.9)}" fill="${r() > 0.35 ? b.center.dots : '#fff6c0'}" opacity="${fx(0.35 + r() * 0.4)}"/>`;
    }
  }
  return `<svg class="pressed" viewBox="0 0 200 200" style="${box(cx - size / 2, cy - size / 2, size, size, rot)}" aria-hidden="true">${defs}<g filter="url(#pf${id})">${body}${c}</g></svg>`;
}

/* a pressed flower centred at cx on slide i, carried into the next slide when it overlaps the edge */
const bloom = (i: number, kind: BloomKind, cx: number, cy: number, size: number, rot = 0, seed = 1) =>
  cross(i, cx - size * 0.65, size * 1.3, (x) => pressed(kind, x + size * 0.65, cy, size, rot, seed));

/* ---------- doodles ---------- */
const dsvg = (cx: number, cy: number, s: number, vb: string, inner: string, rot = 0, extra = '') =>
  `<svg class="doodle" viewBox="${vb}" style="${box(cx - s / 2, cy - s / 2, s, s, rot, extra)}" aria-hidden="true">${inner}</svg>`;

function sunDoodle(cx: number, cy: number, s: number) {
  const id = ++uid;
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2, c = Math.cos(a), sn = Math.sin(a);
    rays += `<path d="M${fx(50 + c * 38)} ${fx(50 + sn * 38)} L${fx(50 + c * 47)} ${fx(50 + sn * 47)}" stroke="#ffc93c" stroke-width="3.6" stroke-linecap="round"/>`;
  }
  return dsvg(cx, cy, s, '0 0 100 100',
    `<defs><radialGradient id="sd${id}" cx=".38" cy=".35" r=".8"><stop offset="0" stop-color="#ffe07a"/><stop offset=".6" stop-color="#ffc233"/><stop offset="1" stop-color="#f2a31a"/></radialGradient></defs>${rays}` +
    `<circle cx="50" cy="50" r="29" fill="url(#sd${id})" stroke="#fff3c4" stroke-width="2"/>`, 0, 'filter:drop-shadow(0 5px 5px rgba(20,30,60,.35))');
}

function smileyDoodle(cx: number, cy: number, s: number) {
  const k = 'stroke="#161616" stroke-width="3" stroke-linecap="round" fill="none"';
  return dsvg(cx, cy, s, '0 0 100 100',
    `<circle cx="50" cy="52" r="25" fill="#fff" stroke="#161616" stroke-width="3.2"/><circle cx="43" cy="48" r="2.6" fill="#161616"/><circle cx="58" cy="48" r="2.6" fill="#161616"/>` +
    `<path d="M40 58 Q50 68 60 58" ${k}/><path d="M22 32 l6 5" ${k}/><path d="M13 53 l9 1" ${k}/><path d="M76 34 l8 -5" ${k}/><path d="M22 76 l7 -5" ${k}/><path d="M50 12 l1 8" ${k}/><path d="M72 80 l5 7" ${k}/>`);
}

function birds(x: number, y: number, w: number, h: number, rot = 0) {
  const p = (dx: number, dy: number, s: number) =>
    `<path d="M${dx} ${dy + 14 * s} C${dx + 6 * s} ${dy + 2 * s} ${dx + 17 * s} ${dy} ${dx + 24 * s} ${dy + 13 * s} C${dx + 30 * s} ${dy + 1 * s} ${dx + 44 * s} ${dy + 2 * s} ${dx + 52 * s} ${dy + 11 * s}" stroke="#141414" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  return `<svg class="doodle" viewBox="0 0 100 60" preserveAspectRatio="none" style="${box(x, y, w, h, rot)}" aria-hidden="true">${p(2, 4, 1.4)}${p(30, 2, 0.8)}${p(14, 36, 1)}</svg>`;
}

function crownDoodle(cx: number, cy: number, s: number) {
  return dsvg(cx, cy, s, '0 0 64 64',
    `<path d="M10 44 L8 16 L21 28 L32 8 L43 28 L56 16 L54 44 Z" fill="#f6b52a" stroke="#1d1a14" stroke-width="3" stroke-linejoin="round"/><path d="M10 44 L54 44" stroke="#1d1a14" stroke-width="3"/>` +
    `<circle cx="8" cy="14" r="3" fill="#f6b52a" stroke="#1d1a14" stroke-width="2"/><circle cx="32" cy="6" r="3" fill="#f6b52a" stroke="#1d1a14" stroke-width="2"/><circle cx="56" cy="14" r="3" fill="#f6b52a" stroke="#1d1a14" stroke-width="2"/>`);
}

function sketchFlower(cx: number, cy: number, s: number, rot = 0, stroke = '#f3c431') {
  let p = '';
  for (let i = 0; i < 5; i++) p += `<path d="M50 50 C36 40 38 14 50 12 C62 14 64 40 50 50Z" transform="rotate(${i * 72} 50 50)" fill="none" stroke="${stroke}" stroke-width="3.4" stroke-linejoin="round"/>`;
  return dsvg(cx, cy, s, '0 0 100 100', `${p}<circle cx="50" cy="50" r="9" fill="#f59a23" stroke="${stroke}" stroke-width="2.4"/>`, rot);
}

function heart(cx: number, cy: number, s: number, fill = '#fff', rot = 0) {
  return dsvg(cx, cy, s, '0 0 24 24', `<path d="M12 21 C3 14 2 9 2 7 A5 5 0 0 1 12 6 A5 5 0 0 1 22 7 C22 9 21 14 12 21Z" fill="${fill}"/>`, rot, 'filter:drop-shadow(0 2px 2px rgba(0,0,0,.2))');
}

function rays(cx: number, cy: number, s: number, rot: number, color = '#ffd23c') {
  return dsvg(cx, cy, s, '0 0 100 100',
    `<path d="M50 70 L44 20 L56 20Z" fill="${color}" transform="rotate(-38 50 70)"/><path d="M50 70 L45 14 L55 14Z" fill="${color}"/><path d="M50 70 L44 20 L56 20Z" fill="${color}" transform="rotate(38 50 70)"/>`, rot);
}

/* a short, fat dash used for the "Rewind" burst */
const dash = (x1: number, y1: number, x2: number, y2: number, color = '#ffd23c', w = 9) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;

function splatter(x: number, y: number, w: number, h: number, seed: number, count: number, bias = 0) {
  const r = rng(seed);
  let c = '';
  for (let i = 0; i < count; i++) {
    const t = Math.pow(r(), 1 + bias);
    const px = r() * w, py = (bias ? t : r()) * h, rr = 0.8 + Math.pow(r(), 3.2) * 7.5;
    c += `<circle cx="${fx(px)}" cy="${fx(py)}" r="${fx(rr)}" fill="#fff" opacity="${fx(0.55 + r() * 0.45)}"/>`;
  }
  return `<svg class="doodle" viewBox="0 0 ${w} ${h}" style="${box(x, y, w, h)}" aria-hidden="true">${c}</svg>`;
}

function stamp(x: number, y: number, w: number, h: number, rot: number) {
  return `<svg class="doodle" viewBox="0 0 80 100" style="${box(x, y, w, h, rot)}" aria-hidden="true">` +
    `<rect x="4" y="4" width="72" height="92" fill="rgba(250,248,242,.55)" stroke="#16130f" stroke-width="3" stroke-dasharray="5 3"/>` +
    `<rect x="12" y="12" width="56" height="76" fill="none" stroke="#16130f" stroke-width="2.4"/>` +
    `<text x="40" y="58" text-anchor="middle" font-family="'Special Elite',monospace" font-size="34" fill="#16130f">8</text>` +
    `<path d="M2 20 C16 12 28 28 44 18 S66 24 78 14 M2 28 C16 20 28 36 44 26 S66 32 78 22" stroke="#16130f" stroke-width="2" fill="none"/></svg>`;
}

function commentIcon(x: number, y: number, s: number, rot = 0) {
  return `<svg class="doodle" viewBox="0 0 40 40" style="${box(x, y, s, s, rot)}" aria-hidden="true"><path d="M7 5 H33 A3 3 0 0 1 36 8 V26 A3 3 0 0 1 33 29 H24 L20 36 L16 29 H7 A3 3 0 0 1 4 26 V8 A3 3 0 0 1 7 5Z" fill="none" stroke="#2a2a2a" stroke-width="2.6" stroke-linejoin="round"/><path d="M20 22 C13 17 14 11 18 11 C19.5 11 20 12.5 20 12.5 C20 12.5 20.5 11 22 11 C26 11 27 17 20 22Z" fill="none" stroke="#2a2a2a" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}


/* soft dark or light wash so type stays readable over a photo */
const shade = (x: number, y: number, w: number, h: number, css: string) =>
  `<div class="shade" style="${box(x, y, w, h, 0, `background:${css}`)}"></div>`;

/* translucent washi tape with zig-zag ends */
function washi(x: number, y: number, w: number, rot = 0, color = 'rgba(255,214,102,.82)', stripe = false) {
  const h = 44, a: string[] = [], b: string[] = [];
  for (let i = 0; i <= 8; i++) a.push(`${i % 2 ? 2.4 : 0}% ${(i / 8) * 100}%`);
  for (let i = 8; i >= 0; i--) b.push(`${i % 2 ? 97.6 : 100}% ${(i / 8) * 100}%`);
  const bg = stripe ? `repeating-linear-gradient(90deg,${color} 0 20px,rgba(255,255,255,.5) 20px 32px)` : color;
  return `<div class="tape" style="${box(x, y, w, h, rot, `background:${bg};clip-path:polygon(${a.join(',')},${b.join(',')})`)}"></div>`;
}

/* typewriter label on a paper strip */
const label = (text: string, x: number, y: number, w: number, size: number, rot = 0) =>
  note(text, x, y, w, size, { font: "'Special Elite',monospace", color: '#2b2722', rot, cls: 'label' });

/* torn ticket stub with a perforated edge */
function ticket(text: string, x: number, y: number, w: number, h: number, size: number, rot = 0) {
  return `<div class="frame real ticket" style="${box(x, y, w, h, rot)}"><i class="perf"></i>` +
    note(text, w * 0.27 + 12, h / 2 - size * 0.62, w * 0.73 - 24, size, { font: "'Special Elite',monospace", color: '#2b2722', cls: 'plain' }) + `</div>`;
}

function sparkle(cx: number, cy: number, s: number, rot = 0) {
  return dsvg(cx, cy, s, '0 0 40 40', `<path d="M20 2 C21 13 27 19 38 20 C27 21 21 27 20 38 C19 27 13 21 2 20 C13 19 19 13 20 2Z" fill="#fff"/>`, rot, 'filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))');
}

function underline(x: number, y: number, w: number, color = '#fff', rot = 0) {
  return `<svg class="doodle" viewBox="0 0 200 20" preserveAspectRatio="none" style="${box(x, y, w, 20, rot)}" aria-hidden="true"><path d="M3 12 C30 2 50 18 80 9 S130 4 150 12 S185 8 197 6" stroke="${color}" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg>`;
}

const SHADOW = 'text-shadow:0 2px 10px rgba(0,0,0,.45);';

/* ================= templates ================= */
type Def = Omit<Template, 'photoCount' | 'samples'>;

const MINITRIP: Def = {
  id: 'minitrip', name: 'Mini-trip Rewind', slides: 5, mood: 'Real photos, torn paper, pressed flowers', h: REAL_H,
  build() {
    cur = [];

    /* what crosses the slide edges */
    const palace = cross(0, 0, RW + 445, (x, p) => fullPhoto(x, 0, RW + 445, 726, p), IMG.palace);
    const door = cross(0, 0, RW + 410, (x, p, k) => rip(x, 596, RW + 410, RH - 596, p, { edges: 't', seed: 21, paper: 14, fringe: 26, wave: 88, z: k ? 0 : 2 }), IMG.door);
    const pancake = cross(1, 330, RW - 330 + 120, (x, p) => rip(x, 0, RW - 330 + 120, RH, p, { edges: 'tl', seed: 17, paper: 12, fringe: 26, wave: 30 }), IMG.pancake);
    const pause = cross(2, 36, 2 * RW - 36, (x, p) => rip(x, 0, 2 * RW - 36, RH, p, { edges: 'l', seed: 9, paper: 14, fringe: 30, wave: 26 }), IMG.pause);
    const sky = cross(3, 940, RW + 84, (x, p) => rip(x, 0, RW + 84, RH, p, { edges: 'l', seed: 14, paper: 12, fringe: 24, wave: 20 }), IMG.bg);
    const cream = bloom(0, 'cream', 988, 662, 235, 20, 12);
    const daisy = bloom(1, 'daisy', 35, 1132, 280, -4, 11);
    const dry = bloom(1, 'daisyDry', 975, 125, 310, 12, 10);
    const orange = bloom(3, 'orange', 4, 708, 122, 14, 6);
    const cream2 = bloom(3, 'cream', 960, 650, 250, 6, 5);
    /* the title is wider than the cover; its tail sits under the torn door photo on slide 2 as well */
    const title = cross(0, -566, 2200, (x, _, k) =>
      note('UDAIPUR', x, 345, 2200, 330, { font: "'Bodoni Moda',serif", color: 'rgba(240,244,248,.88)', z: k ? undefined : 1, cls: 'title', align: 'center', twin: 'title', copy: k > 0 }));

    /* 1 - the cover: two photos, a torn edge and a big title; both photos carry on into slide 2 */
    const x1 = [
      palace[0],
      `<svg class="doodle" viewBox="0 0 180 90" style="${box(-6, 176, 190, 95)}" aria-hidden="true"><path d="M0 60 C22 30 40 18 56 34 C70 48 66 70 82 70 C98 70 100 40 118 38 C140 36 150 52 172 56" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      title[0],
      door[0],
      note('Rewind', 392, 700, 240, 62, { font: "'Delicious Handrawn',cursive", extra: 'letter-spacing:.07em;' }),
      `<svg class="doodle" viewBox="0 0 1024 1280" style="${box(0, 0, 1024, 1280)}" aria-hidden="true">${dash(366, 700, 388, 714)}${dash(358, 748, 384, 748)}${dash(364, 776, 388, 790)}${dash(660, 700, 640, 716)}${dash(668, 748, 642, 748)}${dash(662, 776, 640, 788)}</svg>`,
      `<svg class="doodle" viewBox="0 0 50 44" style="${box(844, 66, 48, 44)}" aria-hidden="true"><path d="M25 40 C6 26 3 15 4 12 A10 10 0 0 1 25 10 A10 10 0 0 1 46 12 C47 15 44 26 25 40Z" fill="none" stroke="#161616" stroke-width="2.6" stroke-linejoin="round"/></svg>`,
      note('Mini-trip', 892, 66, 130, 34, { font: "'Over the Rainbow',cursive", color: '#1a1a1a', rot: -3, align: 'left', extra: 'white-space:nowrap;' }),
      cream[0], daisy[0],
      pressed('hibiscus', 40, 1226, 195, -14, 13)
    ];

    /* 2 - food and flowers, a polaroid in the middle; the pancake photo runs into slide 3 */
    const x2 = [
      palace[1], title[1], door[1],
      stamp(-4, 586, 70, 205, -3),
      pancake[0],
      splatter(780, 760, 244, 520, 44, 120, 0.7),
      scrap(150, 1200, 215, 90, 8, 1),
      rpol(331, 808, 392, 457, -8.3, { s: 20, t: 24, b: 80 }, IMG.girl,
        note('love, you!', 36, 392, 320, 56, { color: '#c4413a', font: "'Over the Rainbow',cursive", rot: 1, z: 2 })),
      heart(283, 637, 30, '#fff'), rays(376, 664, 66, 14),
      pressed('pink', 455, 556, 188, -6, 9),
      cream[1], daisy[1], dry[0]
    ];

    /* 3 - one quiet photo with a torn edge and a note; it is also the top of slide 4 */
    const x3 = [
      pancake[1], pause[0],
      splatter(28, 990, 240, 290, 31, 70, 1.4),
      sketchFlower(263, 770, 84, -8), sketchFlower(193, 777, 46, 14), sketchFlower(334, 806, 50, 4),
      crownDoodle(575, 715, 56),
      note('Taking a pause from<br>all the chaos!!', 100, 828, 330, 38, { font: "'Delicious Handrawn',cursive", rot: -1, extra: 'line-height:1.15;word-spacing:.12em;' }),
      dry[1], orange[0]
    ];

    /* 4 - a cut-out standing on the lake, a torn town photo below; the sky photo of slide 5 starts at the right */
    const x4 = [
      pause[1], sky[0],
      rip(30, 640, 960, RH - 640, IMG.town, { edges: 'tlr', seed: 5, paper: 10, fringe: 24, wave: 24 }),
      cutout(351, 208, 481, 465, CUT_PTS, IMG.cut),
      orange[1], cream2[0]
    ];

    /* 5 - three polaroids stuck on one big sky photo */
    const x5 = [
      sky[1],
      rpol(383, 686, 350, 424, -7.6, { s: 14, t: 18, b: 66 }, IMG.boat),
      rpol(268, 317, 350, 424, 4, { s: 14, t: 18, b: 64 }, IMG.feet,
        note('15 Feb 2025', 78, 322, 180, 22, { color: 'rgba(255,255,255,.68)', font: "'Bodoni Moda',serif", extra: 'letter-spacing:.16em;', align: 'left' })),
      rpol(238, 967, 346, 424, 2.8, { s: 14, t: 18, b: 84 }, IMG.shop, commentIcon(284, 352, 40, -4)),
      pressed('larkspur', 181, 522, 215, -18, 2),
      sunDoodle(425, 462, 135),
      smileyDoodle(222, 742, 128),
      pressed('gerbera', 431, 900, 190, 12, 3),
      birds(515, 192, 72, 40, 6), birds(634, 160, 62, 28, -4), birds(620, 226, 76, 40, 3),
      cream2[1]
    ];

    return ref(5, [x1.join(''), x2.join(''), x3.join(''), x4.join(''), x5.join('')]);
  }
};


const GOLDEN: Def = {
  id: 'goldenhour', name: 'Golden Hour', slides: 4, mood: 'Sunset photos, serif title, dried flowers', h: REAL_H,
  build() {
    cur = [];
    /* one photo behind slides 1-2, a second one torn in just before slide 3 and running to the end */
    const bgA = cross(0, 0, 2 * RW, (x, p) => fullPhoto(x, 0, 2 * RW, RH, p), IMG.pause);
    const bgB = cross(1, 900, 2 * RW + 124, (x, p) => rip(x, 0, 2 * RW + 124, RH, p, { edges: 'l', seed: 37, paper: 12, fringe: 24, wave: 20 }), IMG.door);
    const dusk = cross(0, 0, 4 * RW, (x) => shade(x, 0, 4 * RW, 640, 'linear-gradient(180deg,rgba(10,12,24,.45),rgba(10,12,24,0))'));
    const pink = bloom(0, 'pink', 1000, 880, 190, 15, 22);
    const orange = bloom(2, 'orange', 1012, 600, 160, 0, 25);
    const s1 = [
      bgA[0], dusk[0],
      note('GOLDEN<br>HOUR', 60, 120, 960, 178, { font: "'Bodoni Moda',serif", align: 'left', extra: 'line-height:.92;letter-spacing:.04em;' + SHADOW }),
      note('a little escape', 70, 470, 520, 72, { font: "'Delicious Handrawn',cursive", align: 'left', rot: -2, extra: SHADOW }),
      underline(72, 548, 330, '#fff', -2),
      label('OCT · 2025', 690, 1160, 270, 30, 3),
      pressed('daisyDry', 70, 1130, 300, -10, 21),
      pink[0],
      sparkle(840, 330, 64), sparkle(930, 420, 36, 12)
    ];
    const s2 = [
      bgA[1], bgB[0], dusk[1], pink[1],
      rip(80, 110, 720, 520, IMG.lake, { edges: 'tblr', seed: 31, paper: 12, fringe: 22, wave: 8, rot: -2.5 }),
      washi(330, 80, 210, -5, 'rgba(255,190,212,.85)'),
      rpol(250, 930, 330, 400, -6, { s: 16, t: 20, b: 70 }, IMG.feet),
      rpol(690, 900, 380, 460, 5, { s: 18, t: 22, b: 80 }, IMG.girl,
        note('love, you!', 30, 392, 320, 52, { color: '#c4413a', font: "'Over the Rainbow',cursive", rot: 1, z: 2 })),
      washi(540, 668, 180, 6, 'rgba(255,230,140,.85)'),
      pressed('gerbera', 840, 640, 200, 10, 23),
      pressed('hibiscus', 110, 660, 190, -15, 24),
      note('so many little moments', 40, 1190, 700, 62, { font: "'Delicious Handrawn',cursive", rot: -2, extra: SHADOW }),
      birds(640, 120, 80, 44, 4), birds(760, 70, 60, 30, -6)
    ];
    const s3 = [
      bgB[1], dusk[2],
      note('sunshine<br>& salty air', 70, 120, 520, 100, { font: "'Delicious Handrawn',cursive", align: 'left', rot: -5, extra: 'line-height:1;' + SHADOW }),
      rip(580, 220, 400, 540, IMG.petunia, { edges: 'tblr', seed: 33, paper: 12, fringe: 22, wave: 8, rot: 4 }),
      rpol(250, 960, 360, 440, -5, { s: 16, t: 20, b: 76 }, IMG.boat),
      washi(150, 748, 190, -12, 'rgba(255,255,255,.7)', true),
      sunDoodle(880, 900, 150), smileyDoodle(130, 700, 110),
      orange[0], pressed('daisy', 760, 1130, 250, 8, 26),
      sparkle(500, 780, 48)
    ];
    const s4 = [
      bgB[2], dusk[3], orange[1],
      note('see you<br>soon', 70, 110, 600, 170, { font: "'Delicious Handrawn',cursive", align: 'left', rot: -3, extra: 'line-height:.95;' + SHADOW }),
      rip(50, 640, 420, 520, IMG.shop, { edges: 'tblr', seed: 35, paper: 12, fringe: 22, wave: 8, rot: -3 }),
      rip(520, 600, 450, 400, IMG.feet, { edges: 'tblr', seed: 36, paper: 12, fringe: 22, wave: 8, rot: 3 }),
      washi(560, 570, 200, -6, 'rgba(255,190,212,.85)'),
      stamp(840, 960, 100, 130, 8),
      heart(560, 1080, 70, '#ff5b7e', -10),
      pressed('hibiscus', 180, 1190, 220, 10, 27), pressed('cream', 880, 1150, 230, -12, 28),
      label('thanks for swiping', 500, 1130, 420, 26, -2)
    ];
    return ref(4, [s1.join(''), s2.join(''), s3.join(''), s4.join('')]);
  }
};

const WALL: Def = {
  id: 'polaroidwall', name: 'Polaroid Wall', slides: 4, mood: 'Photo-dump polaroids, washi tape, scribbles', h: REAL_H,
  build() {
    cur = [];
    /* one photo behind slides 1-2, a second one torn in just before slide 3 and running to the end */
    const bgA = cross(0, 0, 2 * RW, (x, p) => fullPhoto(x, 0, 2 * RW, RH, p), IMG.bg);
    const bgB = cross(1, 900, 2 * RW + 124, (x, p) => rip(x, 0, 2 * RW + 124, RH, p, { edges: 'l', seed: 38, paper: 12, fringe: 24, wave: 20 }), IMG.door);
    const daisy = bloom(0, 'daisy', 940, 130, 260, 14, 42);
    const s1 = [
      bgA[0],
      note('photo dump', 90, 70, 600, 130, { font: "'Delicious Handrawn',cursive", align: 'left', rot: -4, extra: SHADOW }),
      underline(100, 205, 360, '#fff', -3),
      rpol(250, 540, 360, 440, -7, { s: 16, t: 20, b: 76 }, IMG.feet),
      rpol(700, 470, 340, 410, 6, { s: 15, t: 19, b: 70 }, IMG.boat),
      rpol(330, 1010, 380, 460, 4, { s: 17, t: 21, b: 80 }, IMG.shop),
      rpol(780, 960, 350, 420, -6, { s: 16, t: 20, b: 72 }, IMG.girl),
      washi(150, 330, 170, -30, 'rgba(255,214,102,.85)'), washi(640, 280, 180, 24, 'rgba(255,190,212,.85)'),
      washi(230, 800, 180, 12, 'rgba(255,255,255,.7)', true), washi(700, 760, 170, -18, 'rgba(176,220,255,.85)'),
      pressed('larkspur', 520, 700, 200, 20, 41), daisy[0], pressed('yellow', 70, 760, 150, -10, 43),
      label('2025 · everything', 560, 1180, 400, 26, -3)
    ];
    const s2 = [
      bgA[1], bgB[0], daisy[1],
      rpol(520, 300, 400, 490, 4, { s: 18, t: 22, b: 84 }, IMG.girl,
        note('golden hour', 30, 414, 340, 50, { color: '#c4413a', font: "'Over the Rainbow',cursive", rot: -1, z: 2 })),
      rpol(220, 760, 340, 410, -8, { s: 15, t: 19, b: 70 }, IMG.feet),
      rpol(700, 800, 360, 440, 7, { s: 16, t: 20, b: 76 }, IMG.boat),
      washi(430, 40, 200, 2, 'rgba(255,230,140,.85)'), washi(120, 560, 180, -26, 'rgba(255,190,212,.85)'), washi(640, 580, 180, 30, 'rgba(176,220,255,.85)'),
      sunDoodle(900, 160, 130), heart(140, 180, 64, '#fff', -12),
      pressed('gerbera', 860, 1160, 230, 10, 44), pressed('pink', 150, 1130, 200, -14, 45),
      note('little things', 330, 1150, 440, 70, { font: "'Delicious Handrawn',cursive", rot: -3, extra: SHADOW })
    ];
    const s3 = [
      bgB[1],
      rpol(300, 330, 400, 490, -6, { s: 18, t: 22, b: 84 }, IMG.shop),
      rpol(720, 880, 400, 490, 5, { s: 18, t: 22, b: 84 }, IMG.girl,
        note('love, you!', 30, 414, 340, 54, { color: '#c4413a', font: "'Over the Rainbow',cursive", rot: 1, z: 2 })),
      washi(210, 80, 200, -8, 'rgba(255,214,102,.85)'), washi(620, 650, 190, 10, 'rgba(255,190,212,.85)'),
      pressed('hibiscus', 560, 120, 200, 10, 46), pressed('daisyDry', 90, 1000, 270, -8, 47),
      smileyDoodle(850, 250, 130), sparkle(160, 640, 56), sparkle(930, 600, 40, 15),
      label('sweet tooth era', 330, 1190, 380, 28, -3)
    ];
    const s4 = [
      bgB[2],
      rpol(520, 600, 440, 540, 3, { s: 20, t: 24, b: 92 }, IMG.feet,
        note('the end', 40, 456, 360, 56, { color: '#2b2722', font: "'Delicious Handrawn',cursive", rot: -1, z: 2 })),
      rpol(230, 300, 300, 360, -10, { s: 14, t: 18, b: 64 }, IMG.boat),
      rpol(830, 330, 290, 350, 9, { s: 14, t: 18, b: 62 }, IMG.shop),
      washi(430, 300, 190, -4, 'rgba(255,214,102,.85)'), washi(110, 150, 160, -34, 'rgba(255,190,212,.85)'), washi(760, 170, 160, 28, 'rgba(176,220,255,.85)'),
      note('thanks for<br>swiping', 130, 990, 760, 120, { font: "'Delicious Handrawn',cursive", rot: -3, extra: 'line-height:1;' + SHADOW }),
      underline(300, 1230, 420, '#fff', -2),
      pressed('cream', 880, 1100, 250, 8, 48), pressed('gerbera', 130, 1130, 200, -10, 49),
      birds(700, 960, 90, 48, 4)
    ];
    return ref(4, [s1.join(''), s2.join(''), s3.join(''), s4.join('')]);
  }
};

const CAFE: Def = {
  id: 'cafenotes', name: 'Café Notes', slides: 4, mood: 'Food photos, tickets, stamps, daisies', h: REAL_H,
  build() {
    cur = [];
    /* one photo behind slides 1-2, a second one torn in just before slide 3 and running to the end */
    const bgA = cross(0, 0, 2 * RW, (x, p) => fullPhoto(x, 0, 2 * RW, RH, p), IMG.bg);
    const bgB = cross(1, 900, 2 * RW + 124, (x, p) => rip(x, 0, 2 * RW + 124, RH, p, { edges: 'l', seed: 39, paper: 12, fringe: 24, wave: 20 }), IMG.pause);
    const daisy = bloom(0, 'daisy', 920, 330, 250, 12, 51);
    const s1 = [
      bgA[0],
      rip(230, 170, 600, 1040, IMG.pancake2, { edges: 'tblr', seed: 61, paper: 12, fringe: 22, wave: 10, rot: -2 }),
      washi(420, 140, 220, 3, 'rgba(255,214,102,.85)'),
      note('SLOW<br>MORNINGS', 40, 40, 960, 150, { font: "'Bodoni Moda',serif", align: 'left', extra: 'line-height:.95;letter-spacing:.03em;' + SHADOW }),
      ticket('TABLE FOR ONE', 610, 1040, 340, 112, 30, 6),
      washi(680, 1010, 150, -8, 'rgba(255,214,102,.85)'),
      daisy[0], pressed('daisyDry', 90, 1130, 270, -10, 52),
      heart(130, 640, 64, '#fff', -10), sparkle(900, 700, 52)
    ];
    const s2 = [
      bgA[1], bgB[0], daisy[1],
      rip(60, 190, 560, 770, IMG.petunia, { edges: 'tblr', seed: 62, paper: 12, fringe: 22, wave: 8, rot: -3 }),
      rip(300, 790, 660, 420, IMG.lake, { edges: 'tblr', seed: 66, paper: 12, fringe: 22, wave: 8, rot: 2 }),
      washi(380, 760, 210, 3, 'rgba(255,190,212,.85)'),
      rpol(790, 400, 320, 390, 7, { s: 15, t: 19, b: 70 }, IMG.girl),
      note('brunch, but<br>make it pretty', 50, 30, 700, 96, { font: "'Delicious Handrawn',cursive", align: 'left', rot: -3, extra: 'line-height:1;' + SHADOW }),
      stamp(60, 1070, 110, 150, -6),
      pressed('pink', 160, 700, 190, -8, 53), pressed('yellow', 900, 1150, 170, 14, 54),
      label('SAT · 11:40 AM', 430, 1230, 400, 26, 2)
    ];
    const s3 = [
      bgB[1],
      rpol(300, 330, 400, 490, -5, { s: 18, t: 22, b: 84 }, IMG.shop,
        note('first stop', 30, 414, 340, 52, { color: '#2b2722', font: "'Delicious Handrawn',cursive", rot: -1, z: 2 })),
      rpol(720, 790, 380, 460, 6, { s: 17, t: 21, b: 80 }, IMG.feet),
      ticket('ADMIT ONE', 90, 880, 300, 100, 32, -8),
      washi(210, 80, 190, -8, 'rgba(255,255,255,.7)', true), washi(640, 560, 180, 12, 'rgba(255,214,102,.85)'),
      pressed('hibiscus', 880, 150, 200, 10, 55), pressed('gerbera', 150, 1120, 220, -10, 56),
      sparkle(900, 560, 46)
    ];
    const s4 = [
      bgB[2],
      rip(60, 90, 520, 620, IMG.petunia, { edges: 'tblr', seed: 64, paper: 12, fringe: 22, wave: 8, rot: -4 }),
      rip(500, 520, 470, 560, IMG.girl, { edges: 'tblr', seed: 65, paper: 12, fringe: 22, wave: 8, rot: 5 }),
      washi(240, 60, 190, -6, 'rgba(255,214,102,.85)'),
      note('until the<br>next cup', 80, 960, 520, 110, { font: "'Delicious Handrawn',cursive", align: 'left', rot: -3, extra: 'line-height:1;' + SHADOW }),
      stamp(840, 1070, 100, 135, 8),
      pressed('daisy', 900, 140, 260, 10, 57), pressed('pink', 120, 760, 190, -12, 58),
      heart(640, 1160, 64, '#ff5b7e', 8)
    ];
    return ref(4, [s1.join(''), s2.join(''), s3.join(''), s4.join('')]);
  }
};

/* ---------- bits for the Palace Tour set ---------- */

/* thin white dashed squiggle ending in a small loop (slide 1 "outfit" pointer) */
const loopArrow = (x: number, y: number, w: number, h: number, rot = 0) =>
  `<svg class="doodle" viewBox="0 0 130 90" style="${box(x, y, w, h, rot)}" aria-hidden="true"><path d="M3 6 C34 -2 70 8 94 26 C108 38 102 60 82 58 C62 56 62 32 82 34" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="7 8"/></svg>`;

/* chunky dashed arrow that bends down and points back left (slide 3) */
const dashedArrow = (x: number, y: number, w: number, h: number) =>
  `<svg class="doodle" viewBox="0 0 100 300" style="${box(x, y, w, h)}" aria-hidden="true"><path d="M30 6 C-2 60 8 150 40 214 C52 238 52 262 40 284" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="20 26"/><path d="M60 258 L40 286 L12 270" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const heartOutline = (cx: number, cy: number, s: number, rot = 0) =>
  dsvg(cx, cy, s, '0 0 24 24', `<path d="M12 21 C3 14 2 9 2 7 A5 5 0 0 1 12 6 A5 5 0 0 1 22 7 C22 9 21 14 12 21Z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, rot, 'filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))');

function paperclip(x: number, y: number, w: number, h: number, rot = 0) {
  return `<svg class="doodle" viewBox="0 0 60 100" style="${box(x, y, w, h, rot)};z-index:7" aria-hidden="true"><path d="M20 70 L20 26 A12 12 0 0 1 44 26 L44 76 A18 18 0 0 1 8 76 L8 30" stroke="#cfd2d6" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 70 L20 26 A12 12 0 0 1 44 26 L44 76 A18 18 0 0 1 8 76 L8 30" stroke="#6d7279" stroke-width="1.6" fill="none" stroke-linecap="round" transform="translate(1.6 1.6)" opacity=".55"/></svg>`;
}

/* a blank postcard, 566 x 380: "POST CARD" header, address line, side imprint and a stamp box.
   It is wide enough to straddle a slide edge, so it is always placed with cross(). */
function postcard(x: number, y: number) {
  const w = 566, h = 380, red = '#d83a2c', f = `font-family="'Bricolage Grotesque',sans-serif" font-weight="800" fill="${red}"`, sx = 437;
  return `<div class="frame real postcard" style="${box(x, y, w, h, 0, 'z-index:4;background:linear-gradient(160deg,#f4f2ec,#e9e6de);box-shadow:0 8px 14px rgba(0,0,0,.3)')}">` +
    `<svg viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">` +
    `<text x="394" y="104" text-anchor="end" font-size="48" letter-spacing="2" ${f}>POST CARD</text>` +
    `<text x="250" y="40" font-size="13" ${f}>17V28</text><path d="M280 150 L280 330" stroke="${red}" stroke-width="3"/>` +
    `<text transform="translate(34 172) rotate(90)" font-size="10" letter-spacing="1" ${f}>17V28 POST OFFICE, 2023</text>` +
    `<rect x="${sx}" y="40" width="86" height="110" fill="none" stroke="${red}" stroke-width="3" stroke-dasharray="6 4"/><rect x="${sx + 8}" y="48" width="70" height="94" fill="none" stroke="${red}" stroke-width="1.6"/>` +
    ['PLACE', 'STAMP', 'HERE'].map((t, i) => `<text x="${sx + 43}" y="${92 + i * 14}" text-anchor="middle" font-size="11" ${f}>${t}</text>`).join('') +
    `</svg></div>`;
}

const SCRIPT = "'Over the Rainbow',cursive";

const PALACETOUR: Def = {
  id: 'palacetour', name: 'Palace Tour', slides: 7, mood: 'Travel carousel, torn strips, postcards', h: REAL_H,
  build() {
    cur = [];
    const T = (o: Partial<RipOpt> & { edges: string; seed: number }): RipOpt => ({ paper: 10, fringe: 20, wave: 10, ...o });

    /* everything that crosses a slide edge, left to right along the strip (slide numbers are 0-based) */
    const plaza = cross(1, 955, 2 * RW - 955 + 6, (x, p) => rip(x, 0, 2 * RW - 955 + 6, RH, p, T({ edges: 'l', seed: 94 })), IMG.lake);
    const mirror = cross(1, 894, 532, (x, p) => rip(x, 570, 532, 672, p, T({ edges: 'tblr', seed: 95, wave: 8 })), IMG.feet);
    const card = cross(1, 690, 566, (x) => postcard(x, 190));
    const outfit = cross(2, 888, 966, (x, p) => rip(x, 0, 966, RH, p, T({ edges: 'lr', seed: 71, paper: 8, fringe: 18, wave: 12 })), IMG.pause);
    const balcony = cross(2, 622, 570, (x, p) => rip(x, 36, 570, 372, p, T({ edges: 'tblr', seed: 96 })), IMG.palace);
    const city = cross(3, 790, 998, (x, p) => rip(x, 0, 998, RH, p, T({ edges: 'r', seed: 84, paper: 8, fringe: 18, wave: 16 })), IMG.town);
    const tower = cross(4, 740, 988, (x, p) => rip(x, 0, 988, RH, p, T({ edges: 'lr', seed: 78, paper: 8, fringe: 18 })), IMG.door);
    const dome = cross(4, 655, 561, (x, p) => rip(x, 0, 561, 296, p, T({ edges: 'blr', seed: 85, wave: 8 })), IMG.strip);
    const elephant = cross(4, 655, 615, (x, p) => rip(x, 900, 615, 380, p, T({ edges: 'tlr', seed: 86, wave: 8 })), IMG.boat);
    const sky = cross(5, 690, 904, (x, p) => fullPhoto(x, 0, 904, RH, p), IMG.girl);
    const valley = cross(5, 826, 404, (x, p) => rip(x, 0, 404, 372, p, T({ edges: 'blr', seed: 80, wave: 8 })), IMG.bags);

    /* 1 - mosaic: balcony and palace on the left, a girl by the trees on the right, small scraps between */
    const s1 = [
      fullPhoto(512, 0, 512, RH, IMG.girl),
      fullPhoto(0, 600, 512, 680, IMG.palace),
      rip(0, 0, 512, 636, IMG.petunia, T({ edges: 'b', seed: 89 })),
      rip(0, 0, 164, 208, IMG.strip, T({ edges: 'br', seed: 90, paper: 8, fringe: 16, wave: 6 })),
      rip(432, 410, 196, 130, IMG.town, T({ edges: 'tblr', seed: 91, paper: 6, fringe: 12, wave: 4 })),
      rip(330, 564, 246, 312, IMG.pancake, T({ edges: 'tblr', seed: 92, paper: 8, fringe: 14, wave: 6 })),
      rip(512, 1154, RW - 512, 126, IMG.bg, T({ edges: 't', seed: 93, fringe: 18, wave: 6 }))
    ];

    /* 2 - "City Palace": one interior photo; the plaza, the postcard and the mirror selfie of slide 3 start here */
    const s2 = [
      fullPhoto(0, 0, RW, RH, IMG.pause),
      plaza[0], card[0], mirror[0],
      note('City<br>Palace', 336, 352, 260, 82, { font: SCRIPT, rot: -2, color: 'rgba(255,255,255,.97)', extra: 'line-height:1.2;' })
    ];

    /* 3 - "Hey I'm in Udaipur": pigeon square, postcard, mirror selfie; the outfit photo and the balcony run into slide 4 */
    const s3 = [
      plaza[1], mirror[1], outfit[0], balcony[0], card[1],
      note('Hey<br>I’m in<br>Udaipur', 28, 346, 200, 40, { font: "'Figtree',sans-serif", color: '#16130f', align: 'left', extra: 'line-height:1.28;font-weight:500;', cls: 'plain', z: 5 }),
      pressed('daisy', 229, 186, 54, 0, 97),
      paperclip(586, 28, 120, 200, 4)
    ];

    /* 4 - outfit of the day; the city view behind it carries on as slide 5 */
    const s4 = [
      city[0], outfit[1], balcony[1],
      rip(526, 1040, 368, 240, IMG.lake, T({ edges: 'tlr', seed: 73, wave: 8 })),
      loopArrow(404, 684, 106, 74),
      note('Outfit of the day', 438, 728, 270, 46, { font: SCRIPT, rot: 3, color: 'rgba(255,255,255,.95)', extra: 'white-space:nowrap;' })
    ];

    /* 5 - "pretty view"; the palace tower, the dome scrap and the elephant scrap all carry on into slide 6 */
    const s5 = [
      city[1], tower[0], dome[0], elephant[0],
      note('Pretty view', 236, 388, 190, 36, { font: SCRIPT, color: 'rgba(255,255,255,.95)', extra: 'white-space:nowrap;' })
    ];

    /* 6 - the palace tower; the sky behind it and the valley scrap are slide 7's photos */
    const s6 = [
      sky[0], tower[1], dome[1], elephant[1], valley[0],
      rip(498, 786, 466, 494, IMG.shop, T({ edges: 'tlr', seed: 82, wave: 8 })),
      dashedArrow(796, 394, 100, 300),
      pressed('daisy', 143, 868, 104, 0, 83)
    ];

    /* 7 - portrait over the valley with four torn tiles on the right */
    const s7 = [
      sky[1],
      rip(560, 0, RW - 560, 650, IMG.bags, T({ edges: 'bl', seed: 74, wave: 14 })),
      rip(560, 648, RW - 560, RH - 648, IMG.palace, T({ edges: 'tl', seed: 75, wave: 14 })),
      rip(428, 286, 285, 362, IMG.shop, T({ edges: 'tblr', seed: 76, paper: 8, fringe: 16, wave: 6 })),
      valley[1],
      heartOutline(775, 138, 56, 4)
    ];

    return ref(7, [s1, s2, s3, s4, s5, s6, s7].map((s) => s.join('')));
  }
};

export const REAL_DEFS: Def[] = [MINITRIP, GOLDEN, WALL, CAFE, PALACETOUR];
