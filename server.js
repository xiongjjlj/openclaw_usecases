const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const parsedWebPort = Number.parseInt(process.env.WEB_PORT || '', 10);
const PORT = Number.isFinite(parsedPort) ? parsedPort : (Number.isFinite(parsedWebPort) ? parsedWebPort : 8080);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'usecases.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxzpmmneiiicjqptgweq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_SERVICE_ROLE_KEY);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ usecases: [] }, null, 2));
}

const CATEGORY_ENUM = ['办公与效率', '运维与自动化', '研究与交易', '移动与硬件', '开发与构建', '其他'];
const submitRate = new Map();

const REQUIRED_USE_CASES = [
  { id: 'uc_beeclaw_trading', title: 'BeeClaw：以 OpenClaw 为执行内核的交易 Bot', category: '交易与预测市场' },
  { id: 'uc_mission_control', title: 'Mission Control：可视化运维 Case', category: '运维与部署' },
  { id: 'uc_phone', title: 'OpenClaw Phone Case', category: '移动与可穿戴' },
  { id: 'uc_bot_number', title: 'OpenClaw Bot：拥有号码并支持回复链路', category: '通信与号码 Bot' },
  { id: 'uc_polymarket', title: 'Polymarket Case', category: '交易与预测市场' },
  { id: 'uc_multi_cua', title: '多人协作 CUA：同频多代理 Case', category: '多代理协作' },
  { id: 'uc_qualify_template', title: 'Qualify 的模板化部署', category: '运维与部署' },
  { id: 'uc_visionclaw', title: 'VisionClaw：把 Agent 带进眼镜', category: '移动与可穿戴' }
];

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function ensureRequiredUseCases() {
  const db = readDb();
  const now = new Date().toISOString();
  let changed = false;
  for (const uc of REQUIRED_USE_CASES) {
    if (!db.usecases.find((x) => x.id === uc.id || x.title === uc.title)) {
      db.usecases.push({
        id: uc.id,
        title: uc.title,
        summary: `${uc.title} 的代表性案例，支持直接复现。`,
        problem: '将复杂能力产品化并复用。',
        workflow: '1) 场景定义 2) 任务编排 3) 执行验证 4) 复盘优化',
        reproPrompt: `你是 OpenClaw。请复现案例：${uc.title}，并输出执行步骤、结果与复盘。`,
        category: uc.category,
        tools: [],
        tags: [],
        links: [],
        submittedBy: 'bear',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    }
  }
  if (changed) writeDb(db);
}

if (!USE_SUPABASE) ensureRequiredUseCases();

function normalizeItemFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    problem: row.problem,
    workflow: row.workflow,
    reproMode: row.repro_mode,
    reproPrompt: row.repro_prompt || '',
    manualSteps: row.manual_steps || '',
    category: row.category,
    tags: row.tags || [],
    tools: row.tools || [],
    links: row.links || [],
    sourceDate: row.source_date || '',
    evidenceNote: row.evidence_note || '',
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function supabaseSelectUseCases() {
  const headers = {
    apikey: SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY}`
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/use_cases?status=eq.published&order=created_at.desc`, { headers });
  if (!res.ok) throw new Error(`supabase select failed: ${res.status}`);
  const rows = await res.json();
  return rows.map(normalizeItemFromDb);
}

async function supabaseInsertUseCase(item) {
  const payload = {
    id: item.id,
    title: item.title,
    summary: item.summary,
    problem: item.problem,
    workflow: item.workflow,
    repro_mode: item.reproMode || 'semi-auto',
    repro_prompt: item.reproPrompt || '',
    manual_steps: item.manualSteps || '',
    category: item.category || 'General',
    tags: item.tags || [],
    tools: item.tools || [],
    links: item.links || [],
    source_date: item.sourceDate || null,
    evidence_note: item.evidenceNote || '',
    submitted_by: item.submittedBy || 'anonymous-openclaw',
    status: 'published'
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/use_cases`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`supabase insert failed: ${res.status}`);
  const rows = await res.json();
  return normalizeItemFromDb(rows[0]);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeText(value = '') {
  return String(value)
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/<\/?script[^>]*>/gi, '')
    .trim();
}

function isTestLikeItem(item = {}) {
  const text = [item.title, item.summary, item.problem, item.workflow, item.reproPrompt]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hitWords = ['测试', 'test', 'supabase写入', 'debug', '调试', 'hello world'];
  return hitWords.some((w) => text.includes(w));
}

function validateUseCase(payload) {
  const required = ['title', 'summary', 'problem', 'workflow', 'reproPrompt'];
  for (const key of required) {
    if (!payload[key] || typeof payload[key] !== 'string' || !payload[key].trim()) {
      return `${key} is required`;
    }
  }
  if ((payload.title || '').length > 140) return 'title too long';
  if (!CATEGORY_ENUM.includes(payload.category)) return 'invalid category';

  const links = String(payload.links || '').split('\n').map((v) => v.trim()).filter(Boolean);
  for (const link of links) {
    try {
      const u = new URL(link);
      if (!['http:', 'https:'].includes(u.protocol)) return 'invalid link protocol';
    } catch {
      return 'invalid link';
    }
  }

  return null;
}

function staticFile(reqPath) {
  const normalized = reqPath === '/' ? '/index.html' : reqPath;
  const fullPath = path.join(PUBLIC_DIR, path.normalize(normalized));
  if (!fullPath.startsWith(PUBLIC_DIR)) return null;
  return fullPath;
}

const linkSessions = new Map();

function genLinkCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "CLAW-";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'openclaw-usecase-hub' });
  }


  if (url.pathname === '/api/auth/link/start' && req.method === 'POST') {
    const code = genLinkCode();
    linkSessions.set(code, { status: 'pending', createdAt: Date.now() });
    return sendJson(res, 200, { ok: true, code, expiresInSec: 600 });
  }

  if (url.pathname === '/api/auth/link/status' && req.method === 'GET') {
    const code = (url.searchParams.get('code') || '').trim();
    const sess = linkSessions.get(code);
    if (!sess) return sendJson(res, 404, { ok: false, status: 'not_found' });
    if (Date.now() - sess.createdAt > 10 * 60 * 1000) {
      linkSessions.delete(code);
      return sendJson(res, 410, { ok: false, status: 'expired' });
    }
    return sendJson(res, 200, { ok: true, status: sess.status });
  }

  // Temporary completion endpoint for integration testing.
  if (url.pathname === '/api/auth/link/complete' && req.method === 'POST') {
    const body = await parseBody(req);
    const code = (body.code || '').trim();
    const sess = linkSessions.get(code);
    if (!sess) return sendJson(res, 404, { ok: false, error: 'code not found' });
    sess.status = 'linked';
    sess.linkedAt = Date.now();
    linkSessions.set(code, sess);
    return sendJson(res, 200, { ok: true, status: 'linked' });
  }

  if (url.pathname === '/api/usecases' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const tag = (url.searchParams.get('tag') || '').toLowerCase();
    const category = (url.searchParams.get('category') || '').toLowerCase();
    let list;

    try {
      list = USE_SUPABASE
        ? await supabaseSelectUseCases()
        : [...readDb().usecases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }

    list = list.filter((it) => !isTestLikeItem(it));

    if (q) {
      list = list.filter((it) =>
        [it.title, it.summary, it.problem, it.workflow, it.reproPrompt]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (tag) {
      list = list.filter((it) => (it.tags || []).some((t) => t.toLowerCase() === tag));
    }
    if (category) {
      list = list.filter((it) => (it.category || '').toLowerCase() === category);
    }

    return sendJson(res, 200, { items: list, total: list.length });
  }

  if (url.pathname === '/api/usecases' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);

      if (payload.website && String(payload.website).trim()) {
        return sendJson(res, 400, { ok: false, error: 'spam detected' });
      }

      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
      const nowMs = Date.now();
      const last = submitRate.get(ip) || 0;
      if (nowMs - last < 30 * 1000) {
        return sendJson(res, 429, { ok: false, error: '提交过于频繁，请 30 秒后重试' });
      }
      submitRate.set(ip, nowMs);

      const err = validateUseCase(payload);
      if (err) return sendJson(res, 400, { ok: false, error: err });
      if (isTestLikeItem(payload)) return sendJson(res, 400, { ok: false, error: '疑似测试内容，请补充真实案例后再提交' });

      const now = new Date().toISOString();
      const item = {
        id: `uc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        title: sanitizeText(payload.title),
        summary: sanitizeText(payload.summary),
        problem: sanitizeText(payload.problem),
        workflow: sanitizeText(payload.workflow),
        reproMode: sanitizeText(payload.reproMode || 'semi-auto') || 'semi-auto',
        reproPrompt: sanitizeText(payload.reproPrompt),
        manualSteps: sanitizeText(payload.manualSteps || ''),
        category: sanitizeText(payload.category || '其他') || '其他',
        tools: (payload.tools || '')
          .split(',')
          .map((v) => sanitizeText(v))
          .filter(Boolean),
        tags: (payload.tags || '')
          .split(',')
          .map((v) => sanitizeText(v))
          .filter(Boolean),
        links: (payload.links || '')
          .split('\n')
          .map((v) => sanitizeText(v))
          .filter(Boolean),
        sourceDate: sanitizeText(payload.sourceDate || ''),
        evidenceNote: sanitizeText(payload.evidenceNote || ''),
        submittedBy: sanitizeText(payload.submittedBy || 'anonymous-openclaw') || 'anonymous-openclaw',
        createdAt: now,
        updatedAt: now
      };

      if (USE_SUPABASE) {
        const inserted = await supabaseInsertUseCase(item);
        return sendJson(res, 201, { ok: true, item: inserted, backend: 'supabase' });
      }

      const db = readDb();
      db.usecases.push(item);
      writeDb(db);
      return sendJson(res, 201, { ok: true, item, backend: 'json' });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  const filePath = staticFile(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, max-age=0'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenClaw Use Case Hub running at http://0.0.0.0:${PORT}`);
});
