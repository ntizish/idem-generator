# Pigment

A small local generator for abstract oil-paint textures. Pick two to six colors, paint a new composition, and save a 3840 × 2400 PNG.

## Run

With Node.js installed:

```sh
npm start
```

Open http://127.0.0.1:5173. No installation, API keys, external assets, or network services are required. Stop the server with Ctrl+C.

## How it paints

The browser first creates a new abstract color composition from the palette and a random seed. Four passes of curved brushes then build the painting, from broad blending to small broken strokes. Each bristle carries its own pigment and picks up color from the wet surface as it moves. Its contact and paint load determine both the deposited color and the surface height. Dry tips leave gaps; loaded bristles cover and level earlier marks. Paint load varies across the composition, creating softer and thicker passages. Surface-normal lighting reveals those deposits without a separate texture overlay or stamped impasto shapes.

This is a reduced procedural brush model, not a full fluid solver. It is inspired by the idea of bristle-level pigment interaction in [Wetbrush](https://developer.nvidia.com/blog/worlds-first-real-time-3d-oil-painting-simulator/), but does not implement that research system. Rendering runs in a worker to keep the controls responsive. Each painting uses a fresh random seed, recorded in the downloaded filename.

Color changes apply to the next painting. The saved PNG is the full-resolution current canvas, without the frame or interface. Palettes and images stay in memory until you save an image. This is a procedural approximation of oil paint; it does not use an AI model or reproduce a source photograph.

`npm run check` checks JavaScript syntax.

`npm test` checks repeatability, composition variation, palette response, image dimensions, opacity, and tonal detail.

The image is painted directly at 3840 × 2400 (9.2 megapixels), not enlarged from a smaller render. Higher resolution takes longer to paint and uses more memory. Brush dimensions and surface lighting scale with resolution.

Each seed also chooses brush scale and proportions, stroke density and curvature, flow direction, wetness and pigment pickup, paint load, bristle spacing, composition size, and lighting. These stay within bounded ranges; brush counts compensate for brush area. The same colors and seed reproduce the same painting at the same resolution.
