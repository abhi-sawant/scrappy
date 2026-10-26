# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Vanilla HTML/CSS/JS, no build step. Installable PWA: web manifest, network-first service worker, self-hosted fonts, IndexedDB for saved work, modern-screenshot (vendored) for PNG export. Deploy target undecided; any static host with HTTPS works.

## Users
Everyday Instagrammers (teens and 20-somethings) making scrapbook-style photo-dump carousels, mostly on a phone, quickly and casually.

## Product Purpose
Let someone pick a ready-made, fancy aesthetic carousel template, drop their photos into its frames, and export a set of 1:1 images ready to post as an Instagram carousel. Success: a finished, good-looking carousel in a couple of minutes with no design skill.

## Positioning
Templates are designed as one continuous panorama (torn paper, polaroids, stickers, handwritten notes) that runs seamlessly across the slide edges, so swiping the exported 1:1 images reads as one connected collage. Generic grid-collage makers do not do this.

## Operating Context
Edit flow: choose template, fill photo slots (pan/zoom each photo inside its frame), edit handwritten captions, export. Output is N separate 1:1 images (square slides), uploaded to Instagram afterwards. Mobile-first, installable PWA later.

## Capabilities and Constraints
- Slide count is fixed per template, between 3 and 10; varies by template.
- Users can add photos, pan/zoom within a slot, and edit handwritten text. Stickers, paper, and frames are fixed.
- Export: multiple PNG images, 1080 wide. Illustrated templates are 1:1 (1080 x 1080); the real-photo collage templates are 4:5 portrait (1080 x 1350), set per template with `h`.
- First deliverable: static prototype with 5 templates showing how it looks and works; real PWA later.

## Template Styles
- Illustrated (Summit Daze, Film Roll, Torn Sky, Photo Booth, After Dark): cartoon stickers on drawn backgrounds.
- Real-photo collage (Mini-trip Rewind, Golden Hour, Polaroid Wall, Café Notes): full-bleed photographs are the background; torn paper edges, polaroids, washi tape, pressed flowers and thin hand-drawn doodles sit on top. No cartoon outlines, no drawn backdrop. Mini-trip Rewind is a measured copy of the user's reference carousel layout. Sample photos are drawn placeholder artwork, never real people's photos.

## Brand Commitments
Scrapbook / journal collage aesthetic as in the user's reference images (torn paper edges, polaroids, film strips, hand-drawn stickers, handwritten script, panoramic continuity across slides). Reference: sky-and-mountain photo placeholders with Windows-XP-style green hill/blue sky empty-state slots.

## Evidence on Hand
Reference image and two Pinterest-sourced videos in ~/Downloads (Klickpin). No logo or product name yet. No real stickers or paper assets; all prototype artwork is authored synthetically.

## Product Principles
- The template does the design; the user brings photos.
- Seamless across slides is the signature: the strip is one artwork, then sliced.
- Fast on a phone: few taps from template to export.
- What you see in the editor is exactly what exports.

## Accessibility & Inclusion
Touch targets of at least 44px; works without hover; respects reduced motion.
