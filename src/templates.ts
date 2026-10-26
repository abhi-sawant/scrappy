/* Scrappy templates.
   Every template is ONE panoramic artboard, N * 1080 wide and 1080 tall, authored in absolute px.
   The exporter later cuts it into N square slides, so anything that straddles x = 1080 * k is the seam. */

export const SLIDE = 1080;

export interface Sample { src: string; w: number; h: number }

export interface Template {
  id: string;
  name: string;
  slides: number;
  mood: string;
  /* slide height in px; slides are always SLIDE wide. Defaults to square. */
  h?: number;
  build(): string;
  photoCount: number;
  /* real photos shown in the gallery preview and by "Try sample photos", one per slot in DOM order */
  samples?: Sample[];
}

export const slideH = (t: Template) => t.h ?? SLIDE;

type Rng = () => number;

export const rng = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ---------- element helpers (return HTML strings) ---------- */
let _slot = 0;
export const resetSlots = () => { _slot = 0; };

export const box = (x: number, y: number, w: number, h: number, rot = 0, extra = '') =>
  `left:${x}px;top:${y}px;width:${w}px;height:${h}px;${rot ? `transform:rotate(${rot}deg);` : ''}${extra}`;

export const nextSlot = () => _slot++;

/* a copy of a photo that crosses a slide edge: it shares slot idx with the other copies; only the main copy shows the "+" chip */
export interface Link { idx: number; main: boolean }

/* a photo slot; clip is an optional clip-path polygon (torn paper) */
export function slotBox(x: number, y: number, w: number, h: number, clip = '', link?: Link) {
  const i = link ? link.idx : _slot++;
  const piece = link && !link.main ? ' data-piece' : '';
  return `<div class="sw" style="${box(x, y, w, h)}"><div class="slot" data-slot="${i}"${piece} style="${clip ? `clip-path:${clip};` : ''}">` +
    `<img class="photo" alt="" draggable="false" hidden>` +
    `<div class="ph"><svg class="ph-art" aria-hidden="true"><use href="#ph-art"/></svg><span class="ph-add" aria-hidden="true"><svg><use href="#i-plus"/></svg></span></div>` +
    `</div><i class="ring"></i></div>`;
}

export const hand = (text: string, x: number, y: number, w: number, size: number, rot = 0, color = '#fff', cls = '') =>
  `<div class="hand ${cls}" contenteditable="plaintext-only" spellcheck="false" data-default="${text.replace(/<br>/g, ' ').replace(/&lt;/g, '&lt;').replace(/"/g, '&quot;')}" ` +
  `style="left:${x}px;top:${y}px;width:${w}px;${rot ? `transform:rotate(${rot}deg);` : ''}font-size:${size}px;color:${color};">${text}</div>`;

const st = (name: string, x: number, y: number, w: number, rot = 0, vars: Record<string, string | number> = {}, h = w) => {
  const v = Object.entries(vars).map(([k, val]) => `--${k}:${val}`).join(';');
  return `<svg class="sticker" style="${box(x, y, w, h, rot)}${v ? ';' + v : ''}" aria-hidden="true"><use href="#st-${name}" width="100%" height="100%"/></svg>`;
};

const pol = (x: number, y: number, w: number, rot: number, cap = '', paper = '#fbfaf7') => {
  const pad = Math.round(w * 0.055), s = w - pad * 2, h = Math.round(w * 1.22);
  return `<div class="frame polaroid" style="${box(x, y, w, h, rot, `background:${paper}`)}">` +
    slotBox(pad, pad, s, s) +
    (cap ? hand(cap, pad, pad + s + w * 0.02, s, Math.round(w * 0.13), -1.5, '#3b3a46', 'cap') : '') +
    `</div>`;
};

const snap = (x: number, y: number, w: number, h: number, rot = 0, pad = 16, paper = '#fbfaf7') =>
  `<div class="frame snapshot" style="${box(x, y, w, h, rot, `background:${paper}`)}">${slotBox(pad, pad, w - pad * 2, h - pad * 2)}</div>`;

const flatPhoto = (x: number, y: number, w: number, h: number, rot = 0, radius = 0) =>
  `<div class="frame flat" style="${box(x, y, w, h, rot, `border-radius:${radius}px`)}">${slotBox(0, 0, w, h)}</div>`;

const HOLE_V = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='38'%3E%3Crect x='7' y='9' width='16' height='20' rx='5' fill='%23f1ede4'/%3E%3C/svg%3E\")";
const HOLE_H = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='38' height='30'%3E%3Crect x='9' y='7' width='20' height='16' rx='5' fill='%23f1ede4'/%3E%3C/svg%3E\")";

