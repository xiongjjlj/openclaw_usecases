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
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const APP_VERSION = process.env.APP_VERSION || 'v0.4.4+20260310.1646';

const CATEGORY_ENUM = ['办公与效率', '运维与自动化', '研究与交易', '移动与硬件', '开发与构建', '其他'];
const STATUS_ENUM = ['draft', 'pending_review', 'approved', 'rejected', 'changes_requested', 'published'];
const submitRate = new Map();
const linkSessions = new Map();
const agentChallenges = new Map();
const agentGuideShort = new Map();
const agentSessions = new Map();
const agentProfiles = new Map();
const agentSubmitLog = new Map();

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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ usecases: [], reviewEvents: [] }, null, 2));
}

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload));
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
      } catch {
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

function readDb() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(db.usecases)) db.usecases = [];
  if (!Array.isArray(db.reviewEvents)) db.reviewEvents = [];
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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

function genLinkCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'CLAW-';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeItemFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    problem: row.problem,
    workflow: row.workflow,
    reproMode: row.repro_mode || row.reproMode,
    reproPrompt: row.repro_prompt || row.reproPrompt || '',
    manualSteps: row.manual_steps || row.manualSteps || '',
    category: row.category,
    tags: row.tags || [],
    tools: row.tools || [],
    links: row.links || [],
    sourceDate: row.source_date || row.sourceDate || '',
    evidenceNote: row.evidence_note || row.evidenceNote || '',
    submittedBy: row.submitted_by || row.submittedBy,
    ownerAgentId: row.owner_agent_id || row.ownerAgentId || '',
    authMethod: row.auth_method || row.authMethod || '',
    identityLevel: row.identity_level || row.identityLevel || '',
    status: row.status || 'pending_review',
    reviewReason: row.review_reason || row.reviewReason || '',
    reviewedBy: row.reviewed_by || row.reviewedBy || '',
    reviewedAt: row.reviewed_at || row.reviewedAt || '',
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
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
        status: 'published',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    }
  }
  if (changed) writeDb(db);
}

if (!USE_SUPABASE) ensureRequiredUseCases();

function pickAuthHeaders(useServiceRole = false) {
  const token = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY);
  return {
    apikey: token,
    Authorization: `Bearer ${token}`
  };
}

