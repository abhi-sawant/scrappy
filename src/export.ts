import { domToBlob } from 'modern-screenshot';
import { $$ } from './dom';
import { SLIDE, slideH, type Template } from './templates';
import { buildBoard } from './board';

/* Real PNG export.
   Each slide is the artboard shifted left by i * 1080 inside a 1080-wide window, rendered to PNG.
   The renderer serializes the DOM into an SVG image, which cannot see the page's sprite sheet,
   so every <use> sticker is expanded to real paths (and the gradients it needs copied in) first. */

export const Exporter = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';

  function inlineSprites(root: HTMLElement) {
    $$<SVGSVGElement>('svg', root).forEach((svg) => {
      const use = svg.querySelector(':scope > use');
      if (!use) return;
      const sym = document.getElementById(use.getAttribute('href')!.slice(1));
      if (!sym) return;
      const vb = sym.getAttribute('viewBox'), par = sym.getAttribute('preserveAspectRatio');
      if (vb) svg.setAttribute('viewBox', vb);
      if (par) svg.setAttribute('preserveAspectRatio', par);
      use.remove();
      const body = sym.innerHTML;
      const need = [...new Set([...body.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]))];
      const defs = need.map((id) => document.getElementById(id)?.outerHTML || '').join('');
      svg.innerHTML = (defs ? `<defs>${defs}</defs>` : '') + body;
      svg.setAttribute('xmlns', SVGNS);
    });
  }

  async function imagesReady(root: HTMLElement) {
    await Promise.all($$<HTMLImageElement>('img', root).filter((i) => i.src).map((i) => i.decode().catch(() => {})));
  }

  async function renderSlice(tpl: Template, i: number): Promise<Blob> {
    const H = slideH(tpl);
    const host = document.createElement('div');
    host.className = 'export-host';
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${SLIDE}px;height:${H}px;overflow:hidden;pointer-events:none`;
    const board = buildBoard(tpl);
    board.style.transform = `translateX(${-i * SLIDE}px)`;
    // the editor's empty-slot "+" chip is UI, not artwork
    $$('.ph-add, .ring', board).forEach((n) => n.remove());
    inlineSprites(board);
    host.appendChild(board);
    document.body.appendChild(host);
    try {
      await document.fonts.ready;
      await imagesReady(board);
      const opts = { width: SLIDE, height: H, scale: 1, type: 'image/png', quality: 1, backgroundColor: '#ffffff' };
      let blob = await domToBlob(host, opts);
      // Safari paints the first foreignObject render blank until fonts and images have been touched once
      if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && i === 0) blob = await domToBlob(host, opts);
      return blob;
    } finally {
      host.remove();
    }
  }

  let token = 0;
  let files: File[] = [];

  /* renders every slide; onProgress(done, total). Returns File[] or null if superseded. */
  async function prepare(tpl: Template, onProgress: (done: number, total: number) => void) {
    const mine = ++token;
    files = [];
    const out: File[] = [];
    for (let i = 0; i < tpl.slides; i++) {
      onProgress(i, tpl.slides);
      const blob = await renderSlice(tpl, i);
      if (mine !== token) return null;
      out.push(new File([blob!], `scrappy-${tpl.id}-${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' }));
    }
    onProgress(tpl.slides, tpl.slides);
    files = out;
    return out;
  }

  const canShareFiles = () => !!(navigator.canShare && files.length && navigator.canShare({ files }));
  const preferShare = () => matchMedia('(pointer: coarse)').matches && canShareFiles();

  async function share(title: string) {
    await navigator.share({ files, title });
  }

  async function download() {
    for (const f of files) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 20000);
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  return { prepare, share, download, preferShare, get ready() { return files.length > 0; }, get files() { return files; }, cancel() { token++; } };
})();