function film(x: number, y: number, n: number, cw: number, ch: number, dir: 'v' | 'h' = 'v', rot = 0, tint = '#101319') {
  const gap = 16, pad = 38;
  const w = dir === 'v' ? cw + pad * 2 : n * cw + (n + 1) * gap;
  const h = dir === 'v' ? n * ch + (n + 1) * gap : ch + pad * 2;
  let cells = '';
  for (let i = 0; i < n; i++) {
    cells += dir === 'v' ? slotBox(pad, gap + i * (ch + gap), cw, ch) : slotBox(gap + i * (cw + gap), pad, cw, ch);
  }
  const holes = dir === 'v'
    ? `<i class="holes" style="left:5px;top:0;width:30px;height:100%;background:${HOLE_V} repeat-y"></i><i class="holes" style="right:5px;top:0;width:30px;height:100%;background:${HOLE_V} repeat-y"></i>`
    : `<i class="holes" style="top:5px;left:0;height:30px;width:100%;background:${HOLE_H} repeat-x"></i><i class="holes" style="bottom:5px;left:0;height:30px;width:100%;background:${HOLE_H} repeat-x"></i>`;
  return `<div class="frame film" style="${box(x, y, w, h, rot, `background:${tint}`)}">${holes}${cells}</div>`;
}

function booth(x: number, y: number, n: number, cw: number, rot: number, label: string) {
  const pad = 26, gap = 16, ch = Math.round(cw * 0.86), foot = 92;
  const w = cw + pad * 2, h = pad + n * ch + (n - 1) * gap + foot;
  let cells = '';
  for (let i = 0; i < n; i++) cells += slotBox(pad, pad + i * (ch + gap), cw, ch);
  return `<div class="frame booth" style="${box(x, y, w, h, rot)}">${cells}${hand(label, pad, h - foot + 8, cw, 52, 0, '#ff4d8d', 'cap')}</div>`;
}

function tape(x: number, y: number, w: number, rot = 0, color = 'rgba(255,214,102,.82)', stripe = false) {
  const h = 62, z: string[] = [];
  for (let i = 0; i <= 8; i++) z.push(`${i % 2 ? 2.2 : 0}% ${(i / 8) * 100}%`);
  const zr: string[] = [];
  for (let i = 8; i >= 0; i--) zr.push(`${i % 2 ? 97.8 : 100}% ${(i / 8) * 100}%`);
  const bg = stripe
    ? `repeating-linear-gradient(90deg, ${color} 0 22px, rgba(255,255,255,.45) 22px 34px)`
    : color;
  return `<div class="tape" style="${box(x, y, w, h, rot, `background:${bg};clip-path:polygon(${z.join(',')},${zr.join(',')})`)}"></div>`;
}

/* torn paper photo: ragged white paper edge behind a ragged photo edge */
function torn(x: number, y: number, w: number, h: number, rot: number, edges: string, seed: number, paper = '#fbfaf6') {
  const r = rng(seed), step = 13;
  const poly = (inset: number, amp: number, freq: number) => {
    const j = (e: string, t: number) => (edges.includes(e) ? inset + Math.pow(r(), 1.6) * amp + Math.sin(t / freq + seed) * amp * 0.35 : 0);
    const P: [number, number][] = [];
    for (let px = 0; px <= w; px += step) P.push([px, j('t', px)]);
    for (let py = 0; py <= h; py += step) P.push([w - j('r', py), py]);
    for (let px = w; px >= 0; px -= step) P.push([px, h - j('b', px)]);
    for (let py = h; py >= 0; py -= step) P.push([j('l', py), py]);
    return 'polygon(' + P.map((p) => `${Math.max(0, p[0]).toFixed(1)}px ${Math.max(0, p[1]).toFixed(1)}px`).join(',') + ')';
  };
  const paperClip = poly(0, 16, 70);
  const photoClip = poly(22, 22, 55);
  return `<div class="frame torn" style="${box(x, y, w, h, rot)}">` +
    `<i class="paper" style="background:${paper};clip-path:${paperClip}"></i>` +
    slotBox(0, 0, w, h, photoClip) + `</div>`;
}

export const raw = (html: string) => html;

/* ---------- procedural backgrounds ---------- */
function ridge(r: Rng, W: number, base: number, amp: number, color: string, step = 20, sharp = 0.75, fill: string | null = null) {
  const p1 = r() * 9, p2 = r() * 9, a1 = 150 + r() * 130, a2 = 60 + r() * 50;
  let d = `M0 1080 L0 ${base}`;
  for (let x = 0; x <= W; x += step) {
    const s = Math.pow(Math.abs(Math.sin(x / a1 + p1)), sharp) * 0.62 + Math.abs(Math.sin(x / a2 + p2)) * 0.28 + r() * 0.1;
    d += ` L${x} ${(base - amp * s).toFixed(1)}`;
  }
  d += ` L${W} 1080 Z`;
  return `<path d="${d}" fill="${fill || color}"/>`;
}

