# Pigment

A small local generator for abstract oil-paint textures. Pick two to six colors, paint a new composition, and save a 3840 × 2400 PNG.

## Run

With Node.js installed:

```sh
npm start
```

Open http://127.0.0.1:5173. No installation, API keys, external assets, or network services are required. Stop the server with Ctrl+C.

## Deploy

Production: https://idem-generator.vercel.app

`npm run build` copies the browser assets into `dist/`. Vercel uses `vercel.json` to build and serve that directory, with clean URLs for `/animate` and `/layered`.

To deploy the current workspace again with the Vercel CLI:

```sh
vercel deploy --prod
```

## How it paints

The browser first creates a new abstract color composition from the palette and a random seed. Four passes of curved brushes then build the painting, from broad blending to small broken strokes. Each bristle carries its own pigment and picks up color from the wet surface as it moves. Its contact and paint load determine both the deposited color and the surface height. Dry tips leave gaps; loaded bristles cover and level earlier marks. Paint load varies across the composition, creating softer and thicker passages. Surface-normal lighting reveals those deposits without a separate texture overlay or stamped impasto shapes.

This is a reduced procedural brush model, not a full fluid solver. It is inspired by the idea of bristle-level pigment interaction in [Wetbrush](https://developer.nvidia.com/blog/worlds-first-real-time-3d-oil-painting-simulator/), but does not implement that research system. Rendering runs in a worker to keep the controls responsive. Each painting uses a fresh random seed, recorded in the downloaded filename.

Color changes apply to the next painting. The saved PNG is the full-resolution current canvas, without the frame or interface. Palettes and images stay in memory until you save an image. This is a procedural approximation of oil paint; it does not use an AI model or reproduce a source photograph.

`npm run check` checks JavaScript syntax.

`npm test` checks repeatability, composition variation, palette response, image dimensions, opacity, and tonal detail.

The image is painted directly at 3840 × 2400 (9.2 megapixels), not enlarged from a smaller render. Higher resolution takes longer to paint and uses more memory. Brush dimensions and surface lighting scale with resolution.

Each seed also chooses brush scale and proportions, stroke density and curvature, flow direction, wetness and pigment pickup, paint load, bristle spacing, composition size, and lighting. These stay within bounded ranges; brush counts compensate for brush area. The same colors and seed reproduce the same painting at the same resolution.

The starter palettes use deep charcoal, wine reds, ochre, muted blue-green, and aged ivory. A subtle seeded finishing pass adds fine monochrome grain, uneven warm varnish, and sparse soft wear flecks while retaining the brush relief and palette. No source painting or scanned texture is used.

## Moving paintings

Open `/animate`, or choose **Moving** in the header. It generates textured variations using the same painter worker and progressively reveals each with moving, curved bristle masks. New pigment sources arrive in the background and replace the previous painting through brush contacts rather than full-frame fades. This is animated painting/repainting of generated textures, not a fluid simulation or deformation of a finished image.

Moving paintings use 1280 × 800 for playback; the Still page retains native 3840 × 2400 output. Pause/play, save the current frame as PNG, or record 12 seconds as WebM (MP4 on supported browsers). Hidden tabs pause playback and end any current recording. Reduced-motion preferences start the page paused. Everything runs locally.

## Living layers

Open `/layered`, or choose **Layered** in the header. This starts with a finished painting and continuously deposits small, curved bristle strokes on top. Colors are sampled from the original painting to preserve its composition. Existing marks remain; the animation never clears the canvas or generates replacement compositions. Pause/play, frame export, and video recording work as on the Moving page, at 1280 × 800.

The layered regression check runs 33 seconds of simulated playback and verifies that strokes accumulate without clearing or redrawing the base painting or launching another painting worker.
