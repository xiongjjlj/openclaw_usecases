const app = document.getElementById('app');
let cache = [];
let currentCategory = '';
let currentSort = 'popular';
let currentView = 'grid';

const ADMIN_TOKEN_KEY = 'clawcase_admin_token';

function getAdminToken() {
  return (localStorage.getItem(ADMIN_TOKEN_KEY) || '').trim();
}

function setAdminToken(token) {
  if (token && token.trim()) localStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
}

async function adminFetch(url, options = {}) {
  const token = getAdminToken();
  const headers = { ...(options.headers || {}), 'x-admin-token': token };
  return fetch(url, { ...options, headers });
}
let agentSessionToken = localStorage.getItem('clawcase_agent_token') || '';
let agentId = localStorage.getItem('clawcase_agent_id') || '';

const BUILD_VERSION = 'v0.5.0-dev+20260310.1811';
const buildVersionEl = document.getElementById('buildVersion');
if (buildVersionEl) buildVersionEl.textContent = BUILD_VERSION;


function isConnected() {
  return localStorage.getItem('clawcase_connected') === '1' || Boolean(agentSessionToken);
}

function applyConnectionLabels() {
  const heroBtn = document.getElementById('heroConnectSubmitBtn');
  if (heroBtn) {
    if (isConnected()) {
      heroBtn.textContent = '☑️ 已连接OpenClaw';
    } else {
      heroBtn.textContent = '连接 OpenClaw，提交 UseCase';
    }
  }
}

function fmtDate(s) {
  return new Date(s).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function getUseCases(q = '', tag = '', category = '') {
  const res = await fetch(`/api/usecases?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&category=${encodeURIComponent(category)}`);
  if (!res.ok) throw new Error('加载失败');
  const data = await res.json();
  return data.items || [];
}

function route() {
  applyConnectionLabels();
  const hash = location.hash || '#/';
  const [, , id] = hash.match(/^#\/(|usecase\/([^/]+)|submit|admin)$/) || [];
  if (hash.startsWith('#/usecase/')) return renderDetail(id);
  if (hash === '#/submit') return renderSubmit();
  if (hash === '#/connect') return renderConnect();
  if (hash === '#/admin') return renderAdmin();
  return renderHome();
}

function renderCategoryTabs(container, allItems, onChange) {
  const preferred = ['办公与效率', '运维与自动化', '研究与交易', '移动与硬件', '开发与构建', '其他'];
  const existed = [...new Set(allItems.map((x) => x.category || '其他'))];
  const ordered = [...preferred.filter((x) => existed.includes(x)), ...existed.filter((x) => !preferred.includes(x))];
  const categories = ['全部', ...ordered];
  container.innerHTML = '';
  categories.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = `tab ${((c === '全部' && !currentCategory) || c === currentCategory) ? 'active' : ''}`;
    btn.textContent = c;
    btn.addEventListener('click', () => {
      if (c === '全部') {
        currentCategory = '';
      } else if (currentCategory === c) {
        currentCategory = '';
      } else {
        currentCategory = c;
      }
      onChange();
    });
    container.appendChild(btn);
  });
}

function renderSortTabs(container, onChange) {
  const sorts = [
    { key: 'popular', label: 'Popular' },
    { key: 'new', label: 'New' }
  ];
  container.innerHTML = '';
  sorts.forEach((s) => {
    const btn = document.createElement('button');
    btn.className = `tab ${currentSort === s.key ? 'active' : ''}`;
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      currentSort = s.key;
      onChange();
    });
    container.appendChild(btn);
  });
}

const POPULARITY_PRIOR = {
  uc_beeclaw_trading: 98,
  uc_polymarket: 92,
  uc_mission_control: 88,
  uc_multi_cua: 85,
  uc_bot_number: 83,
  uc_visionclaw: 82,
  uc_phone: 79,
  uc_qualify_template: 76
};

function popularScore(item) {
  const prior = POPULARITY_PRIOR[item.id] || 50;
  const depth = ((item.tags || []).length * 1.5) + ((item.tools || []).length * 1.2);
  return prior + depth;
}

