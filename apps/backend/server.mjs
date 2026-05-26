import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.DATA_FILE || '/data/data.json';
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 50 * 1024 * 1024);
const EMPTY_STATE = { inL: [], outL: [], inC: 1, outC: 1 };

async function ensureDataFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJson(EMPTY_STATE);
  }
}

async function readJson() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return EMPTY_STATE;
  }
}

async function writeJson(value) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const tmp = join(dirname(DATA_FILE), `.data-${Date.now()}.tmp`);
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tmp, DATA_FILE);
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isState(value) {
  return value
    && Array.isArray(value.inL)
    && Array.isArray(value.outL)
    && Number.isInteger(value.inC)
    && Number.isInteger(value.outC);
}

await ensureDataFile();

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/state') {
      sendJson(res, 200, await readJson());
      return;
    }

    if (req.method === 'PUT' && req.url === '/api/state') {
      const body = await readBody(req);
      const next = JSON.parse(body);

      if (!isState(next)) {
        sendJson(res, 400, { error: 'Invalid state payload' });
        return;
      }

      await writeJson(next);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Docshare backend listening on ${PORT}`);
  console.log(`Saving data to ${DATA_FILE}`);
});
