/* Scrappy prototype: gallery -> editor -> export. */

import './fonts/fonts.css';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { $, $$ } from './dom';
import { SLIDE, slideH, samplePhoto, type Template } from './templates';
import { TEMPLATES } from './catalog';
import { Store } from './store';
import { Exporter } from './export';
import { state, byId, photosOf, textsOf, layoutPhoto, applyPhoto, buildBoard, syncTwins, type Key, type Photo, type Photos } from './board';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- gallery ---------- */
function samplesFor(tpl: Template, offset = 0) {
  const map: Photos = {};
  for (let i = 0; i < tpl.photoCount; i++) {
    const s = tpl.samples?.[i];
    map[i] = s ? { src: s.src, nw: s.w, nh: s.h, z: 1, x: 0, y: 0 } : { src: samplePhoto(i + offset), nw: 1200, nh: 1200, z: 1, x: 0, y: 0 };
  }
  return map;
}

function renderGallery() {
  const rails = $('#rails');
  rails.innerHTML = '';
  const H = innerWidth < 640 ? 190 : innerWidth < 1000 ? 230 : 270;
  TEMPLATES.forEach((tpl, ti) => {
    const k = H / slideH(tpl), W = SLIDE * k;   // one slide's width on screen
    const art = document.createElement('article');
    art.innerHTML = `<div class="tpl-head"><div><h2>${tpl.name}</h2><p>${tpl.slides} slides · ${tpl.photoCount} photos · ${tpl.mood}</p></div>` +
      `<button class="btn btn-primary" type="button">Use this template<svg class="i"><use href="#i-arrow"/></svg></button></div>`;
    const rail = document.createElement('div');
    rail.className = 'rail';
    rail.tabIndex = 0;
    rail.setAttribute('role', 'button');
    rail.setAttribute('aria-label', `Open ${tpl.name} template`);
    const inner = document.createElement('div');
    inner.className = 'rail-inner';
    inner.style.cssText = `width:${tpl.slides * W}px;height:${H}px`;
    const board = buildBoard(tpl, { photos: samplesFor(tpl, ti * 3), texts: {} });   // previews always show sample art
    board.style.transform = `scale(${k})`;
    inner.appendChild(board);
    for (let i = 0; i < tpl.slides; i++) {
      if (i) { const c = document.createElement('i'); c.className = 'cut'; c.style.left = i * W + 'px'; inner.appendChild(c); }
      const t = document.createElement('span'); t.className = 'cut-tag'; t.textContent = String(i + 1); t.style.left = i * W + 8 + 'px'; inner.appendChild(t);
    }
    rail.appendChild(inner);
    art.appendChild(rail);
    rails.appendChild(art);
    const open = () => { location.hash = '#edit/' + tpl.id; };
    rail.addEventListener('click', open);
    rail.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    $('.tpl-head .btn', art).addEventListener('click', open);
  });
}

/* ---------- screens / router ---------- */
function showScreen(name: string) {
  $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === 'screen-' + name));
  scrollTo(0, 0);
}