function sortUseCases(list) {
  if (currentSort === 'new') {
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return [...list].sort((a, b) => popularScore(b) - popularScore(a));
}

function renderActiveFilters(container, searchValue) {
  const chips = [];
  if (searchValue) chips.push(`搜索: ${searchValue}`);
  if (currentCategory) chips.push(`分类: ${currentCategory}`);
  container.innerHTML = chips.map((x) => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="chip muted">当前无筛选</span>';
}

function bindConnectInline() {
  const heroBtn = document.getElementById('heroConnectSubmitBtn');
  const panel = document.getElementById('connectInline');
  const loading = document.getElementById('connectLoading');
  const cmd = document.getElementById('connectCommand');
  const status = document.getElementById('connectStatusText');
  const copyBtn = document.getElementById('copyConnectCmd');
  const goSubmit = document.getElementById('goSubmitAfterConnect');
  const cancelBtn = document.getElementById('connectCancelBtn');
  if (!heroBtn || !panel) return;

  let es = null;
  cancelBtn?.addEventListener('click', () => {
    if (es) es.close();
    panel.hidden = true;
    heroBtn.style.display = 'inline-flex';
    heroBtn.classList.remove('connectPulse', 'connectDissolve');
  });

  heroBtn.addEventListener('click', async () => {
    heroBtn.classList.add('connectPulse');
    await new Promise((r) => setTimeout(r, 420));
    heroBtn.classList.remove('connectPulse');
    heroBtn.classList.add('connectDissolve');
    await new Promise((r) => setTimeout(r, 280));
    heroBtn.style.display = 'none';
    panel.hidden = false;
    loading.hidden = true;
    status.classList.remove('connectDone');

    try {
      const res = await fetch('/api/agent-auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: 'web', version: '1' })
      });
      const data = await res.json();
      if (!res.ok) {
        loading.hidden = true;
        status.textContent = `状态：失败（${data.error || 'unknown'}）`;
        return;
      }

      const brief = `请你阅读这一篇文档,并按照文档的方式连接ClawCase。\n${data.guide_url || ''}`;
      cmd.textContent = brief;
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(brief);
        copyBtn.textContent = '已复制';
        setTimeout(() => (copyBtn.textContent = '复制给 OpenClaw'), 1200);
      };

      es = new EventSource(`/api/agent-auth/events?challenge_id=${encodeURIComponent(data.challenge_id)}`);
      es.onmessage = (evt) => {
        const p = JSON.parse(evt.data || '{}');
        if (p.status === 'pending') {
          return;
        }
        if (p.status === 'expired') {
          loading.hidden = true;
          status.textContent = '状态：连接已过期，请重试';
          es.close();
          return;
        }
        if (p.status === 'verified') {
          loading.hidden = true;
          agentSessionToken = p.session_token || '';
          agentId = p.agent_id || '';
          localStorage.setItem('clawcase_agent_token', agentSessionToken);
          localStorage.setItem('clawcase_agent_id', agentId);
          localStorage.setItem('clawcase_connected', '1');
          goSubmit.style.display = 'inline-flex';
          applyConnectionLabels();
          es.close();
          location.hash = '#/submit';
        }
      };
      es.onerror = () => {
        loading.hidden = true;
        status.textContent = '状态：连接中断，请重试';
        es.close();
      };
    } catch (e) {
      loading.hidden = true;
      status.textContent = `状态：失败（${e.message || 'network error'}）`;
    }
  });
}

