const $ = s => document.querySelector(s);
const canvas = $('#painting');
let source = null, worker = null, busy = false, ready = false, edition = 0, seed = 0, filename = 'image', loadVersion = 0;

function setBusy(value) {
  busy = value;
  $('#generate').disabled = value || !source;
  $('#download').disabled = value || !ready;
  $('#loading').hidden = !value;
  canvas.setAttribute('aria-busy', String(value));
}
function stopPainting() {
  worker?.terminate(); worker = null;
  ready = false; setBusy(false);
}
function fail(message) {
  worker?.terminate(); worker = null;
  setBusy(false); $('#status').textContent = message;
}
async function loadFile(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    $('#status').textContent = 'Please choose a JPG, PNG, or WebP image.'; return;
  }
  if (file.size > 20 * 1024 * 1024) {
    $('#status').textContent = 'This image is too large. Please choose one under 20 MB.'; return;
  }
  const version = ++loadVersion;
  stopPainting(); source = null; setBusy(true);
  $('#progress').textContent = 'Opening your image…';
  $('#status').textContent = '';
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (version !== loadVersion) return;
    const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const buffer = document.createElement('canvas'); buffer.width = width; buffer.height = height;
    const context = buffer.getContext('2d', {willReadFrequently: true});
    // Transparent images are painted on the studio's warm ivory ground.
    context.fillStyle = '#f4f0e5'; context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    source = context.getImageData(0, 0, width, height);
    filename = file.name.replace(/\.[^.]+$/, '') || 'image';
    $('#original').src = buffer.toDataURL('image/png');
    $('#source-preview').hidden = false;
    $('#source-size').textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
    $('#file-name').textContent = file.name;
    canvas.hidden = true; $('#empty-state').hidden = false;
    $('#art-title').textContent = 'Your image, in oil';
    $('#output-size').textContent = `${width} × ${height} px · Original proportions`;
    setBusy(false);
    $('#status').textContent = 'Image ready. Choose Paint this image to begin.';
  } catch {
    if (version === loadVersion) fail('This image could not be opened. Please try another JPG, PNG, or WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
function generate() {
  if (busy || !source) return;
  ready = false; setBusy(true);
  $('#status').textContent = '';
  $('#progress').textContent = 'Mixing the colors in your image…';
  seed = crypto.getRandomValues(new Uint32Array(1))[0];
  try {
    worker = new Worker('/painter.js');
    worker.onmessage = ({data}) => {
      if (data.progress) { $('#progress').textContent = data.progress; return; }
      if (data.error) { fail('The painting could not be completed. Please try again.'); return; }
      try {
        canvas.width = data.width; canvas.height = data.height;
        canvas.style.aspectRatio = `${data.width} / ${data.height}`;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height), 0, 0);
        canvas.hidden = false; $('#empty-state').hidden = true;
        edition++;
        $('#edition').textContent = `IMAGE STUDY ${String(edition).padStart(3, '0')}`;
        $('#art-title').textContent = 'A familiar scene, freshly painted';
        $('#generate span').textContent = 'Paint another variation';
        ready = true; setBusy(false);
        $('#status').textContent = 'Your painting is ready to save.';
        worker.terminate(); worker = null;
      } catch { fail('The painting could not be displayed. Please try again.'); }
    };
    worker.onerror = () => fail('The painting could not be completed. Please try again.');
    // Transfer a copy so the original is available for another brush variation.
    const pixels = source.data.slice().buffer;
    worker.postMessage({sourcePixels: pixels, seed, width: source.width, height: source.height}, [pixels]);
  } catch { fail('The painting could not be started. Please try again.'); }
}
$('#image-file').addEventListener('change', event => {
  loadFile(event.target.files[0]); event.target.value = '';
});
const dropZone = $('#drop-zone');
for (const type of ['dragenter', 'dragover']) dropZone.addEventListener(type, event => {
  event.preventDefault(); dropZone.classList.add('dragging');
});
for (const type of ['dragleave', 'drop']) dropZone.addEventListener(type, event => {
  event.preventDefault(); dropZone.classList.remove('dragging');
});
dropZone.addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));
// Avoid navigating away if a file lands just outside the drop zone.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
window.addEventListener('pagehide', () => worker?.terminate());
$('#generate').addEventListener('click', generate);
$('#download').addEventListener('click', () => {
  if (!ready || busy) return;
  canvas.toBlob(blob => {
    if (!blob) { $('#status').textContent = 'Unable to save this image. Please try again.'; return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `pigment-${filename}-${seed}.png`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('#status').textContent = 'Your PNG is ready to save.';
  }, 'image/png');
});
