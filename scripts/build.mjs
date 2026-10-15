import { copyFile, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ['index.html', 'upload.html', 'upload.js', 'layered.html', 'app.js', 'animation.js', 'painter.js', 'style.css']) {
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, output));
}
