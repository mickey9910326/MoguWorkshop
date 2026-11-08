// Local preview: serves public/ like the Worker does and forwards
// /mabilat/api/* to MABILAT_API (default: the live site, read-only).
//   npm run dev:proxy                       -> http://localhost:8788/
//   MABILAT_API=http://localhost:8765 npm run dev:proxy
//     (start that mabilat with: python -m mabilat serve --port 8765 --base-path /mabilat)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json',
};

export function route(url) {
  const [path, query = ''] = url.split('?');
  if (path.startsWith('/mabilat/api/')) return { proxy: url };
  let p;
  try { p = decodeURIComponent(path); } catch { return {}; }
  if (p.includes('\\') || p.split('/').includes('..')) return {};
  const rel = posix.normalize(p).replace(/^\/+/, '');
  if (p.endsWith('/')) return { file: rel + 'index.html' };
  if (!extname(p)) return { redirect: p + '/' + (query ? `?${query}` : '') };
  return { file: rel };
}

async function serve(req, res, api) {
  const r = route(req.url);
  if (r.proxy) {
    try {
      const up = await fetch(api + r.proxy);
      res.writeHead(up.status, { 'content-type': up.headers.get('content-type') || 'application/json' });
      res.end(Buffer.from(await up.arrayBuffer()));
    } catch (e) {
      res.writeHead(502); res.end(String(e));
    }
    return;
  }
  if (r.redirect) { res.writeHead(307, { location: r.redirect }); res.end(); return; }
  if (!r.file) { res.writeHead(404); res.end('not found'); return; }
  const file = join(PUBLIC, r.file);
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('not found');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const api = (process.env.MABILAT_API || 'https://mabinogi.elden-mogu.com').replace(/\/$/, '');
  const port = Number(process.env.PORT || 8788);
  http.createServer((req, res) => serve(req, res, api)).listen(port, () => {
    console.log(`http://localhost:${port}/  (mabilat API -> ${api})`);
  });
}
