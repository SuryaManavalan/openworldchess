// The website side of the server (docs/specs/site.md): the built client and the site's pages,
// with clean URLs, one canonical host, real 404s, compression and sensible caching.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, relative } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import type { Game } from './game.ts';
import { citiesPage } from './site.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};
const TEXT = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt', '.xml']);
const HOST = 'openworldchess.com';

const br = promisify(brotliCompress), gz = promisify(gzip);
/**
 * Compressed copies, made once per file version, off the main thread (zlib's pool), so a first
 * request for the game's bundle never stalls the world's turn.
 */
const packed = new Map<string, { at: number; p: Promise<{ br: Buffer; gz: Buffer }> }>();
function pack(key: string, at: number, raw: Buffer) {
  let e = packed.get(key);
  if (!e || e.at !== at) {
    e = { at, p: Promise.all([br(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }), gz(raw, { level: 9 })]).then(([b, g]) => ({ br: b, gz: g })) };
    packed.set(key, e);
  }
  return e.p;
}

/** Compress every text file of the build ahead of the first visitor. */
export function warm(root: string) {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(join(d, f.name)) : [join(d, f.name)]));
  try {
    for (const f of walk(root)) if (TEXT.has(extname(f)) && statSync(f).size > 1024) void pack('/' + relative(root, f), statSync(f).mtimeMs, readFileSync(f));
  } catch { /* no build (dev) */ }
}

function send(req: IncomingMessage, res: ServerResponse, body: Buffer, type: string, cache: string, key: string, at: number, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.setHeader('cache-control', cache);
  const ext = '.' + (type.split(';')[0].split('/')[1] ?? '');
  const compressible = TEXT.has(ext) || type.startsWith('text/') || type.includes('javascript') || type.includes('xml') || type.includes('json');
  if (compressible && body.length > 1024) {
    res.setHeader('vary', 'accept-encoding');
    const enc = String(req.headers['accept-encoding'] ?? '');
    const which = /\bbr\b/.test(enc) ? 'br' : /\bgzip\b/.test(enc) ? 'gzip' : null;
    if (which) {
      pack(key, at, body).then((p) => { res.setHeader('content-encoding', which); res.end(which === 'br' ? p.br : p.gz); }, () => res.end(body));
      return;
    }
  }
  res.end(body);
}

/** /cities, rendered from the directory at most once a minute. */
let cities: { at: number; html: Buffer } | null = null;
function citiesHtml(game: Game) {
  if (!cities || Date.now() - cities.at > 60_000) {
    const list = game.directory.all();
    cities = { at: Date.now(), html: Buffer.from(citiesPage(list, game.players.size)) };
  }
  return cities;
}

/** Serves the client and the site. Returns false if the request isn't a GET/HEAD for a page or file. */
export function serveWeb(req: IncomingMessage, res: ServerResponse, root: string, game: Game): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const url = req.url ?? '/';
  // One host: www goes to the bare domain.
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  if (host.startsWith('www.')) { res.statusCode = 301; res.setHeader('location', `https://${HOST}${url}`); res.end(); return true; }
  const q = url.indexOf('?');
  let path = normalize(decodeURIComponent(q < 0 ? url : url.slice(0, q))).replace(/^(\.\.[/\\])+/, '');
  const query = q < 0 ? '' : url.slice(q);
  // Clean URLs: /about.html → /about (one address per page).
  if (path.endsWith('.html') && path !== '/index.html' && path !== '/stats.html' && existsSync(join(root, path))) {
    res.statusCode = 301; res.setHeader('location', path.slice(0, -5) + query); res.end(); return true;
  }
  if (path.length > 1 && path.endsWith('/')) { res.statusCode = 301; res.setHeader('location', path.slice(0, -1) + query); res.end(); return true; }
  if (path === '/cities') { const c = citiesHtml(game); send(req, res, c.html, MIME['.html'], 'public, max-age=60', '/cities', c.at); return true; }
  if (path === '/') path = '/index.html';
  else if (!extname(path) && existsSync(join(root, path + '.html'))) path += '.html';
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    // A real 404 (not the game with a 200), so search engines don't index empty addresses.
    const nf = join(root, '404.html');
    if (existsSync(nf)) send(req, res, readFileSync(nf), MIME['.html'], 'no-cache', '/404.html', statSync(nf).mtimeMs, 404);
    else { res.statusCode = 404; res.end('not found'); }
    return true;
  }
  const ext = extname(file);
  const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable'
    : path.startsWith('/img/') ? 'public, max-age=604800'
    : ext === '.css' || ext === '.txt' || ext === '.xml' ? 'public, max-age=3600'
    : 'no-cache';
  send(req, res, readFileSync(file), MIME[ext] ?? 'application/octet-stream', cache, path, statSync(file).mtimeMs);
  return true;
}
