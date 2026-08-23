import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 4173);

const projectRoot = process.cwd();
const outDir = path.resolve(projectRoot, 'out');

function safeBasename(fileName) {
  // Prevent path traversal: keep only last segment and disallow ".."
  const base = path.basename(String(fileName || '').replace(/\\/g, '/'));
  if (!base || base.includes('..')) return null;
  return base;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

async function readJsonOrEmpty(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') return [];
    throw e;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => {
      buf += chunk.toString('utf-8');
    });
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function findNewestScheduleHtml() {
  const entries = await fs.readdir(outDir);
  const htmlFiles = entries.filter((f) => /^schedule-.*\.html$/i.test(f));
  if (!htmlFiles.length) return null;

  const filesWithMtime = await Promise.all(
    htmlFiles.map(async (f) => {
      const p = path.join(outDir, f);
      const st = await fs.stat(p);
      return { f, mtimeMs: st.mtimeMs };
    }),
  );

  filesWithMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return filesWithMtime[0]?.f ?? null;
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = reqUrl.pathname || '/';

    // ---- Convenience: open newest schedule at "/" ----
    if (pathname === '/' && req.method === 'GET') {
      const newest = await findNewestScheduleHtml();
      if (!newest) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        setNoCacheHeaders(res);
        res.end('No schedule-*.html found in out/.');
        return;
      }
      res.statusCode = 302;
      res.setHeader('Location', '/' + newest);
      setNoCacheHeaders(res);
      res.end();
      return;
    }

    // ---- API: user events ----
    if (pathname === '/api/user-events' && req.method === 'GET') {
      const file = safeBasename(reqUrl.searchParams.get('file'));
      if (!file) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setNoCacheHeaders(res);
        res.end(JSON.stringify({ error: 'Bad file' }));
        return;
      }

      const filePath = path.join(outDir, file);
      const data = await readJsonOrEmpty(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      setNoCacheHeaders(res);
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === '/api/user-events' && req.method === 'POST') {
      const body = await readBodyJson(req);
      const file = safeBasename(body?.file);
      const events = body?.events;

      if (!file) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setNoCacheHeaders(res);
        res.end(JSON.stringify({ error: 'Bad file' }));
        return;
      }

      if (!Array.isArray(events)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setNoCacheHeaders(res);
        res.end(JSON.stringify({ error: '`events` must be an array' }));
        return;
      }

      const filePath = path.join(outDir, file);
      await writeJson(filePath, events);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      setNoCacheHeaders(res);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ---- Static files from out/ ----
    const requested = pathname.replace(/^\/+/, '');
    const resolved = path.resolve(outDir, requested);
    if (!resolved.startsWith(outDir)) {
      res.statusCode = 400;
      setNoCacheHeaders(res);
      res.end('Bad path');
      return;
    }

    const stat = await fs
      .stat(resolved)
      .catch(() => null);
    if (!stat || !stat.isFile()) {
      res.statusCode = 404;
      setNoCacheHeaders(res);
      res.end('Not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentTypeFor(resolved));
    setNoCacheHeaders(res);
    const buf = await fs.readFile(resolved);
    res.end(buf);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    setNoCacheHeaders(res);
    res.end(JSON.stringify({ error: String(e?.message || e) }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Serve started: http://localhost:${PORT}`);
  console.log(`Static root: ${outDir}`);
});