function route() {
  const h = location.hash.replace(/^#/, '');
  if (h.startsWith('edit/')) {
    const t = byId(h.slice(5));
    if (t) return openEditor(t);
  }
  if (h === 'export' && state.tpl!) return openExport();
  showScreen('gallery');
}

/* ---------- editor ---------- */
function openEditor(tpl: Template) {
  state.tpl = tpl; state.sel = null; state.slide = 0;
  $('#e-title').textContent = tpl.name;
  showScreen('edit');
  mountBoard();
  syncDock();
  $('#viewport').scrollLeft = 0;
}

function mountBoard() {
  const tpl = state.tpl!, wrap = $('#board-wrap');
  wrap.innerHTML = '';
  const pos = document.createElement('div');
  pos.className = 'board-pos';
  state.board = buildBoard(tpl, { editing: true });
  pos.appendChild(state.board!);
  wrap.appendChild(pos);
  state.pos = pos;
  for (let i = 0; i < tpl.slides; i++) { const s = document.createElement('i'); s.className = 'snapper'; wrap.appendChild(s); }
  const dots = $('#dots');
  dots.innerHTML = '';
  for (let i = 0; i < tpl.slides; i++) {
    const b = document.createElement('button');
    b.className = 'dot-btn'; b.type = 'button'; b.setAttribute('aria-label', `Go to slide ${i + 1}`);
    b.addEventListener('click', () => goTo(i));
    dots.appendChild(b);
  }
  layoutEditor();
}

function layoutEditor() {
  if (!state.tpl || !$('#screen-edit').classList.contains('is-active')) return;
  const vp = $('#viewport'), tpl = state.tpl;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const ratio = slideH(tpl) / SLIDE;
  const S = Math.max(160, Math.min(vw - 32, (vh - 28) / ratio, 700)), SH = S * ratio;
  state.S = S;
  $('.stage').style.setProperty('--S', S + 'px');
  $('.stage').style.setProperty('--SH', SH + 'px');
  const pad = (vw - S) / 2, k = S / SLIDE;
  $('#board-wrap').style.width = tpl.slides * S + pad * 2 + 'px';
  state.pos!.style.left = pad + 'px';
  state.pos!.style.top = (vh - SH) / 2 + 'px';
  state.pos!.style.width = tpl.slides * S + 'px'; state.pos!.style.height = SH + 'px';
  state.board!.style.transform = `scale(${k})`;
  $$('.snapper').forEach((s, i) => { s.style.left = pad + i * S + 'px'; s.style.width = S + 'px'; });
  vp.scrollLeft = state.slide * S;
  updateSlide();
}

function goTo(i: number) {
  i = Math.max(0, Math.min(state.tpl!.slides - 1, i));
  $('#viewport').scrollTo({ left: i * state.S, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function updateSlide() {
  const vp = $('#viewport');
  const i = Math.max(0, Math.min(state.tpl!.slides - 1, Math.round(vp.scrollLeft / state.S)));
  state.slide = i;
  $$('.dot-btn').forEach((b, n) => (n === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
  $('#slide-count').textContent = `Slide ${i + 1} of ${state.tpl!.slides}`;
  $<HTMLButtonElement>('#e-prev').disabled = i === 0;
  $<HTMLButtonElement>('#e-next').disabled = i === state.tpl!.slides - 1;
}

function syncDock() {
  const tpl = state.tpl!, photos = photosOf(tpl.id);
  const n = Object.keys(photos).length;
  $('#p-n').textContent = String(n); $('#p-total').textContent = String(tpl.photoCount);
  $('#p-fill').style.width = (n / tpl.photoCount) * 100 + '%';
  const sel = state.sel !== null && photos[state.sel];
  $('#dock-default').hidden = !!sel;
  $('#dock-sel').hidden = !sel;
  $('#e-samples').hidden = n > 0;
  $('#e-clear').hidden = n === 0 && !Object.keys(textsOf(tpl.id)).length;
  if (sel) $<HTMLInputElement>('#zoom').value = String(photos[state.sel!].z);
  $$('.sw', state.board!).forEach((sw) => sw.classList.toggle('is-sel', String($('.slot', sw).dataset.slot) === String(state.sel)));
}

function select(idx: Key | null) { state.sel = idx; syncDock(); }

function slotEl(idx: Key) { return $(`.slot[data-slot="${idx}"]`, state.board!); }

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

/* phone photos are 12MP+; keep editing and export light by capping the long side */
async function prepareFile(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const long = Math.max(bmp.width, bmp.height), MAX = 2400;
    if (long <= MAX && file.size < 4e6) { bmp.close(); return file; }
    const k = Math.min(1, MAX / long);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.9));
  } catch { return file; }
}

/* source: a File/Blob picked by the user, or a data: URI string (sample art) */
async function setPhoto(idx: Key, source: Blob | string) {
  const blob = typeof source === 'string' ? null : await prepareFile(source);
  const src = blob ? URL.createObjectURL(blob) : (source as string);
  const im = await loadImage(src);
  photosOf(state.tpl!.id)[idx] = { src, blob, nw: im.naturalWidth || 1200, nh: im.naturalHeight || 1200, z: 1, x: 0, y: 0 };
  applyPhoto(slotEl(idx), photosOf(state.tpl!.id)[idx]);
  syncDock();
  persist();
}

function persist() {
  const id = state.tpl!.id;
  Store.save(id, () => ({
    photos: Object.fromEntries(Object.entries(photosOf(id)).map(([k, p]) => [k, { src: p.blob ? null : p.src, blob: p.blob || null, nw: p.nw, nh: p.nh, z: p.z, x: p.x, y: p.y }])),
    texts: textsOf(id)
  }));
}

async function restoreAll() {
  await Promise.all(TEMPLATES.map(async (t) => {
    const saved = await Store.get(t.id);
    if (!saved) return;
    // sample photos are build assets whose URLs change between builds, so only the user's own photos are restored;
    // a template that was redesigned with fewer slots drops the photos of slots it no longer has
    state.photos[t.id] = Object.fromEntries(Object.entries(saved.photos || {}).filter(([k, p]) => +k < t.photoCount && (p.blob || p.src?.startsWith('data:'))).map(([k, p]) => [k, { ...p, src: p.blob ? URL.createObjectURL(p.blob) : p.src! }]));
    state.texts[t.id] = saved.texts || {};
  }));
}

async function fillEmpty(files: Iterable<File>) {
  const photos = photosOf(state.tpl!.id);
  const empty: number[] = [];
  for (let i = 0; i < state.tpl!.photoCount; i++) if (!photos[i]) empty.push(i);
  const list = [...files].slice(0, empty.length);
  await Promise.all(list.map((f, n) => setPhoto(empty[n], f)));
}

/* canvas interactions */
function wireEditor() {
  const vp = $('#viewport');
  vp.addEventListener('scroll', () => requestAnimationFrame(updateSlide), { passive: true });
  vp.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest<HTMLElement>('.hand')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(state.slide + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(state.slide - 1); }
  });
  $('#e-prev').addEventListener('click', () => goTo(state.slide - 1));
  $('#e-next').addEventListener('click', () => goTo(state.slide + 1));

  // click: empty slot opens picker, filled slot selects, anything else clears the selection
  vp.addEventListener('click', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (!slot) { if (!(e.target as HTMLElement).closest<HTMLElement>('.hand') && state.sel !== null) select(null); return; }
    const idx = slot.dataset.slot!, photos = photosOf(state.tpl!.id);
    if (!photos[idx]) { state.pickIdx = idx; $('#file-one').click(); return; }
    if (String(state.sel) !== String(idx)) select(idx);
  });

  // pan the selected photo
  let drag: { slot: HTMLElement; ph: Photo; x: number; y: number; w: number; h: number } | null = null;
  vp.addEventListener('pointerdown', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (!slot || String(state.sel) !== slot.dataset.slot!) return;
    const ph = photosOf(state.tpl!.id)[slot.dataset.slot!];
    if (!ph) return;
    drag = { slot, ph, x: e.clientX, y: e.clientY, w: slot.getBoundingClientRect().width, h: slot.getBoundingClientRect().height };
    slot.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.ph.x += (e.clientX - drag.x) / drag.w; drag.ph.y += (e.clientY - drag.y) / drag.h;
    drag.x = e.clientX; drag.y = e.clientY;
    layoutPhoto(drag.slot, drag.ph);
  });
  const end = () => { if (drag) persist(); drag = null; };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('wheel', (e) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (!slot || String(state.sel) !== slot.dataset.slot!) return;
    e.preventDefault();
    const ph = photosOf(state.tpl!.id)[slot.dataset.slot!];
    ph.z = Math.max(1, Math.min(3, ph.z - e.deltaY * 0.0025));
    layoutPhoto(slot, ph); $<HTMLInputElement>('#zoom').value = String(ph.z); persist();
  }, { passive: false });

  // handwriting persists into state
  vp.addEventListener('input', (e) => {
    const h = (e.target as HTMLElement).closest<HTMLElement>('.hand');
    if (h) { textsOf(state.tpl!.id)[h.dataset.h!] = h.innerText.replace(/\n$/, ''); syncTwins(h); persist(); }
  });
  vp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { (document.activeElement as HTMLElement | null)?.blur(); select(null); } });

  // dock
  $('#zoom').addEventListener('input', (e) => {
    const ph = photosOf(state.tpl!.id)[state.sel!];
    if (!ph) return;
    ph.z = parseFloat((e.target as HTMLInputElement).value);
    layoutPhoto(slotEl(state.sel!), ph);
    persist();
  });
  $('#s-done').addEventListener('click', () => select(null));
  $('#s-remove').addEventListener('click', () => {
    delete photosOf(state.tpl!.id)[state.sel!];
    applyPhoto(slotEl(state.sel!), null);
    select(null);
    persist();
  });
  $('#s-swap').addEventListener('click', () => { state.pickIdx = state.sel; $('#file-one').click(); });
  $('#e-add').addEventListener('click', () => $('#file-multi').click());
  $<HTMLInputElement>('#file-multi').addEventListener('change', async (e) => { const el = e.target as HTMLInputElement; await fillEmpty(el.files!); el.value = ''; });
  $<HTMLInputElement>('#file-one').addEventListener('change', async (e) => {
    const el = e.target as HTMLInputElement, f = el.files![0];
    if (f && state.pickIdx !== null) { await setPhoto(state.pickIdx, f); select(state.pickIdx); }
    el.value = '';
  });
  $('#e-samples').addEventListener('click', async () => {
    const photos = photosOf(state.tpl!.id);
    for (let i = 0; i < state.tpl!.photoCount; i++) if (!photos[i]) await setPhoto(i, state.tpl!.samples?.[i]?.src ?? samplePhoto(i + 1));
  });
  $('#e-clear').addEventListener('click', () => {
    if (!confirm('Remove all photos and reset the handwriting for this template?')) return;
    const id = state.tpl!.id;
    state.photos[id] = {}; state.texts[id] = {};
    Store.clear(id);
    select(null);
    mountBoard();
    syncDock();
  });
  $('#e-back').addEventListener('click', () => { location.hash = ''; });
  $('#e-export').addEventListener('click', () => { location.hash = '#export'; });
  $('#x-back').addEventListener('click', () => { location.hash = '#edit/' + state.tpl!.id; });
}

