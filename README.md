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

Open `/banner` for the grid-based banner workspace. Choose 1024 × 1024 or 1920 × 1080. Both use 44 px margins on all four sides and 24 px gutters. A single Grid switch shows or hides the complete set of 2-column, 2-row, 8-column, and 8-row guides. Text blocks span whole grid tracks; editing content never moves their grid anchors. Longer content wraps and scales within its assigned block. Explicit headline line breaks are preserved by scaling the title to fit.

The banner contains exactly three elements: a title in bundled Literatura Past, a descriptor in bundled ABC Areal Regular, and the supplied idem artwork. Only the six compositions in [the banner editor Figma reference](https://www.figma.com/design/hiE9FtigXJntQAlpE4BwBC/idem-%3E%3C-brand?node-id=2528-118) are available, in reference order: Inset, Monogram, Signature, Split, Editorial, and Corner. Square placements follow the reference grid spans. The 16:9 adaptations retain their column relationships, fit rows to the taller canvas, and scale typography and artwork by available height. Monogram uses the supplied 77 × 61 symbol; the other five use the 216 × 61 lockup. Both SVG assets are bundled locally and keep their proportions. Supporting copy uses 70% opacity. Light/dark ink selects white or ink artwork and text; dark artwork is tinted from the same SVG alpha masks. Exports wait for both brand fonts and artwork to load.

Six labeled thumbnails select the layout. Signature uses a larger headline in 16:9 while retaining its original square typography. Format, ink, background source, and fade direction use compact segmented controls. Grid visibility uses one switch. The sidebar has only two text fields and compact pigment/palette controls. Assets are served locally from `public/brand/` and `public/fonts/`.

Before a background is assigned, a dim checkerboard indicates transparency in the preview. It adjusts to the selected ink tone for legibility and is never painted into the canvas. PNG exports preserve transparency around the text and logo. Removing a painted background restores transparency. An enabled fade remains part of the exported artwork, including its alpha gradient.

The Solid background tab applies Ink, White, Ivory, Ochre, Burgundy, Rose, Blue, or Sage instantly. Its Transparent option clears the background and turns off fade for a fully transparent export around the artwork. Switching background tabs preserves the current artwork until another background is applied.

Generate a background from the same palettes and worker as Still, or upload an image and apply the same oil-paint effect as Upload. Backgrounds render with a 3840 px longest edge and are center-cropped to the banner without stretching. Switching banner sizes preserves the painted background. A Fade switch enables or removes a black gradient layer above the background and below the three elements. Four arrow segments select the opaque edge: left, top, right, or bottom. The gradient runs from alpha 1 at that edge to alpha 0 at the opposite edge. It is included in exports; it never darkens the foreground elements. All images remain local.

PNG export uses the selected banner dimensions, includes editable text as rendered, and always excludes the SVG grid overlay. `/layered` now opens Banner. The banner regression check covers the six reference compositions in both formats, exact square grid geometry, bundled fonts and both SVG assets, text fitting, logo proportions, directional fade pixels, cancellation, and guide-free PNG exports. Run `node scripts/check-banner.mjs --samples` to save branded export previews and labeled layout contact sheets in `/tmp`.
