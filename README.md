# Pigment

A small local generator for abstract oil-paint textures. Pick two to six colors, paint a new composition, and save a 3840 × 2400 PNG.

## Run

With Node.js installed:

```sh
npm install
npm start
```

Open http://127.0.0.1:5173. Install the dependencies once. The app runs locally without API keys or external image services. Stop the server with Ctrl+C.

## Deploy

Production: https://idem-generator.vercel.app

`npm run build` bundles the React application with Vite into `dist/`. Vercel uses `vercel.json` to serve the app and support direct navigation to `/upload` and `/banner`.

To deploy the current workspace again with the Vercel CLI:

```sh
vercel deploy --prod
```

## Interface

The interface uses React, Vite, Tailwind CSS, and [shadcn/ui](https://ui.shadcn.com/docs/installation/vite). Official component source is in `src/components/ui/`: Button, Input, Label, Tabs, Separator, Textarea, Switch, and Toggle Group. `components.json` configures JavaScript components and the `@/` import alias. To add components, run `npx shadcn@latest add <component>`.

The app defaults to dark mode using shared CSS theme tokens in `src/index.css`. `src/app.jsx` owns the workspace and palette state. The canvas controllers in `src/engines/` handle Still and Upload rendering and exports. Banner state and composition live in `src/components/banner-workspace.jsx`; grid geometry and export drawing are shared in `src/lib/banner-layout.js`. The unchanged paint worker is served from `public/painter.js`.

## How it paints

The browser first creates a new abstract color composition from the palette and a random seed. Four passes of curved brushes then build the painting, from broad blending to small broken strokes. Each bristle carries its own pigment and picks up color from the wet surface as it moves. Its contact and paint load determine both the deposited color and the surface height. Dry tips leave gaps; loaded bristles cover and level earlier marks. Paint load varies across the composition, creating softer and thicker passages. Surface-normal lighting reveals those deposits without a separate texture overlay or stamped impasto shapes.

This is a reduced procedural brush model, not a full fluid solver. It is inspired by the idea of bristle-level pigment interaction in [Wetbrush](https://developer.nvidia.com/blog/worlds-first-real-time-3d-oil-painting-simulator/), but does not implement that research system. Rendering runs in a worker to keep the controls responsive. Each painting uses a fresh random seed, recorded in the downloaded filename.

Color changes apply to the next painting. The saved PNG is the full-resolution current canvas, without the frame or interface. Palettes and images stay in memory until you save an image. This is a procedural approximation of oil paint; it does not use an AI model. The Upload page uses the same brushes to repaint a source image.

`npm run check` checks JavaScript syntax.

`npm test` checks repeatability, composition variation, palette response, image dimensions, opacity, and tonal detail.

The image is painted directly at 3840 × 2400 (9.2 megapixels), not enlarged from a smaller render. Higher resolution takes longer to paint and uses more memory. Brush dimensions and surface lighting scale with resolution.

Each seed also chooses brush scale and proportions, stroke density and curvature, flow direction, wetness and pigment pickup, paint load, bristle spacing, composition size, and lighting. These stay within bounded ranges; brush counts compensate for brush area. The same colors and seed reproduce the same painting at the same resolution.

The starter palettes use deep charcoal, wine reds, ochre, muted blue-green, and aged ivory. A subtle seeded finishing pass adds fine monochrome grain, uneven warm varnish, and sparse soft wear flecks while retaining the brush relief and palette. No source painting or scanned texture is used.

## Image studies

Open `/upload`, or choose **Upload** in the header. Choose or drop a JPG, PNG, or WebP image up to 20 MB, then select **Paint this image**. The same local painter samples pigment from the image instead of generating an abstract color field. The original brush sizes, density, and bristle behavior add paint relief, lighting, and the studio’s aged finish while taking colors from the source composition. Paint again for another seeded variation, or save the result as PNG.

Images keep their proportions and always render with a 3840-pixel longest edge, matching the Still canvas’s long edge. Smaller sources are enlarged before painting, so brushwork and the final PNG are produced at full export resolution. Transparent areas use an ivory ground. Images are decoded and painted in the browser and are never sent to a server.

## Banner constructor

Open `/banner` for the grid-based banner workspace. Choose 1024 × 1024 or 1920 × 1080. Both use 44 px margins on all four sides and 24 px gutters with independently toggleable 2-column, 2-row, 8-column, and 8-row guides. Text blocks span whole grid tracks; editing content never moves their grid anchors. Longer content wraps and scales within its assigned block.

The banner contains exactly three elements: a title in the bundled Literatura Past face, a descriptor in bundled ABC Areal Medium, and the supplied full idem logo. Four compositions—Split, Editorial, Stack, and Offset—have separate grid placements for square and landscape formats. All elements stay inside whole grid spans; the logo keeps its original 958:284 proportions. Light/dark ink selects the matching logo artwork and text color. Exports wait for both brand fonts and logos to load.

Format, layout, ink, background source, grid layers, and fade direction use compact segmented controls. The sidebar has only two text fields and compact pigment/palette controls. Assets are served locally from `public/brand/` and `public/fonts/`.

Generate a background from the same palettes and worker as Still, or upload an image and apply the same oil-paint effect as Upload. Backgrounds render with a 3840 px longest edge and are center-cropped to the banner without stretching. Switching banner sizes preserves the painted background. A Fade switch enables or removes a black gradient layer above the background and below the three elements. Four arrow segments select the opaque edge: left, top, right, or bottom. The gradient runs from alpha 1 at that edge to alpha 0 at the opposite edge. It is included in exports; it never darkens the foreground elements. All images remain local.

PNG export uses the selected banner dimensions, includes editable text as rendered, and always excludes the SVG grid overlay. `/layered` now opens Banner. The banner regression check covers exact grid geometry, all eight layouts, bundled fonts and both logos, text fitting, logo proportions, directional fade pixels, cancellation, and guide-free PNG exports. Run `node scripts/check-banner.mjs --samples` to save branded export previews and layout contact sheets in `/tmp`.