function pines(r: Rng, W: number, base: number, size: number, colors: string[], density: number) {
  let s = '';
  for (let x = -20; x < W + 20; x += density * (0.6 + r() * 0.9)) {
    const h = size * (0.7 + r() * 0.6), w = h * 0.38, y = base + r() * 40;
    s += `<path d="M${x} ${y} l${-w} 0 l${w * 0.35} ${-h * 0.35} l${-w * 0.3} 0 l${w * 0.55} ${-h * 0.4} l${-w * 0.3} 0 l${w * 0.7} ${-h * 0.4} l${w * 0.7} ${h * 0.4} l${-w * 0.3} 0 l${w * 0.55} ${h * 0.4} l${-w * 0.3} 0 l${w * 0.35} ${h * 0.35} Z" fill="${colors[Math.floor(r() * colors.length)]}"/>`;
  }
  return s;
}

function blob(x: number, y: number, s: number, o = 1) {
  return `<g opacity="${o}" filter="url(#soft)"><ellipse cx="${x}" cy="${y}" rx="${s * 1.5}" ry="${s * 0.5}" fill="#fff"/><circle cx="${x - s * 0.5}" cy="${y - s * 0.3}" r="${s * 0.55}" fill="#fff"/><circle cx="${x + s * 0.3}" cy="${y - s * 0.45}" r="${s * 0.7}" fill="#fff"/></g>`;
}

export const GRAIN = `<i class="grain"></i>`;
const defsSoft = `<defs><filter id="soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="9"/></filter></defs>`;

function svgBg(W: number, inner: string) {
  return `<svg class="bgsvg" width="${W}" height="1080" viewBox="0 0 ${W} 1080" preserveAspectRatio="none" aria-hidden="true">${defsSoft}${inner}</svg>`;
}