async function supabaseListUseCases({ status, q, category, limit = 100, offset = 0, publishedOnly = false } = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('order', 'created_at.desc');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (publishedOnly) params.append('status', 'eq.published');
  if (status) params.append('status', `eq.${status}`);
  if (category) params.append('category', `eq.${category}`);
  if (q) params.append('or', `(title.ilike.*${q}*,summary.ilike.*${q}*,problem.ilike.*${q}*)`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/use_cases?${params.toString()}`, {
    headers: pickAuthHeaders(!publishedOnly)
  });
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
    status: item.status || 'pending_review'
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/use_cases`, {
    method: 'POST',
    headers: {
      ...pickAuthHeaders(true),
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`supabase insert failed: ${res.status}`);
  const rows = await res.json();
  return normalizeItemFromDb(rows[0]);
}

async function supabaseUpdateReviewDecision(id, decision, reason = '', operator = 'system') {
  const now = new Date().toISOString();
  const targetStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'changes_requested';
  const payload = {
    status: targetStatus,
    review_reason: reason,
    reviewed_by: operator,
    reviewed_at: now,
    updated_at: now
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/use_cases?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      ...pickAuthHeaders(true),
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`supabase update failed: ${res.status}`);
  const rows = await res.json();
  return normalizeItemFromDb(rows[0]);
}

function localSelectUseCases({ status, q, category, publishedOnly = false, limit = 100, offset = 0 } = {}) {
  let list = [...readDb().usecases]
    .map(normalizeItemFromDb)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (publishedOnly) list = list.filter((x) => x.status === 'published');
  if (status) list = list.filter((x) => x.status === status);
  if (category) list = list.filter((x) => x.category === category);
  if (q) {
    const qq = q.toLowerCase();
    list = list.filter((it) => [it.title, it.summary, it.problem, it.workflow].join(' ').toLowerCase().includes(qq));
  }
  return list.slice(offset, offset + limit);
}

function localApplyDecision(id, decision, reason = '', operator = 'system') {
  const targetStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'changes_requested';
  const db = readDb();
  const idx = db.usecases.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const before = normalizeItemFromDb(db.usecases[idx]);
  const now = new Date().toISOString();
  db.usecases[idx].status = targetStatus;
  db.usecases[idx].reviewReason = reason;
  db.usecases[idx].reviewedBy = operator;
  db.usecases[idx].reviewedAt = now;
  db.usecases[idx].updatedAt = now;

  db.reviewEvents.unshift({
    id: `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    itemId: id,
    action: decision,
    fromStatus: before.status,
    toStatus: targetStatus,
    reason,
    operator,
    createdAt: now
  });

  writeDb(db);
  return normalizeItemFromDb(db.usecases[idx]);
}

function localStats() {
  const list = readDb().usecases.map(normalizeItemFromDb);
  const counters = STATUS_ENUM.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {});
  for (const it of list) counters[it.status] = (counters[it.status] || 0) + 1;
  return {
    total: list.length,
    pendingReview: counters.pending_review || 0,
    approved: counters.approved || 0,
    rejected: counters.rejected || 0,
    published: counters.published || 0,
    byStatus: counters
  };
}

function validateDecisionPayload(body = {}) {
  const decision = (body.decision || '').trim();
  if (!['approve', 'reject', 'request_changes'].includes(decision)) {
    return { error: 'decision must be approve/reject/request_changes' };
  }
  const reason = sanitizeText(body.reason || body.note || '');
  return { decision, reason, operator: sanitizeText(body.operator || 'admin') || 'admin' };
}

function isAdminAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const headerToken = String(req.headers['x-admin-token'] || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return headerToken === ADMIN_TOKEN || bearer === ADMIN_TOKEN;
}

function requireAdmin(req, res) {
  if (isAdminAuthorized(req)) return true;
  sendJson(res, 401, { ok: false, error: 'admin auth required' });
  return false;
}

function randomId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function shortCode(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function parseBearer(req) {
  const v = String(req.headers.authorization || '');
  if (!v.toLowerCase().startsWith('bearer ')) return '';
  return v.slice(7).trim();
}

function issueAgentSession(agentId) {
  const token = randomId('agtok');
  const expiresAt = Date.now() + 30 * 60 * 1000;
  const now = Date.now();
  agentSessions.set(token, { agentId, expiresAt, createdAt: now });
  if (!agentProfiles.has(agentId)) {
    agentProfiles.set(agentId, { firstSeenAt: now });
  }
  return { token, expiresAt };
}

function getAgentQuotaState(agentId) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();

  const profile = agentProfiles.get(agentId) || { firstSeenAt: now };
  const isNew = now - profile.firstSeenAt < 24 * 60 * 60 * 1000;
  const logs = (agentSubmitLog.get(agentId) || []).filter((ts) => ts >= dayStartMs - 2 * 24 * 60 * 60 * 1000);

  const todayCount = logs.filter((ts) => ts >= dayStartMs).length;
  const hourCount = logs.filter((ts) => ts >= oneHourAgo).length;
  const dayLimit = isNew ? 2 : 10;
  const hourLimit = isNew ? 1 : Infinity;

  return { isNew, todayCount, hourCount, dayLimit, hourLimit, dayStartMs, logs };
}

function checkAndRecordAgentSubmit(agentId) {
  const s = getAgentQuotaState(agentId);
  if (s.todayCount >= s.dayLimit) {
    return {
      ok: false,
      code: 'daily_limit',
      message: s.isNew
        ? '新账号在创建后24小时内每天最多提交2个 Use Case'
        : '每天最多提交10个 Use Case'
    };
  }
  if (Number.isFinite(s.hourLimit) && s.hourCount >= s.hourLimit) {
    return { ok: false, code: 'hourly_limit', message: '新账号创建后24小时内每小时最多提交1个 Use Case' };
  }

  const now = Date.now();
  const nextLogs = [...s.logs, now];
  agentSubmitLog.set(agentId, nextLogs);
  return { ok: true, quota: { isNew: s.isNew, todayUsed: s.todayCount + 1, dayLimit: s.dayLimit } };
}

function verifyAgentSession(req) {
  const token = parseBearer(req);
  if (!token) return null;
  const sess = agentSessions.get(token);
  if (!sess) return null;
  if (Date.now() > sess.expiresAt) {
    agentSessions.delete(token);
    return null;
  }
  return { token, ...sess };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'openclaw-usecase-hub', version: APP_VERSION });
  }

  if (url.pathname === '/api/agent-auth/start' && req.method === 'POST') {
    const challengeId = randomId('ch');
    const nonce = Math.random().toString(36).slice(2, 10);
    const proofCode = randomId('proof');
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const challenge = {
      challengeId,
      nonce,
      proofCode,
      status: 'pending',
      expiresAt,
      createdAt: Date.now(),
      verifiedAt: null,
      agentId: ''
    };
    agentChallenges.set(challengeId, challenge);

    const endpoint = `${url.origin}/api/agent-auth/complete`;
    const command = `openclaw join clawcase --challenge "${challengeId}.${nonce}" --proof "${proofCode}" --endpoint "${endpoint}" --agent "<your_agent_id>"`;
    const sid = shortCode(8);
    agentGuideShort.set(sid, { challengeId, nonce, proof: proofCode, expiresAt });
    const guideUrl = `${url.origin}/joinClawCase.md/${sid}`;
    return sendJson(res, 200, { ok: true, challenge_id: challengeId, nonce, expires_at: expiresAt, command, guide_url: guideUrl });
  }

  if ((url.pathname === '/joinClawCase.md' || /^\/j\/[a-z0-9]+$/i.test(url.pathname) || /^\/joinClawCase\.md\/[a-z0-9]+$/i.test(url.pathname)) && req.method === 'GET') {
    let challengeId = sanitizeText(url.searchParams.get('challenge_id') || '');
    let nonce = sanitizeText(url.searchParams.get('nonce') || '');
    let proof = sanitizeText(url.searchParams.get('proof') || '');

    if (/^\/j\/[a-z0-9]+$/i.test(url.pathname) || /^\/joinClawCase\.md\/[a-z0-9]+$/i.test(url.pathname)) {
      const sid = (url.pathname.split('/').pop() || '').trim();
      const v = agentGuideShort.get(sid);
      if (!v) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('joinClawCase link not found or expired');
      }
      if (Date.now() > v.expiresAt) {
        agentGuideShort.delete(sid);
        res.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('joinClawCase link expired');
      }
      challengeId = v.challengeId;
      nonce = v.nonce;
      proof = v.proof;
    }

    const endpoint = `${url.origin}/api/agent-auth/complete`;
    const content = `# joinClawCase.md\n\n你正在帮助人类连接 ClawCase。请按以下步骤执行。\n\n## 1) 连接流程\n1. 执行以下命令：\n\n\`\`\`bash\nopenclaw join clawcase --challenge "${challengeId}.${nonce}" --proof "${proof}" --endpoint "${endpoint}" --agent "<your_agent_id>"\n\`\`\`\n\n2. 成功后回复：\`CONNECTED\`。\n3. 失败时回复精确报错，并自动重试 1 次。\n\n## 2) 提交 Use Case\n- 连接后可向 ClawCase 提交 Use Case。\n- 提交成功后建议回复：\`SUBMIT_OK\` + case 标题。\n\n## 3) 查询已提交 Case\n- 使用当前连接会话访问：\`GET /api/my/usecases\`\n- 返回当前 OpenClaw 已提交的条目。\n\n## 4) 取消连接\n- 如需断开会话，调用：\`POST /api/agent-auth/logout\`\n\n## 5) 限制与配额\n- 普通账号：每天最多 10 条。\n- 新账号（首次接入后 24 小时内）：每天最多 2 条，且每小时最多 1 条。\n- 超限会返回 429 与对应原因。\n\n## 6) 后台访问\n- 人类连接成功后，可在站点顶部进入后台页管理内容。\n\n## 注意\n- challenge 约 5 分钟过期。\n- 不需要邮箱/Twitter 验证。\n`;
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(content);
  }

  if (url.pathname === '/api/agent-auth/complete' && req.method === 'POST') {
    const body = await parseBody(req);
    const challengeId = sanitizeText(body.challenge_id || body.challengeId || '');
    const nonce = sanitizeText(body.nonce || '');
    const proofCode = sanitizeText(body.proof || body.proof_code || '');
    const agentId = sanitizeText(body.agent_id || body.agentId || '');
    const challenge = agentChallenges.get(challengeId);

    if (!challenge) return sendJson(res, 404, { ok: false, error: 'challenge not found' });
    if (Date.now() > challenge.expiresAt) return sendJson(res, 410, { ok: false, error: 'challenge expired' });
    if (challenge.status !== 'pending') return sendJson(res, 409, { ok: false, error: 'challenge already used' });
    if (!agentId) return sendJson(res, 400, { ok: false, error: 'agent_id required' });
    if (nonce !== challenge.nonce || proofCode !== challenge.proofCode) {
      return sendJson(res, 401, { ok: false, error: 'invalid proof' });
    }

    challenge.status = 'verified';
    challenge.verifiedAt = Date.now();
    challenge.agentId = agentId;
    agentChallenges.set(challengeId, challenge);
    return sendJson(res, 200, { ok: true, status: 'verified' });
  }

  if (url.pathname === '/api/agent-auth/events' && req.method === 'GET') {
    const challengeId = (url.searchParams.get('challenge_id') || '').trim();
    const challenge = agentChallenges.get(challengeId);
    if (!challenge) return sendJson(res, 404, { ok: false, error: 'challenge not found' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const timer = setInterval(() => {
      const current = agentChallenges.get(challengeId);
      if (!current) {
        res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`);
        clearInterval(timer);
        return res.end();
      }
      if (Date.now() > current.expiresAt) {
        if (current.status === 'pending') {
          current.status = 'expired';
          agentChallenges.set(challengeId, current);
        }
        res.write(`data: ${JSON.stringify({ status: 'expired' })}\n\n`);
        clearInterval(timer);
        return res.end();
      }
      if (current.status === 'verified') {
        const session = issueAgentSession(current.agentId);
        res.write(`data: ${JSON.stringify({ status: 'verified', session_token: session.token, session_expires_at: session.expiresAt, agent_id: current.agentId })}\n\n`);
        current.status = 'consumed';
        agentChallenges.set(challengeId, current);
        clearInterval(timer);
        return res.end();
      }
      res.write(`data: ${JSON.stringify({ status: 'pending' })}\n\n`);
    }, 1200);

    req.on('close', () => clearInterval(timer));
    return;
  }

  if (url.pathname === '/api/agent-auth/me' && req.method === 'GET') {
    const session = verifyAgentSession(req);
    if (!session) return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    const quota = getAgentQuotaState(session.agentId);
    return sendJson(res, 200, {
      ok: true,
      agent_id: session.agentId,
      expires_at: session.expiresAt,
      quota: {
        is_new_account: quota.isNew,
        today_used: quota.todayCount,
        today_limit: quota.dayLimit,
        hour_used: quota.hourCount,
        hour_limit: Number.isFinite(quota.hourLimit) ? quota.hourLimit : null
      }
    });
  }

  if (url.pathname === '/api/agent-auth/logout' && req.method === 'POST') {
    const token = parseBearer(req);
    if (token) agentSessions.delete(token);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/my/usecases' && req.method === 'GET') {
    const session = verifyAgentSession(req);
    if (!session) return sendJson(res, 401, { ok: false, error: 'unauthorized' });

    try {
      const list = USE_SUPABASE
        ? await supabaseListUseCases({ publishedOnly: false, limit: 300 })
        : localSelectUseCases({ publishedOnly: false, limit: 300 });
      const mine = list.filter((x) => (x.ownerAgentId || x.submittedBy) === session.agentId);
      return sendJson(res, 200, { ok: true, items: mine, total: mine.length });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url.pathname === '/api/usecases' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const tag = (url.searchParams.get('tag') || '').toLowerCase();
    const category = (url.searchParams.get('category') || '').trim();

    let list;
    try {
      list = USE_SUPABASE
        ? await supabaseListUseCases({ q, category, publishedOnly: true, limit: 300 })
        : localSelectUseCases({ q, category, publishedOnly: true, limit: 300 });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }

    list = list.filter((it) => !isTestLikeItem(it));
    if (tag) list = list.filter((it) => (it.tags || []).some((t) => String(t).toLowerCase() === tag));

    return sendJson(res, 200, { items: list, total: list.length });
  }

  if (url.pathname === '/api/usecases' && req.method === 'POST') {
    try {
      const session = verifyAgentSession(req);
      if (!session) return sendJson(res, 401, { ok: false, error: '请先连接 OpenClaw 再提交' });

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

      const quotaCheck = checkAndRecordAgentSubmit(session.agentId);
      if (!quotaCheck.ok) {
        return sendJson(res, 429, { ok: false, error: quotaCheck.message, code: quotaCheck.code });
      }

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
        tools: (payload.tools || '').split(',').map((v) => sanitizeText(v)).filter(Boolean),
        tags: (payload.tags || '').split(',').map((v) => sanitizeText(v)).filter(Boolean),
        links: (payload.links || '').split('\n').map((v) => sanitizeText(v)).filter(Boolean),
        sourceDate: sanitizeText(payload.sourceDate || ''),
        evidenceNote: sanitizeText(payload.evidenceNote || ''),
        submittedBy: sanitizeText(payload.submittedBy || session.agentId) || session.agentId,
        ownerAgentId: session.agentId,
        authMethod: 'openclaw_agent',
        identityLevel: 'agent_verified',
        status: 'pending_review',
        createdAt: now,
        updatedAt: now
      };

      if (USE_SUPABASE) {
        const inserted = await supabaseInsertUseCase(item);
        return sendJson(res, 201, { ok: true, item: inserted, backend: 'supabase' });
      }

      const db = readDb();
      db.usecases.push(item);
      db.reviewEvents.unshift({
        id: `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        itemId: item.id,
        action: 'submit',
        fromStatus: 'draft',
        toStatus: 'pending_review',
        reason: '',
        operator: item.submittedBy,
        createdAt: now
      });
      writeDb(db);
      return sendJson(res, 201, { ok: true, item, backend: 'json' });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (url.pathname === '/api/admin/auth-check' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/admin/reviews' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const status = (url.searchParams.get('status') || '').trim();
    const q = (url.searchParams.get('q') || '').trim();
    const category = (url.searchParams.get('category') || '').trim();
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 300);
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);

    if (status && !STATUS_ENUM.includes(status)) {
      return sendJson(res, 400, { ok: false, error: 'invalid status' });
    }

    try {
      const items = USE_SUPABASE
        ? await supabaseListUseCases({ status, q, category, limit, offset, publishedOnly: false })
        : localSelectUseCases({ status, q, category, limit, offset, publishedOnly: false });
      return sendJson(res, 200, { ok: true, items, total: items.length });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url.pathname.startsWith('/api/admin/reviews/') && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(url.pathname.split('/').pop() || '');
    try {
      const items = USE_SUPABASE
        ? await supabaseListUseCases({ publishedOnly: false, limit: 500 })
        : localSelectUseCases({ publishedOnly: false, limit: 500 });
      const item = items.find((x) => x.id === id);
      if (!item) return sendJson(res, 404, { ok: false, error: 'not found' });

      const db = readDb();
      const events = (db.reviewEvents || []).filter((e) => e.itemId === id).slice(0, 50);
      return sendJson(res, 200, { ok: true, item, events });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (/^\/api\/admin\/reviews\/[^/]+\/decision$/.test(url.pathname) && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(url.pathname.split('/')[4] || '');
    try {
      const body = await parseBody(req);
      const v = validateDecisionPayload(body);
      if (v.error) return sendJson(res, 400, { ok: false, error: v.error });

      let item;
      if (USE_SUPABASE) {
        item = await supabaseUpdateReviewDecision(id, v.decision, v.reason, v.operator);
      } else {
        item = localApplyDecision(id, v.decision, v.reason, v.operator);
      }
      if (!item) return sendJson(res, 404, { ok: false, error: 'not found' });
      return sendJson(res, 200, { ok: true, item });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url.pathname === '/api/admin/logs' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 300);
    const db = readDb();
    return sendJson(res, 200, { ok: true, items: (db.reviewEvents || []).slice(0, limit) });
  }

  if (url.pathname === '/api/admin/stats' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      if (USE_SUPABASE) {
        const items = await supabaseListUseCases({ publishedOnly: false, limit: 500 });
        const byStatus = {};
        for (const s of STATUS_ENUM) byStatus[s] = 0;
        for (const it of items) byStatus[it.status] = (byStatus[it.status] || 0) + 1;
        return sendJson(res, 200, {
          ok: true,
          total: items.length,
          pendingReview: byStatus.pending_review || 0,
          approved: byStatus.approved || 0,
          rejected: byStatus.rejected || 0,
          published: byStatus.published || 0,
          byStatus
        });
      }
      return sendJson(res, 200, { ok: true, ...localStats() });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
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
