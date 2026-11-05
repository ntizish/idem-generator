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

## Generate banners from an agent (MCP)

Connect an agent that supports remote MCP / Streamable HTTP to:

```text
https://idem-generator.vercel.app/api/mcp
```

Select **No authentication / None** when adding this public endpoint. It does not provide an OAuth sign-in or client-registration flow. If a client reports that dynamic client registration or Client ID Metadata Documents are missing, it is trying an OAuth connection; recreate the connection without authentication. Clients that require OAuth for every connection need a separate OAuth authorization integration before they can use this server. OAuth discovery paths return 404 rather than the website HTML.

For clients with an `mcpServers` JSON configuration:

```json
{
  "mcpServers": {
    "idem": {
      "url": "https://idem-generator.vercel.app/api/mcp"
    }
  }
}
```

Then ask: **“Use idem to generate a landscape banner titled ‘Make room for possibility’, with ‘A little color. A lot of possibility.’ as supporting copy. Use the Midnight & ivory palette and give me the PNG.”**

The server exposes `list_banner_options`, `review_banner`, and `generate_banner`. Banners use the same grid layouts, bundled brand fonts, full idem logo, and procedural painter as the website. Available controls are `title` (required, up to 240 characters), `descriptor` (up to 600), `format` (`square` or `landscape`), `layout` (`auto`, `logo-top`, `offset`, `stack`, `split`, `editorial`, `footer`), `palette`, optional custom `colors` (2–6 hex colors), `tone` (`light` or `dark` foreground), `background` (`painted` or `solid`), `fade` (`none`, `left`, `top`, `right`, `bottom`), and optional `seed` (0–4294967295). The default is a square painted banner with automatic layout selection, white ink, and a left fade. For dark ink, usually choose `fade: "none"`.

`review_banner` provides a fast preflight using the real brand fonts, without painting a background. It compares all six approved compositions and checks disconnected foreground groups, underfilled large headline blocks, overflow, excessive font shrinking, legibility at a 768 px viewing width, weak headline hierarchy, orphan lines, broken words, and overlap. Deliberate empty space outside the foreground group is allowed. Preflight does not assess background contrast.

`generate_banner` defaults to `layout: "auto"`. It paints the background once, compares all six layouts against that same cropped and faded background, and selects the highest-ranked candidate. The review also estimates foreground contrast (including the descriptor’s 70% opacity) and distracting background variation. A named layout is honored even when flagged. The structured `review` contains `status` (`pass` or `revise`), issues, candidate scores, `recommendedLayout`, and suggested fixes; `layoutSelection` records the request and actual selection. A score is a relative heuristic, not a calibrated quality percentage. The returned concrete layout and seed are embedded in the PNG URL, so automatic choices remain reproducible.

Agents must read the review and visually inspect the preview before delivery. If flagged, reuse the settings and seed and try a recommended layout, different fade, ink, or palette. Do not silently rewrite user copy. After at most two revision attempts, return the best result with any unresolved issues explained. A heuristic pass is not a guarantee of visual quality or accessibility; sampled contrast can miss local details.

`generate_banner` returns a JPEG preview, a full-resolution PNG download URL, and structured settings including the seed. For revisions, reuse the seed and settings and change only the desired fields. It creates an independent image; it does not change an open browser workspace. All rendering is procedural, with no model API or API key.

The download URL contains the banner text and settings as an encoded recipe. The PNG is reproduced on demand from that recipe, so links work across cold starts without a database or Blob store. A small per-instance cache avoids repeat rendering, and public downloads can be cached by Vercel's CDN. Links are shareable; anyone with a link can see the banner and decode its text. New banners use recipe version 2. Version 1 download URLs keep the original four compositions, fonts, and logo assets so existing links reproduce their original artwork. No image uploads or arbitrary remote URLs are accepted by these tools.

The MCP and download routes are Vercel Node.js Functions in the same project as the website. Full painted backgrounds render at 3840 × 2400 before cropping into 1024 × 1024 or 1920 × 1080 banners. Each instance renders one distinct recipe at a time; concurrent duplicates share the work, and other requests receive a retryable busy error. The renderer runs in a worker thread with a 240-second timeout; functions allow up to 300 seconds. PNG downloads stream to avoid Vercel's buffered response-size limit. Native Canvas binaries, fonts, logos, and worker sources are included in the function bundle.

For private use, set `MCP_AUTH_TOKEN` in the Vercel project's environment variables and redeploy. Configure the MCP client to send `Authorization: Bearer <your-token>` (many clients accept `headers` next to `url`). Download URLs are then signed so the recipient can download that exact banner without a separate header. Changing the token invalidates existing links. This is a shared-token integration, not an OAuth login flow. When the token is unset, the MCP is public and callable without credentials.

Locally, `npm start` or `npm run dev` serves both the app and MCP at `http://127.0.0.1:5173/api/mcp`. To use the optional token locally, export it in the shell before starting the app; `.env.example` documents the variable. `npm run test:mcp` checks the real SDK client, discovery, generation, downloads, cold-instance reproduction, validation, concurrency, and authentication. `npm run benchmark:banner` renders a full painted landscape banner into `.context/` and reports duration, output sizes, and peak memory. `node scripts/check-deployed-mcp.mjs https://your-deployment.vercel.app` checks and saves a painted banner from a deployed endpoint.

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

Open `/banner` for the grid-based banner workspace. Choose 1024 × 1024 or 1920 × 1080. Both use 44 px margins on all four sides and 24 px gutters with independently toggleable 2-column, 2-row, 8-column, and 8-row guides. Text blocks start on grid anchors; the two-row supporting-copy blocks use the 7 px optical inset specified in Figma. Editing content never moves their anchors. Longer content wraps and scales within its assigned block.

The banner contains exactly three elements: a title in the bundled Literatura Past face, supporting copy in bundled ABC Areal Medium, and the supplied idem logo or symbol. Six compositions follow the [approved Figma frames](https://www.figma.com/design/hiE9FtigXJntQAlpE4BwBC/idem-%3E%3C-brand?node-id=2528-118): Logo top, Offset, Stack, Split, Editorial, and Footer. Square exports match the frame measurements; landscape exports extend the same grid spans across the wider format. Typography uses the reference sizes, line heights, −1% tracking, and 70% supporting-copy opacity. The full logo is 216 × 61 px; Offset uses the 77 × 61 px symbol. Both preserve the original artwork proportions. Light/dark ink selects the matching logo artwork and text color. Exports wait for both brand fonts and logos to load.

Format, layout, ink, background source, grid layers, and fade direction use compact segmented controls. The sidebar has only two text fields and compact pigment/palette controls. Assets are served locally from `public/brand/` and `public/fonts/`.

Generate a background from the same palettes and worker as Still, or upload an image and apply the same oil-paint effect as Upload. Backgrounds render with a 3840 px longest edge and are center-cropped to the banner without stretching. Switching banner sizes preserves the painted background. A Fade switch enables or removes a black gradient layer above the background and below the three elements. Four arrow segments select the opaque edge: left, top, right, or bottom. The gradient runs from alpha 1 at that edge to alpha 0 at the opposite edge. It is included in exports; it never darkens the foreground elements. All images remain local.

PNG export uses the selected banner dimensions, includes editable text as rendered, and always excludes the SVG grid overlay. `/layered` now opens Banner. The banner regression check covers exact grid geometry, all twelve layouts, bundled fonts and both logos, text fitting, logo proportions, directional fade pixels, cancellation, and guide-free PNG exports. Run `node scripts/check-banner.mjs --samples` to save branded export previews and layout contact sheets in `.context/`.
