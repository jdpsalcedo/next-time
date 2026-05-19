import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function stream(res, status, contentType, filePath, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': contentType, ...extraHeaders });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, 'http://x');
  const reqPath = decodeURIComponent(reqUrl.pathname);

  let filePath = path.normalize(path.join(DIST, reqPath));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (reqPath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const ct = MIME[ext] || 'application/octet-stream';
      const cache = ext === '.html'
        ? 'no-cache'
        : 'public, max-age=31536000, immutable';
      return stream(res, 200, ct, filePath, { 'Cache-Control': cache });
    }
    // SPA fallback — every unknown route serves index.html
    const fallback = path.join(DIST, 'index.html');
    stream(res, 200, MIME['.html'], fallback, { 'Cache-Control': 'no-cache' });
  });
});

server.on('error', (err) => {
  console.error('server error:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('uncaught:', err);
});

console.log(`starting next-time | PORT=${PORT} DIST=${DIST}`);
try {
  fs.accessSync(DIST);
  console.log(`dist/ found at ${DIST}`);
} catch {
  console.error(`dist/ MISSING at ${DIST} — build did not run`);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`next-time listening on 0.0.0.0:${PORT}`);
});
