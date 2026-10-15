import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const files = { '/layered':'layered.html', '/layered/':'layered.html', '/upload':'upload.html', '/upload/':'upload.html', '/upload.js':'upload.js', '/animation.js':'animation.js', '/':'index.html', '/index.html':'index.html', '/app.js':'app.js', '/painter.js':'painter.js', '/style.css':'style.css' };
const types = { html:'text/html', js:'text/javascript', css:'text/css' };
http.createServer(async (req,res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  try { const data = await readFile(root + file); res.writeHead(200, {'Content-Type': types[file.split('.').pop()] + '; charset=utf-8','Cache-Control':'no-store'}); res.end(data); }
  catch { res.writeHead(500); res.end('Unable to read app file'); }
}).listen(5173, '127.0.0.1', () => console.log('Pigment is ready at http://127.0.0.1:5173'));
