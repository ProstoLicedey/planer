import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

import { refreshSchedule } from './refreshSchedule.mjs';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const DEFAULT_GROUP = process.env.SCHEDULE_GROUP || '4319';
const DEFAULT_YEAR = Number(process.env.SCHEDULE_YEAR || 2026);

const projectRoot = process.cwd();
const outDir = path.resolve(projectRoot, 'out');

let reparseInFlight = null;

function safeBasename(fileName) {
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

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setNoCacheHeaders(res);
  res.end(JSON.stringify(data));
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
  const entries = await fs.readdir(outDir).catch(() => []);
  const htmlFiles = entries.filter((f) => /^schedule-.*\.html$/i.test(f));
  if (!htmlFiles.length) return null;

  const preferred = `schedule-${DEFAULT_GROUP}-autumn-${DEFAULT_YEAR}.html`;
  if (htmlFiles.includes(preferred)) return preferred;

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

async function sendFile(res, filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    res.statusCode = 404;
    setNoCacheHeaders(res);
    res.end('Not found');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypeFor(filePath));
  setNoCacheHeaders(res);
  res.end(await fs.readFile(filePath));
}

function parseScheduleTarget(input) {
  const groupNumber = String(input?.group || input?.groupNumber || DEFAULT_GROUP);
  const year = Number(input?.year || DEFAULT_YEAR);
  if (!groupNumber || !Number.isFinite(year)) {
    throw new Error('Нужны корректные group и year');
  }
  return { groupNumber, year };
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = reqUrl.pathname || '/';

    if (pathname === '/' && req.method === 'GET') {
      const newest = await findNewestScheduleHtml();
      if (!newest) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        setNoCacheHeaders(res);
        res.end('Расписание ещё не собрано. Нажмите «Перепарсить расписание» или откройте / после первого запуска.');
        return;
      }
      await sendFile(res, path.join(outDir, newest));
      return;
    }

    if (pathname === '/api/reparse' && req.method === 'POST') {
      if (reparseInFlight) {
        sendJson(res, 409, { error: 'Перепарс уже выполняется' });
        return;
      }

      const body = await readBodyJson(req).catch(() => ({}));
      const target = parseScheduleTarget({
        group: body?.group ?? reqUrl.searchParams.get('group'),
        year: body?.year ?? reqUrl.searchParams.get('year'),
      });

      reparseInFlight = refreshSchedule(target)
        .then((result) => sendJson(res, 200, { ok: true, ...result }))
        .catch((e) => sendJson(res, 500, { error: String(e?.message || e) }))
        .finally(() => {
          reparseInFlight = null;
        });
      await reparseInFlight;
      return;
    }

    if (pathname === '/api/user-events' && req.method === 'GET') {
      const file = safeBasename(reqUrl.searchParams.get('file'));
      if (!file) {
        sendJson(res, 400, { error: 'Bad file' });
        return;
      }

      const filePath = path.join(outDir, file);
      const data = await readJsonOrEmpty(filePath);
      sendJson(res, 200, data);
      return;
    }

    if (pathname === '/api/user-events' && req.method === 'POST') {
      const body = await readBodyJson(req);
      const file = safeBasename(body?.file);
      const events = body?.events;

      if (!file) {
        sendJson(res, 400, { error: 'Bad file' });
        return;
      }

      if (!Array.isArray(events)) {
        sendJson(res, 400, { error: '`events` must be an array' });
        return;
      }

      await writeJson(path.join(outDir, file), events);
      sendJson(res, 200, { ok: true });
      return;
    }

    const requested = pathname.replace(/^\/+/, '');
    const resolved = path.resolve(outDir, requested);
    if (!resolved.startsWith(outDir)) {
      res.statusCode = 400;
      setNoCacheHeaders(res);
      res.end('Bad path');
      return;
    }

    await sendFile(res, resolved);
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`App started: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`Static root: ${outDir}`);
});
