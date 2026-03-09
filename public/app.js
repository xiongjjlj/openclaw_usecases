const app = document.getElementById('app');
let cache = [];
let currentCategory = '';
let currentSort = 'popular';
let currentView = 'grid';

function fmtDate(s) {
  return new Date(s).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function esc(s = '') {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function getUseCases(q = '', tag = '', category = '') {
  const res = await fetch(`/api/usecases?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&category=${encodeURIComponent(category)}`);
  const data = await res.json();
  return data.items || [];
}

function route() {
  const hash = location.hash || '#/';
  const [, , id] = hash.match(/^#\/(|usecase\/([^/]+)|submit)$/) || [];
  if (hash.startsWith('#/usecase/')) return renderDetail(id);
  if (hash === '#/submit') return renderSubmit();
  return renderHome();
}

function renderCategoryTabs(container, allItems, onChange) {
  const preferred = ['交易与预测市场', '运维与部署', '移动与可穿戴', '通信与号码 Bot', '多代理协作'];
  const existed = [...new Set(allItems.map((x) => x.category || 'General'))];
  const ordered = [...preferred.filter((x) => existed.includes(x)), ...existed.filter((x) => !preferred.includes(x))];
  const categories = ['全部', ...ordered];
  container.innerHTML = '';
  categories.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = `tab ${((c === '全部' && !currentCategory) || c === currentCategory) ? 'active' : ''}`;
    btn.textContent = c;
    btn.addEventListener('click', () => {
      currentCategory = c === '全部' ? '' : c;
      onChange();
    });
    container.appendChild(btn);
  });
}

function renderSortTabs(container, onChange) {
  const sorts = [
    { key: 'trending', label: 'Trending' },
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

function trendingScore(item) {
  const ageHours = Math.max(1, (Date.now() - new Date(item.createdAt).getTime()) / 36e5);
  return popularScore(item) + 120 / ageHours;
}

function sortUseCases(list) {
  if (currentSort === 'new') {
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  if (currentSort === 'trending') {
    return [...list].sort((a, b) => trendingScore(b) - trendingScore(a));
  }
  return [...list].sort((a, b) => popularScore(b) - popularScore(a));
}

async function renderHome() {
  app.innerHTML = '';
  const node = document.getElementById('homeTpl').content.cloneNode(true);
  app.appendChild(node);

  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('searchInput');
  const tagInput = document.getElementById('tagInput');
  const categoryTabs = document.getElementById('categoryTabs');
  const sortTabs = document.getElementById('sortTabs');
  const viewToggle = document.getElementById('viewToggle');
  const all = await getUseCases();

  async function paint() {
    const list = await getUseCases(searchInput.value.trim(), tagInput.value.trim(), currentCategory);
    cache = sortUseCases(list);
    renderSortTabs(sortTabs, paint);
    renderCategoryTabs(categoryTabs, all, paint);

    grid.innerHTML = '';
    if (!cache.length) {
      grid.innerHTML = '<p>暂无用例，换个分类或关键词试试。</p>';
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
      card.querySelector('.meta').textContent = `[${item.category || 'General'}] ${(item.tags || []).slice(0, 3).map((t) => `#${t}`).join(' ')}`;
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
  }

  viewToggle.addEventListener('click', () => {
    currentView = currentView === 'grid' ? 'list' : 'grid';
    viewToggle.textContent = currentView === 'grid' ? 'View: Grid' : 'View: List';
    paint();
  });

  searchInput.addEventListener('input', paint);
  tagInput.addEventListener('input', paint);
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
  node.querySelector('.dPrompt').textContent = item.reproPrompt;
  node.querySelector('.dReproMode').textContent = item.reproMode || 'semi-auto（部分自动 + 人工步骤）';
  node.querySelector('.dManual').textContent = item.manualSteps || '该案例可主要通过 Prompt 自动复现，无额外手动步骤。';

  const meta = node.querySelector('.detailMeta');
  meta.innerHTML = `
    <p>${esc(item.submittedBy || 'anonymous')} · ${new Date(item.createdAt).toLocaleString()}</p>
    <p>分类：<strong>${esc(item.category || 'General')}</strong></p>
    <p>${(item.tags || []).map((t) => `<span>#${esc(t)}</span>`).join(' ')}</p>
    <p>${(item.tools || []).map((t) => `<code>${esc(t)}</code>`).join(' ')}</p>
  `;

  const ul = node.querySelector('.dLinks');
  (item.links || []).forEach((l) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${esc(l)}" target="_blank" rel="noreferrer">${esc(l)}</a>`;
    ul.appendChild(li);
  });
  const sourceText = [
    item.sourceDate ? `来源日期：${esc(item.sourceDate)}` : '',
    item.evidenceNote ? `说明：${esc(item.evidenceNote)}` : ''
  ].filter(Boolean).join('；');
  node.querySelector('.dSource').textContent = sourceText || '未标注来源说明';
  node.querySelector('.dExtract').textContent = item.sourceExtract || '未抓取到原帖正文摘录（链接可能受平台限制）。';

  node.querySelector('.copyBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(item.reproPrompt);
    alert('Prompt 已复制');
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
      return;
    }
    msg.textContent = '提交成功 ✅';
    form.reset();
  });
}

window.addEventListener('hashchange', route);
route();