/* ================= TEMPLATES ================= */
const DEFS: Omit<Template, 'photoCount'>[] = [
  /* 1 ---------------------------------------------------------- */
  {
    id: 'summit', name: 'Summit Daze', slides: 4, mood: 'Alpine blues, polaroids, a torn page',
    build() {
      const W = 4 * SLIDE, r = rng(7), p = [];
      let bg = `<defs><linearGradient id="sk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74b4e6"/><stop offset=".55" stop-color="#cbe6f7"/><stop offset="1" stop-color="#e6f3fb"/></linearGradient></defs><rect width="${W}" height="1080" fill="url(#sk1)"/>`;
      for (let i = 0; i < 9; i++) bg += blob(120 + i * 480 + r() * 140, 160 + r() * 330, 80 + r() * 60, 0.85);
      bg += `<defs><linearGradient id="snow" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="640"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#bdd0df"/><stop offset="1" stop-color="#8fa9bd"/></linearGradient></defs>`;
      bg += ridge(r, W, 720, 430, '', 18, 0.7, 'url(#snow)');
      bg += ridge(r, W, 850, 330, '#6f8da3', 18, 0.8);
      bg += ridge(r, W, 960, 220, '#365347', 22, 0.9);
      bg += pines(r, W, 1010, 210, ['#1d3a33', '#244840', '#173028'], 30);
      p.push(svgBg(W, bg));

      // slide 1
      p.push(pol(58, 96, 470, -6, 'ahhhh flowers'));
      p.push(tape(190, 70, 190, -8, 'rgba(255,214,102,.8)'));
      p.push(film(650, -70, 3, 250, 330, 'v', 3));
      p.push(st('star', 420, 250, 180, 12, { c1: '#ff4f93', c2: '#ffd1e6' }));
      p.push(st('burst', 585, 400, 120, 0));
      p.push(st('flower', 530, 40, 130, -10, { c1: '#ff6b2c', c2: '#ffd25e' }));
      p.push(st('flower', 640, 900, 120, 14, { c1: '#e0489a', c2: '#ffd25e' }));
      // seam 1: tall torn photo
      p.push(torn(985, 24, 590, 960, 0, 'lr', 11));
      // slide 2
      p.push(st('sun', 1600, 54, 200));
      p.push(hand('the last day<br>of my life', 1610, 330, 420, 90, -9, '#fff'));
      p.push(st('cat', 1400, 650, 250));
      p.push(st('cd', 1190, 740, 330, -8));
      p.push(st('bear', 1840, 730, 220, 6));
      p.push(st('heart', 1920, 560, 90, 14, { c1: '#ff4d7d' }));
      // seam 2: stacked snapshots
      p.push(snap(2025, 72, 430, 520, 3));
      p.push(snap(2250, 640, 430, 380, -3));
      p.push(st('plane', 2060, 760, 170, -14));
      p.push(st('sparkle', 1960, 620, 70, 0, { c1: '#fff' }));
      // slide 3 + seam 3
      p.push(flatPhoto(2775, 120, 760, 380, 0, 2));
      p.push(raw(`<svg class="doodle" style="${box(2745, 90, 40, 440)}"><rect x="6" y="2" width="6" height="436" rx="3" fill="#fff"/></svg>`));
      p.push(hand('mah girlsss&lt;3', 2975, 560, 460, 84, -6, '#fff'));
      p.push(st('squiggle', 2790, 700, 280, -4, { c1: '#fff' }, 100));
      p.push(st('sparkle', 3110, 20, 90, 0));
      p.push(st('star', 2670, 470, 110, -12, { c1: '#ffcf3d', c2: '#fff0a8' }));
      // slide 4
      p.push(pol(3510, 140, 400, -8, 'wow'));
      p.push(pol(3730, 520, 400, 5, ''));
      p.push(st('starfish', 3500, 790, 190, 15));
      p.push(st('plane', 3390, 330, 160, 8));
      p.push(torn(3960, 0, 360, 1080, 0, 'l', 29));
      p.push(st('plane', 3950, 880, 180, -10));
      p.push(GRAIN);
      return p.join('');
    }
  },

  /* 2 ---------------------------------------------------------- */
  {
    id: 'filmroll', name: 'Film Roll', slides: 6, mood: 'Teal water, film strips, glitter',
    build() {
      const W = 6 * SLIDE, r = rng(23), p = [];
      let bg = `<defs><linearGradient id="sk2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16342f"/><stop offset=".5" stop-color="#27554c"/><stop offset="1" stop-color="#1b4640"/></linearGradient>
        <radialGradient id="lg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9ee7d3" stop-opacity=".45"/><stop offset="1" stop-color="#9ee7d3" stop-opacity="0"/></radialGradient></defs>
        <rect width="${W}" height="1080" fill="url(#sk2)"/>`;
      for (let i = 0; i < 9; i++) bg += `<ellipse cx="${200 + i * 700 + r() * 200}" cy="${200 + r() * 700}" rx="${300 + r() * 200}" ry="${160 + r() * 120}" fill="url(#lg)"/>`;
      for (let i = 0; i < 260; i++) bg += `<circle cx="${r() * W}" cy="${r() * 1080}" r="${1 + r() * 3.2}" fill="#fff" opacity="${0.12 + r() * 0.5}"/>`;
      p.push(svgBg(W, bg));

      p.push(pol(70, 130, 430, -7, 'grateful'));
      p.push(film(560, 80, 4, 300, 350, 'h', -3));
      p.push(st('star', 360, 520, 160, -12, { c1: '#ffcf3d', c2: '#fff0a8' }));
      p.push(st('camera', 640, 560, 330, -6));
      p.push(hand('i love her', 90, 790, 480, 120, -6, '#ffe9f3'));
      p.push(st('sparkle', 1010, 470, 90));
      // seam 1 continues into slide 2
      p.push(pol(1880, 150, 420, 6, ''));
      p.push(st('star', 1740, 470, 150, 10, { c1: '#ff4f93', c2: '#ffd1e6' }));
      p.push(hand('you are art.', 1400, 760, 640, 100, -4, '#fff'));
      p.push(st('flower', 2140, 800, 140, 12, { c1: '#ff7aa8', c2: '#ffe36a' }));
      // slide 3: vertical strip + big torn
      p.push(film(2400, -70, 3, 300, 330, 'v', 4));
      p.push(torn(2870, 120, 600, 760, -2, 'tb', 41));
      p.push(st('sparkle', 2820, 60, 100));
      p.push(st('cherry', 2790, 820, 150, -8));
      // slide 4
      p.push(pol(3560, 130, 440, -5, 'golden hr'));
      p.push(st('cd', 4020, 160, 260, 12));
      p.push(hand('you are<br>the sky.', 3640, 740, 520, 110, -9, '#fff'));
      p.push(st('moon', 3500, 620, 120, -14));
      // seam 4 -> slide 5: strip crossing
      p.push(film(4140, 520, 4, 300, 330, 'h', 3));
      p.push(st('star', 4020, 440, 120, -6, { c1: '#ffcf3d', c2: '#fff0a8' }));
      p.push(hand('you are<br>everything', 4560, 190, 560, 100, 5, '#fff'));
      p.push(st('heart', 4510, 360, 110, -14, { c1: '#ff4d7d' }));
      // slide 6
      p.push(pol(5600, 150, 470, 4, ''));
      p.push(tape(5740, 118, 200, 6, 'rgba(255,170,205,.85)', true));
      p.push(torn(5850, 560, 560, 520, 0, 'l', 53));
      p.push(st('camera', 5430, 770, 260, 8));
      p.push(hand('thanks 4 the<br>memories', 5420, 520, 460, 90, -7, '#ffe9f3'));
      p.push(st('sparkle', 5360, 130, 110));
      p.push(GRAIN);
      return p.join('');
    }
  },

  /* 3 ---------------------------------------------------------- */
  {
    id: 'torn-sky', name: 'Torn Sky', slides: 3, mood: 'Open sky, big torn pages, paper planes',
    build() {
      const W = 3 * SLIDE, r = rng(5), p = [];
      let bg = `<defs><linearGradient id="sk3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb0ee"/><stop offset=".7" stop-color="#bfe3f9"/><stop offset="1" stop-color="#e5f5ff"/></linearGradient></defs><rect width="${W}" height="1080" fill="url(#sk3)"/>`;
      for (let i = 0; i < 8; i++) bg += blob(100 + i * 420 + r() * 120, 120 + r() * 520, 90 + r() * 70, 0.95);
      let hill = `M0 1080 L0 900`;
      for (let x = 0; x <= W; x += 30) hill += ` L${x} ${870 + Math.sin(x / 210) * 55 + Math.sin(x / 90) * 14}`;
      hill += ` L${W} 1080Z`;
      bg += `<path d="${hill}" fill="#b6d86a"/>`;
      let hill2 = `M0 1080 L0 960`;
      for (let x = 0; x <= W; x += 30) hill2 += ` L${x} ${960 + Math.sin(x / 260 + 2) * 50}`;
      hill2 += ` L${W} 1080Z`;
      bg += `<path d="${hill2}" fill="#82b22e"/>`;
      p.push(svgBg(W, bg));

      p.push(torn(60, 90, 740, 720, -2, 'rb', 61));
      p.push(tape(300, 60, 220, 4, 'rgba(255,214,102,.82)'));
      p.push(pol(560, 540, 400, 7, 'wish u were here'));
      p.push(st('plane', 120, 790, 190, -8));
      p.push(st('star', 760, 300, 170, 14, { c1: '#ff6f61', c2: '#ffd0c9' }));
      p.push(st('burst', 880, 250, 120, 0));
      // seam 1/2: tall torn page
      p.push(torn(1040, 0, 600, 800, 0, 'lrb', 71));
      p.push(hand('summer<br>nonsense', 1670, 120, 460, 110, -8, '#fff'));
      p.push(st('sun', 1760, 400, 170));
      p.push(st('cloud', 1090, 760, 250, 0, {}, 175));
      p.push(snap(1830, 560, 400, 420, 5));
      p.push(st('plane', 1550, 640, 190, 10));
      // seam 2/3
      p.push(pol(2180, 110, 440, -6, 'the best day'));
      p.push(st('flower', 2000, 470, 130, 10, { c1: '#ff7aa8', c2: '#ffe36a' }));
      p.push(torn(2500, 360, 740, 640, 2, 'tl', 83));
      p.push(st('starfish', 2900, 70, 170, -10));
      p.push(hand('xoxo', 2210, 690, 300, 120, -10, '#fff'));
      p.push(st('heart', 2420, 820, 100, -12, { c1: '#ff4d7d' }));
      p.push(GRAIN);
      return p.join('');
    }
  },

  /* 4 ---------------------------------------------------------- */
  {
    id: 'photobooth', name: 'Photo Booth', slides: 5, mood: 'Bubblegum pink, booth strips, chat bubbles',
    build() {
      const W = 5 * SLIDE, r = rng(13), p = [];
      let bg = `<defs><linearGradient id="sk4" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9cc6"/><stop offset=".5" stop-color="#f7a8e0"/><stop offset="1" stop-color="#b9a4ff"/></linearGradient></defs><rect width="${W}" height="1080" fill="url(#sk4)"/>`;
      for (let i = 0; i < 90; i++) bg += `<circle cx="${r() * W}" cy="${r() * 1080}" r="${3 + r() * 9}" fill="#fff" opacity="${0.12 + r() * 0.3}"/>`;
      for (let i = 0; i < 22; i++) {
        const x = r() * W, y = r() * 1080, s = 14 + r() * 26;
        bg += `<path d="M${x} ${y - s} Q${x + 3} ${y - 3} ${x + s} ${y} Q${x + 3} ${y + 3} ${x} ${y + s} Q${x - 3} ${y + 3} ${x - s} ${y} Q${x - 3} ${y - 3} ${x} ${y - s}Z" fill="#fff" opacity=".8"/>`;
      }
      p.push(svgBg(W, bg));

      p.push(booth(70, 60, 4, 280, -3, 'booth 4ever'));
      p.push(hand('i like ur hair', 470, 170, 520, 56, -3, '#fff', 'bubble bubble-l'));
      p.push(hand('gee thanks!', 590, 320, 420, 56, 2, '#fff', 'bubble bubble-r'));
      p.push(pol(430, 500, 400, 5, ''));
      p.push(st('cherry', 290, 760, 200, -6));
      p.push(st('heart', 800, 900, 120, 12, { c1: '#ff4d7d' }));
      // seam 1
      p.push(snap(930, 120, 520, 400, -4, 16, '#fff'));
      p.push(st('bubble', 1330, 80, 220, 8, {}, 176));
      p.push(tape(1050, 90, 180, -10, 'rgba(120,200,255,.8)', true));
      p.push(hand('so cute', 1115, 590, 380, 100, -7, '#fff'));
      p.push(st('star', 880, 700, 170, -8, { c1: '#ffcf3d', c2: '#fff0a8' }));
      p.push(st('sparkle', 1500, 660, 110));
      p.push(pol(1540, 270, 400, 6, ''));
      // slide 2/3
      p.push(booth(1950, 40, 4, 280, 4, 'say cheese'));
      p.push(st('cd', 1700, 760, 300, -10));
      p.push(snap(2330, 160, 400, 520, -5, 16, '#fff'));
      p.push(st('camera', 2380, 720, 280, 6));
      p.push(hand('mood: unbothered', 2590, 600, 520, 66, -5, '#fff', 'bubble bubble-l'));
      // slide 3 seam 3
      p.push(pol(2870, 90, 440, -4, 'us'));
      p.push(st('cherry', 3300, 210, 160, 10));
      p.push(snap(3150, 560, 520, 400, 3, 16, '#fff'));
      p.push(st('heart', 3010, 700, 130, -14, { c1: '#ff4d7d' }));
      p.push(st('sparkle', 3560, 420, 100));
      // slide 4/5
      p.push(booth(3780, 70, 3, 300, 3, 'best friends'));
      p.push(st('bear', 3800, 760, 230, -6));
      p.push(hand('wait come back', 4150, 160, 520, 60, 3, '#fff', 'bubble bubble-r'));
      p.push(snap(4120, 330, 520, 440, -3, 16, '#fff'));
      p.push(st('star', 4590, 220, 140, 12, { c1: '#ff4f93', c2: '#ffd1e6' }));
      p.push(hand('the end ♡', 4300, 830, 460, 110, -5, '#fff'));
      p.push(GRAIN);
      return p.join('');
    }
  },

  /* 5 ---------------------------------------------------------- */
  {
    id: 'afterdark', name: 'After Dark', slides: 8, mood: 'Night sky, a clothesline of polaroids',
    build() {
      const W = 8 * SLIDE, r = rng(31), p = [];
      let bg = `<defs><linearGradient id="sk5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1030"/><stop offset=".6" stop-color="#1c1f4d"/><stop offset="1" stop-color="#3a2a5c"/></linearGradient></defs><rect width="${W}" height="1080" fill="url(#sk5)"/>`;
      for (let i = 0; i < 380; i++) bg += `<circle cx="${r() * W}" cy="${r() * 1080}" r="${0.8 + r() * 2.6}" fill="#fff" opacity="${0.2 + r() * 0.7}"/>`;
      for (let i = 0; i < 30; i++) {
        const x = r() * W, y = r() * 900, s = 10 + r() * 22;
        bg += `<path d="M${x} ${y - s} Q${x + 2} ${y - 2} ${x + s} ${y} Q${x + 2} ${y + 2} ${x} ${y + s} Q${x - 2} ${y + 2} ${x - s} ${y} Q${x - 2} ${y - 2} ${x} ${y - s}Z" fill="#fff"/>`;
      }
      // the clothesline: one long sagging cord across every seam
      let line = `M-20 170`;
      for (let x = 0; x <= W + 20; x += 40) line += ` L${x} ${170 + Math.sin(x / 560) * 40 + 40 * Math.sin(x / 170)}`;
      bg += `<path d="${line}" stroke="#e8d9b0" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>`;
      p.push(svgBg(W, bg));

      p.push(st('moon', 40, 230, 280, -10));
      p.push(raw(`<div class="ransom" style="${box(70, 800, 700, 160, -4)}">` +
        ['a', 'f', 't', 'e', 'r', ' ', 'd', 'a', 'r', 'k'].map((c, i) => c === ' ' ? '<b class="sp"></b>' : `<b class="rl rl${i % 5}">${c}</b>`).join('') + `</div>`));
      // hung polaroids, each seam crossed by the cord
      const hang = [[330, -6], [880, 5], [1450, -4], [2040, 6], [2640, -5], [3220, 4], [3800, -6], [4400, 5], [5000, -4], [5620, 6], [6180, -5], [6760, 4], [7350, -6]];
      const caps = ['', 'cat tax', '', 'golden hr', '', 'ootd', '', 'late night', '', 'us', '', 'snacks', 'bye'];
      hang.forEach(([x, rot], i) => {
        const y = 200 + (i % 2) * 40;
        p.push(pol(x, y + 40, 380, rot, caps[i]));
        p.push(st('clip', x + 160, y + 6, 40, rot, {}, 100));
      });
      p.push(st('cat', 1130, 800, 220));
      p.push(snap(1500, 700, 480, 340, 3));
      p.push(hand('2am thoughts', 2100, 740, 600, 110, -5, '#ffe9a8'));
      p.push(st('star', 2680, 680, 150, 12, { c1: '#ffcf3d', c2: '#fff0a8' }));
      p.push(torn(3050, 640, 640, 360, -2, 'tb', 91));
      p.push(st('cd', 3780, 650, 300, -10));
      p.push(st('camera', 4170, 690, 260, 6));
      p.push(snap(4550, 640, 480, 360, -3));
      p.push(st('cat', 5120, 650, 220));
      p.push(hand('no thoughts<br>just vibes', 5400, 690, 640, 100, -6, '#fff'));
      p.push(st('sparkle', 6040, 760, 120));
      p.push(torn(6200, 640, 640, 360, 2, 'tb', 97));
      p.push(st('heart', 6880, 720, 140, 12, { c1: '#ff6fa1' }));
      p.push(hand('see u<br>tomorrow ✦', 7160, 680, 600, 110, -7, '#ffe9a8'));
      p.push(GRAIN);
      return p.join('');
    }
  }
];