/* ---------- export ---------- */
let sliceRO: ResizeObserver | null = null;

function openExport() {
  const tpl = state.tpl!;
  showScreen('export');
  $('#x-count').textContent = String(tpl.slides);
  $('#x-dim').textContent = `${SLIDE} × ${slideH(tpl)}`;
  $('#x-last').textContent = String(tpl.slides);
  $('#x-save-label').textContent = `Save all ${tpl.slides}`;
  startRender(tpl);
  const empties = tpl.photoCount - Object.keys(photosOf(tpl.id)).length;
  const warn = $('#x-warn');
  warn.hidden = empties === 0;
  if (empties) warn.textContent = `${empties} photo ${empties === 1 ? 'frame is' : 'frames are'} still empty and will export as blank sky. Go back to fill ${empties === 1 ? 'it' : 'them'}.`;

  const list = $('#slices');
  list.innerHTML = '';
  if (sliceRO) sliceRO.disconnect();
  sliceRO = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => {
      const k = target.clientWidth / SLIDE, b = target.firstElementChild as HTMLElement;
      b.style.transform = `scale(${k}) translateX(${-Number((target as HTMLElement).dataset.i) * SLIDE}px)`;
    });
  });
  for (let i = 0; i < tpl.slides; i++) {
    const li = document.createElement('li');
    li.className = 'slice'; li.dataset.i = String(i);
    li.style.aspectRatio = `${SLIDE} / ${slideH(tpl)}`;
    li.appendChild(buildBoard(tpl));
    const n = document.createElement('span'); n.className = 'slice-n'; n.textContent = String(i + 1);
    li.appendChild(n);
    list.appendChild(li);
    sliceRO.observe(li);
  }
  setSeg(true);
}