async function renderHome() {
  app.innerHTML = '';
  const node = document.getElementById('homeTpl').content.cloneNode(true);
  app.appendChild(node);
  applyConnectionLabels();
  bindConnectInline();

  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('searchInput');
  const categoryTabs = document.getElementById('categoryTabs');
  const sortTabs = document.getElementById('sortTabs');
  const viewToggle = document.getElementById('viewToggle');
  const activeFilters = document.getElementById('activeFilters');
  const clearFilters = document.getElementById('clearFilters');

  let all = [];
  try {
    all = await getUseCases();
  } catch {
    grid.innerHTML = '<p class="statusError">加载失败，请刷新重试。</p>';
    return;
  }

  async function paint() {
    grid.innerHTML = '<p class="statusLoading">加载中...</p>';
    try {
      const list = await getUseCases(searchInput.value.trim(), '', currentCategory);
      cache = sortUseCases(list);
      renderSortTabs(sortTabs, paint);
      renderCategoryTabs(categoryTabs, all, paint);
      renderActiveFilters(activeFilters, searchInput.value.trim());

      grid.innerHTML = '';
      if (!cache.length) {
        grid.innerHTML = '<p class="statusEmpty">未找到结果，试试更换关键词或清空筛选。</p>';
        return;
      }

      const cards = document.createElement('div');
      cards.className = currentView === 'grid' ? 'grid' : 'listView';
      for (const item of cache) {
        const card = document.getElementById('cardTpl').content.cloneNode(true);
        card.querySelector('.title').textContent = item.title;
        card.querySelector('.date').textContent = fmtDate(item.createdAt);
        card.querySelector('.summary').textContent = item.summary;
        const cardEl = card.querySelector('.card');
        card.querySelector('.meta').textContent = `[${item.category || '其他'}] ${(item.tags || []).slice(0, 3).map((t) => `#${t}`).join(' ')}`;
        cardEl.style.cursor = 'pointer';
        cardEl.tabIndex = 0;
        cardEl.addEventListener('click', () => { location.hash = `#/usecase/${item.id}`; });
        cardEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            location.hash = `#/usecase/${item.id}`;
          }
        });
        cards.appendChild(card);
      }
      grid.appendChild(cards);
    } catch {
      grid.innerHTML = '<p class="statusError">加载失败，请稍后重试。</p>';
    }
  }

  viewToggle.addEventListener('click', () => {
    currentView = currentView === 'grid' ? 'list' : 'grid';
    viewToggle.textContent = currentView === 'grid' ? '☰ 切换为列表' : '▦ 切换为网格';
    paint();
  });

  clearFilters.addEventListener('click', () => {
    searchInput.value = '';
    currentCategory = '';
    paint();
  });

  searchInput.addEventListener('input', paint);
  await paint();
}

async function renderDetail(id) {
  if (!cache.length) cache = await getUseCases();
  const item = cache.find((x) => x.id === id) || (await getUseCases()).find((x) => x.id === id);

  app.innerHTML = '';
  if (!item) {
    app.innerHTML = '<p>用例不存在，<a href="#/">返回首页</a></p>';
    return;
  }

  const node = document.getElementById('detailTpl').content.cloneNode(true);
  node.querySelector('.dTitle').textContent = item.title;
  node.querySelector('.dSummary').textContent = item.summary;
  node.querySelector('.dProblem').textContent = item.problem;
  node.querySelector('.dWorkflow').textContent = item.workflow;
  node.querySelector('.dReproMode').textContent = item.reproMode || 'semi-auto（部分自动 + 人工步骤）';

  const promptEl = node.querySelector('.dPrompt');
  const promptTitle = promptEl.previousElementSibling;
  if (item.reproPrompt && item.reproPrompt.trim()) {
    promptEl.textContent = item.reproPrompt;
  } else {
    promptTitle.style.display = 'none';
    promptEl.style.display = 'none';
    node.querySelector('.copyBtn').style.display = 'none';
  }

  const manualEl = node.querySelector('.dManual');
  const manualTitle = manualEl.previousElementSibling;
  if (item.manualSteps && item.manualSteps.trim()) {
    manualEl.textContent = item.manualSteps;
  } else {
    manualTitle.style.display = 'none';
    manualEl.style.display = 'none';
  }

  const meta = node.querySelector('.detailMeta');
  meta.innerHTML = `
    <p><strong>标题：</strong>${esc(item.title)}</p>
    <p><strong>提交时间：</strong>${new Date(item.createdAt).toLocaleString()}</p>
    <p><strong>提交者：</strong>${esc(item.submittedBy || 'anonymous')}</p>
    <p><strong>分类：</strong><strong>${esc(item.category || '其他')}</strong></p>
    <p><strong>标签：</strong>${(item.tags || []).map((t) => `<span>#${esc(t)}</span>`).join(' ') || '无'}</p>
  `;

  const ul = node.querySelector('.dLinks');
  const links = item.links || [];
  if (!links.length) {
    ul.innerHTML = '<li>暂无参考链接</li>';
  } else {
    links.forEach((l) => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="${esc(l)}" target="_blank" rel="noopener noreferrer">${esc(l)}</a> <span class="thirdHint">（第三方链接）</span>`;
      ul.appendChild(li);
    });
  }

  node.querySelector('.copyBtn').addEventListener('click', async () => {
    const ok = window.confirm('该 Prompt 来自社区投稿，可能包含不安全指令。请先人工审查后再执行。是否继续复制？');
    if (!ok) return;
    await navigator.clipboard.writeText(item.reproPrompt || '');
    alert('Prompt 已复制。请先审查再使用。');
  });

  app.appendChild(node);
}