/* count photo slots per template once */
export const TEMPLATES: Template[] = DEFS.map((t) => {
  resetSlots();
  return { ...t, photoCount: (t.build().match(/data-slot=/g) || []).length };
});

/* ---------- sample photos: drawn scenes so previews never look empty ---------- */
function scene(kind: number, seed: number) {
  const r = rng(seed);
  const W = 1200;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">`;
  const lg = (id: string, stops: [number, string][], x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const rd = (base: number, amp: number, color: string, sharp = 0.8, step = 30) => {
    const p1 = r() * 9, p2 = r() * 9, a1 = 170 + r() * 120, a2 = 70 + r() * 50;
    let d = `M0 ${W} L0 ${base}`;
    for (let x = 0; x <= W; x += step) d += ` L${x} ${(base - amp * (Math.pow(Math.abs(Math.sin(x / a1 + p1)), sharp) * 0.65 + Math.abs(Math.sin(x / a2 + p2)) * 0.25 + r() * 0.1)).toFixed(1)}`;
    return `<path d="${d} L${W} ${W}Z" fill="${color}"/>`;
  };
  const cloud = (x: number, y: number, k: number, o = 0.9) => `<g fill="#fff" opacity="${o}"><ellipse cx="${x}" cy="${y}" rx="${k * 1.6}" ry="${k * 0.5}"/><circle cx="${x - k * 0.5}" cy="${y - k * 0.3}" r="${k * 0.55}"/><circle cx="${x + k * 0.3}" cy="${y - k * 0.45}" r="${k * 0.7}"/></g>`;
  if (kind === 0) { // alpine
    s += `<defs>${lg('a', [[0, '#6cb0e8'], [1, '#e1f2fc']])}<linearGradient id="sn" gradientUnits="userSpaceOnUse" x1="0" y1="280" x2="0" y2="640"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#b9cddd"/><stop offset="1" stop-color="#87a2b8"/></linearGradient></defs><rect width="${W}" height="${W}" fill="url(#a)"/>`;
    s += cloud(260, 200, 90) + cloud(880, 330, 70, 0.8) + rd(780, 560, 'url(#sn)', 0.7) + rd(930, 380, '#5d7b91') + rd(1060, 240, '#2c4a44', 0.9);
  } else if (kind === 1) { // sunset
    s += `<defs>${lg('a', [[0, '#2b1b4f'], [0.4, '#a8407a'], [0.65, '#ff8f5e'], [0.85, '#ffd27a']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/>`;
    s += `<circle cx="600" cy="760" r="150" fill="#fff2c4" opacity=".95"/><circle cx="600" cy="760" r="260" fill="#ffd9a0" opacity=".25"/>`;
    s += rd(860, 200, '#2a1a3d') + `<rect y="900" width="${W}" height="300" fill="#4a2b5e"/>`;
    for (let i = 0; i < 18; i++) s += `<rect x="${r() * 900 + 100}" y="${920 + i * 14}" width="${80 + r() * 260}" height="5" rx="2.5" fill="#ffc98e" opacity="${0.15 + r() * 0.4}"/>`;
  } else if (kind === 2) { // meadow
    s += `<defs>${lg('a', [[0, '#86c8f2'], [1, '#eaf7ff']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/>` + cloud(300, 220, 100) + cloud(840, 150, 70, 0.8);
    s += `<ellipse cx="400" cy="900" rx="900" ry="360" fill="#8dc04a"/><ellipse cx="900" cy="1100" rx="900" ry="360" fill="#5f9b34"/>`;
    const cols = ['#ffffff', '#ffd1e6', '#ffe36a', '#ff7aa8'];
    for (let i = 0; i < 160; i++) { const y = 640 + r() * 560, k = 4 + (y - 640) / 40; s += `<circle cx="${r() * W}" cy="${y}" r="${k}" fill="${cols[Math.floor(r() * 4)]}"/>`; }
  } else if (kind === 3) { // forest mist
    s += `<defs>${lg('a', [[0, '#d5ebe7'], [1, '#79a9a3']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/>`;
    ([[560, 220, '#8db7b0'], [700, 300, '#5b8c86'], [880, 400, '#2d5c58'], [1060, 520, '#133a37']] as [number, number, string][]).forEach(([b, h, c], k) => {
      for (let x = -40; x < W + 40; x += (110 - k * 14) * (0.7 + r() * 0.6)) { const hh = h * (0.7 + r() * 0.5), w = hh * 0.36; s += `<path d="M${x} ${b + hh * 0.2} l${-w} 0 l${w * 0.4} ${-hh * 0.4} l${-w * 0.3} 0 l${w * 0.6} ${-hh * 0.6} l${w * 0.6} ${hh * 0.6} l${-w * 0.3} 0 l${w * 0.4} ${hh * 0.4}Z" fill="${c}"/>`; }
      s += `<rect y="${b - 60}" width="${W}" height="120" fill="#fff" opacity=".16"/>`;
    });
  } else if (kind === 4) { // dusk city
    s += `<defs>${lg('a', [[0, '#0d1230'], [0.6, '#3b2a6b'], [1, '#c46a8f']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/>`;
    for (let i = 0; i < 90; i++) s += `<circle cx="${r() * W}" cy="${r() * 600}" r="${1 + r() * 2.2}" fill="#fff" opacity="${0.3 + r() * 0.6}"/>`;
    s += `<circle cx="880" cy="250" r="80" fill="#ffeab0"/><circle cx="910" cy="232" r="72" fill="#3b2a6b" opacity=".0"/>`;
    for (let x = 0; x < W; x += 70) { const h = 220 + r() * 420; s += `<rect x="${x}" y="${W - h}" width="64" height="${h}" fill="#10122a"/>`; for (let k = 0; k < h / 44; k++) if (r() > 0.55) s += `<rect x="${x + 10 + (k % 2) * 28}" y="${W - h + 14 + k * 44}" width="12" height="16" fill="#ffd98a"/>`; }
  } else if (kind === 5) { // lake
    s += `<defs>${lg('a', [[0, '#ffd9c0'], [1, '#ffb59c']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/><circle cx="780" cy="420" r="110" fill="#fff4dc"/>`;
    const p1 = r() * 9; let top = '', bot = '';
    for (let x = 0; x <= W; x += 30) { const y = 640 - 300 * (Math.pow(Math.abs(Math.sin(x / 190 + p1)), 0.8) * 0.7 + r() * 0.1); top += ` L${x} ${y.toFixed(1)}`; bot += ` L${x} ${(1280 - y).toFixed(1)}`; }
    s += `<path d="M0 640${top} L${W} 640Z" fill="#6a6f9a"/><rect y="640" width="${W}" height="${W}" fill="#f3a590"/><path d="M0 640${bot} L${W} 640Z" fill="#8a8fb5" opacity=".75"/>`;
    for (let i = 0; i < 14; i++) s += `<rect x="${r() * 1000}" y="${660 + i * 38}" width="${100 + r() * 300}" height="4" rx="2" fill="#fff" opacity=".3"/>`;
  } else if (kind === 6) { // desert
    s += `<defs>${lg('a', [[0, '#ffe2a8'], [1, '#ffb47a']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/><circle cx="300" cy="360" r="120" fill="#fff6dc" opacity=".9"/>`;
    ([[700, '#e89a5c'], [860, '#c9703f'], [1020, '#9b4d2e']] as [number, string][]).forEach(([b, c], k) => { s += `<path d="M0 ${W} L0 ${b} C300 ${b - 160 + k * 40} 500 ${b + 40} 800 ${b - 110} S1100 ${b - 40} ${W} ${b - 90} L${W} ${W}Z" fill="${c}"/>`; });
  } else { // blossom
    s += `<defs>${lg('a', [[0, '#ffc9de'], [1, '#fff2f7']])}</defs><rect width="${W}" height="${W}" fill="url(#a)"/>`;
    s += `<path d="M-20 980 C260 820 420 760 640 560 S980 320 1240 240" stroke="#6b4a3a" stroke-width="26" fill="none" stroke-linecap="round"/>`;
    const cols = ['#ff9fc4', '#ffc2d9', '#ffffff', '#ff86b4'];
    for (let i = 0; i < 150; i++) { const t = r(), x = -20 + t * 1260, y = 980 - 740 * t + Math.sin(t * 6) * 70 + (r() - 0.5) * 360; s += `<circle cx="${x}" cy="${y}" r="${14 + r() * 28}" fill="${cols[Math.floor(r() * 4)]}" opacity=".92"/>`; }
  }
  return s + '</svg>';
}

const SAMPLE_COUNT = 8;
const _sampleCache: string[] = [];
export function samplePhoto(i: number) {
  const k = ((i % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
  if (!_sampleCache[k]) _sampleCache[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(scene(k, 100 + k * 17));
  return _sampleCache[k];
}
