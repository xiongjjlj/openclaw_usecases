const app = document.getElementById('app');
let cache = [];
let currentCategory = '';
let currentSort = 'popular';
let currentView = 'grid';

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
  const hash = location.hash || '#/';
  const [, , id] = hash.match(/^#\/(|usecase\/([^/]+)|submit)$/) || [];
  if (hash.startsWith('#/usecase/')) return renderDetail(id);
  if (hash === '#/submit') return renderSubmit();
  if (hash === '#/connect') return renderConnect();
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

async function renderHome() {
  app.innerHTML = '';
  const node = document.getElementById('homeTpl').content.cloneNode(true);
  app.appendChild(node);

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '提交中...';
    const payload = Object.fromEntries(new FormData(form).entries());

    const res = await fetch('/api/usecases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        clearInterval(timer);
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