function setSeg(joined: boolean) {
  $('#slices').classList.toggle('is-joined', joined);
  $('#slices').classList.toggle('is-split', !joined);
  $('#seg-joined').classList.toggle('is-on', joined); $('#seg-split').classList.toggle('is-on', !joined);
  $('#seg-joined').setAttribute('aria-checked', String(joined)); $('#seg-split').setAttribute('aria-checked', String(!joined));
}

function startRender(tpl: Template) {
  const save = $<HTMLButtonElement>('#x-save'), dl = $('#x-download'), bar = $('#x-progress'), fill = $('i', bar);
  save.disabled = true; dl.hidden = true; bar.hidden = false; fill.style.width = '0';
  $('#x-save-label').textContent = Exporter.preferShare() ? `Share all ${tpl.slides}` : `Save all ${tpl.slides}`;
  $('#x-status').textContent = 'Rendering slide 1…';
  Exporter.prepare(tpl, (done, total) => {
    fill.style.width = (done / total) * 100 + '%';
    $('#x-status').textContent = done < total ? `Rendering slide ${done + 1} of ${total}…` : '';
  }).then((files) => {
    if (!files) return;
    bar.hidden = true;
    const share = Exporter.preferShare();
    save.disabled = false;
    $('#x-save-label').textContent = share ? `Share all ${tpl.slides}` : `Save all ${tpl.slides}`;
    dl.hidden = !share;
    $('#x-status').textContent = `${tpl.slides} images ready · ${SLIDE} × ${slideH(tpl)} PNG`;
  }).catch((err) => {
    console.error(err);
    bar.hidden = true;
    $('#x-status').textContent = 'Could not render the images. Try again.';
    save.disabled = false;
    $('#x-save-label').textContent = 'Try again';
    save.dataset.retry = '1';
  });
}