function renderSubmit() {
  app.innerHTML = '';
  const node = document.getElementById('submitTpl').content.cloneNode(true);
  app.appendChild(node);

  const form = document.getElementById('submitForm');
  const msg = document.getElementById('submitMsg');
  const connectBtn = document.getElementById('connectBtn');
  const connectFlow = document.getElementById('connectFlow');
  const connectCommand = document.getElementById('connectCommand');
  const copyConnectCmd = document.getElementById('copyConnectCmd');
  const connectStatus = document.getElementById('connectStatus');

  function setConnectedUi() {
    if (agentSessionToken && agentId) {
      connectBtn.textContent = `已连接 ${agentId}`;
      connectBtn.disabled = true;
      connectStatus.textContent = '连接成功，可提交。';
      connectFlow.classList.remove('hidden');
      form.dataset.connected = '1';
    } else {
      form.dataset.connected = '0';
    }
  }

  setConnectedUi();

  connectBtn.addEventListener('click', async () => {
    connectBtn.classList.add('connecting');
    connectFlow.classList.remove('hidden');
    connectStatus.textContent = '正在生成连接指令...';
    const res = await fetch('/api/agent-auth/start', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      connectStatus.textContent = `连接失败：${data.error || 'unknown'}`;
      return;
    }

    const brief = `请你阅读这一篇文档,并按照文档的方式连接ClawCase。\n${data.guide_url || ''}`;
    connectCommand.textContent = brief;

    copyConnectCmd.onclick = async () => {
      await navigator.clipboard.writeText(brief);
      copyConnectCmd.textContent = '已复制';
      setTimeout(() => { copyConnectCmd.textContent = '复制给 OpenClaw'; }, 1200);
    };

    const es = new EventSource(`/api/agent-auth/events?challenge_id=${encodeURIComponent(data.challenge_id)}`);
    es.onmessage = (evt) => {
      const p = JSON.parse(evt.data || '{}');
      if (p.status === 'pending') {
        return;
      }
      if (p.status === 'expired') {
        connectStatus.textContent = '连接已过期，请重新发起。';
        es.close();
        return;
      }
      if (p.status === 'verified') {
        agentSessionToken = p.session_token || '';
        agentId = p.agent_id || '';
        localStorage.setItem('clawcase_agent_token', agentSessionToken);
        localStorage.setItem('clawcase_agent_id', agentId);
        connectBtn.classList.remove('connecting');
        setConnectedUi();
        es.close();
        location.hash = '#/submit';
      }
    };
    es.onerror = () => {
      connectStatus.textContent = '连接中断，请重试。';
      es.close();
    };
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!agentSessionToken) {
      msg.textContent = '请先连接 OpenClaw';
      msg.className = 'err';
      return;
    }

    msg.textContent = '提交中...';
    const payload = Object.fromEntries(new FormData(form).entries());

    const res = await fetch('/api/usecases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentSessionToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = `提交失败：${data.error || '未知错误'}`;
      msg.className = 'err';
      return;
    }
    msg.textContent = '提交成功 ✅（已进入审核队列）';
    msg.className = 'ok';
    form.reset();
  });
}

window.addEventListener('hashchange', route);
applyConnectionLabels();
route();

