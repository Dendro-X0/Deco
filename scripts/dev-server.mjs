import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

const port = Number(getArg('--port', '3001'));
const rootArg = getArg('--root', '../ui');
const rootDir = path.resolve(process.cwd(), rootArg);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function safeJoin(base, target) {
  const normalized = path.normalize(target).replace(/^([/\\])+/, '');
  const fullPath = path.resolve(base, normalized);
  if (!fullPath.startsWith(base)) return null;
  return fullPath;
}

async function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let reqPath = decoded === '/' ? '/index.html' : decoded;
  let full = safeJoin(rootDir, reqPath);
  if (!full) return null;

  try {
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      full = path.join(full, 'index.html');
    }
    return full;
  } catch {
    if (!path.extname(full)) {
      const fallback = safeJoin(rootDir, '/index.html');
      return fallback;
    }
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Bad Request');
    return;
  }

  const fullPath = await resolvePath(req.url);
  if (!fullPath) {
    res.writeHead(404).end('Not Found');
    return;
  }

  try {
    await fs.access(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(fullPath).pipe(res);
  } catch {
    res.writeHead(404).end('Not Found');
  }
});

server.listen(port, () => {
  process.stdout.write(`[deco-dev-server] Serving ${rootDir} at http://localhost:${port}\n`);
});