function wireExport() {
  $('#seg-joined').addEventListener('click', () => setSeg(true));
  $('#seg-split').addEventListener('click', () => setSeg(false));
  $('#x-save').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('#x-save');
    if (btn.dataset.retry) { delete btn.dataset.retry; return startRender(state.tpl!); }
    if (!Exporter.ready) return;
    try {
      if (Exporter.preferShare()) { await Exporter.share(state.tpl!.name); $('#x-status').textContent = 'Shared. Post them in order.'; }
      else { await Exporter.download(); $('#x-status').textContent = `Saved ${state.tpl!.slides} images. Post them in order.`; }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      await Exporter.download();
      $('#x-status').textContent = `Saved ${state.tpl!.slides} images. Post them in order.`;
    }
  });
  $('#x-download').addEventListener('click', async () => { await Exporter.download(); $('#x-status').textContent = `Saved ${state.tpl!.slides} images. Post them in order.`; });
}

/* ---------- boot ---------- */
let lastBucket: number | null = null;
const bucket = () => (innerWidth < 640 ? 0 : innerWidth < 1000 ? 1 : 2);
addEventListener('resize', () => {
  layoutEditor();
  if (bucket() !== lastBucket && $('#screen-gallery').classList.contains('is-active')) { lastBucket = bucket(); renderGallery(); }
});
addEventListener('hashchange', () => { if (location.hash !== '#export') Exporter.cancel(); route(); });
wireEditor(); wireExport();
restoreAll().then(() => { renderGallery(); lastBucket = bucket(); route(); });
registerSW({ immediate: true });