function renderConnect() {
  app.innerHTML = '';
  const node = document.getElementById('connectTpl').content.cloneNode(true);
  app.appendChild(node);

  const startBtn = document.getElementById('startLinkBtn');
  const codeBox = document.getElementById('linkCodeBox');
  const statusEl = document.getElementById('linkStatus');

  let timer = null;

  async function poll(code) {
    if (timer) clearInterval(timer);
    timer = setInterval(async () => {
      const res = await fetch(`/api/auth/link/status?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      statusEl.textContent = `状态：${data.status || 'pending'}`;
      if (data.status === 'linked') {
        localStorage.setItem('clawcase_connected', '1');
        clearInterval(timer);
        applyConnectionLabels();
      }
    }, 2500);
  }

  startBtn.addEventListener('click', async () => {
    const res = await fetch('/api/auth/link/start', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = `状态：失败（${data.error || 'unknown'}）`;
      return;
    }
    codeBox.textContent = data.code;
    statusEl.textContent = '状态：等待 OpenClaw 认领';
    poll(data.code);
  });
}

async function renderAdmin() {
  app.innerHTML = '';
  const node = document.getElementById('adminTpl').content.cloneNode(true);
  app.appendChild(node);

  const statBox = document.getElementById('adminStats');
  const listBox = document.getElementById('adminList');
  const statusFilter = document.getElementById('adminStatus');
  const refreshBtn = document.getElementById('adminRefresh');
  const saveTokenBtn = document.getElementById('adminSaveTokenBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const tokenInput = document.getElementById('adminTokenInput');
  tokenInput.value = getAdminToken();

  async function ensureAuth() {
    const token = getAdminToken();
    if (!token) return false;

    const check = await adminFetch('/api/admin/auth-check');
    if (check.ok) return true;

    localStorage.removeItem(ADMIN_TOKEN_KEY);
    tokenInput.value = '';
    return false;
  }

  async function load() {
    statBox.textContent = '加载中...';
    listBox.innerHTML = '<p class="statusLoading">加载中...</p>';

    const [statsRes, listRes] = await Promise.all([
      adminFetch('/api/admin/stats'),
      adminFetch(`/api/admin/reviews?limit=50${statusFilter.value ? `&status=${encodeURIComponent(statusFilter.value)}` : ''}`)
    ]);

    if (statsRes.status === 401 || listRes.status === 401) {
      statBox.textContent = '未授权';
      listBox.innerHTML = '<p class="statusError">你没有访问后台的权限</p>';
      return;
    }

    const stats = await statsRes.json();
    const listData = await listRes.json();

    if (!statsRes.ok || !listRes.ok) {
      statBox.textContent = '加载失败';
      listBox.innerHTML = '<p class="statusError">后台数据加载失败</p>';
      return;
    }

    statBox.textContent = `总数 ${stats.total}｜待审 ${stats.pendingReview}｜通过 ${stats.approved}｜驳回 ${stats.rejected}｜已发布 ${stats.published}`;

    const items = listData.items || [];
    if (!items.length) {
      listBox.innerHTML = '<p class="statusEmpty">当前筛选下无数据</p>';
      return;
    }

    listBox.innerHTML = items.map((it) => `
      <article class="card adminCard" data-id="${esc(it.id)}">
        <div class="cardTop">
          <h3 class="title">${esc(it.title)}</h3>
          <span class="date">${esc(it.status || '-')}</span>
        </div>
        <p class="summary">${esc(it.summary || '')}</p>
        <div class="meta">提交者：${esc(it.submittedBy || 'anonymous')}｜${new Date(it.createdAt).toLocaleString()}</div>
        <div class="filterBar" style="margin-top:10px; gap:8px;">
          <button class="btn" data-act="approve" data-id="${esc(it.id)}">通过</button>
          <button class="btn" data-act="reject" data-id="${esc(it.id)}">驳回</button>
          <button class="btn" data-act="request_changes" data-id="${esc(it.id)}">退回修改</button>
        </div>
      </article>
    `).join('');
  }

  listBox.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-act');
    const reason = prompt('可选：填写审核备注/原因', '') || '';

    btn.disabled = true;
    try {
      const res = await adminFetch(`/api/admin/reviews/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: action, reason, operator: 'bear-admin' })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`操作失败：${data.error || 'unknown'}`);
        return;
      }
      await load();
    } finally {
      btn.disabled = false;
    }
  });

  saveTokenBtn.addEventListener('click', async () => {
    const token = (tokenInput.value || '').trim();
    if (!token) {
      alert('请先输入后台口令');
      return;
    }
    setAdminToken(token);
    const ok = await ensureAuth();
    if (!ok) {
      alert('口令不正确，请重试');
      return;
    }
    await load();
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    tokenInput.value = '';
    statBox.textContent = '已清除口令';
    listBox.innerHTML = '<p class="statusEmpty">请先输入后台口令</p>';
  });

  refreshBtn.addEventListener('click', load);
  statusFilter.addEventListener('change', load);

  const authed = await ensureAuth();
  if (!authed) {
    statBox.textContent = '未登录';
    listBox.innerHTML = '<p class="statusEmpty">请先登录后台</p>';
    return;
  }
  await load();
}
