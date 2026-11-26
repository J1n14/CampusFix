(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const state = { requests: [], page: 'dashboard', owned: new Set(JSON.parse(localStorage.getItem('campusfixOwned') || '[]')) };
  const api = async (url, options) => {
    const response = await fetch(url, options);
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };
  const statusLabel = (s) => ({ open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }[s] || 'Open');
  const categoryLabel = (s) => ({ lighting: 'Lighting', plumbing: 'Plumbing', furniture: 'Furniture', other: 'Other' }[s] || s || 'Other');
  const priorityLabel = (s) => ({ high: 'High priority', medium: 'Medium priority', low: 'Low priority' }[s] || 'Priority not set');
  const dateLabel = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d); };
  const badge = (s) => `<span class="badge ${esc(s || 'open')}">${esc(statusLabel(s))}</span>`;
  const requestRow = (r) => `<article class="request-row" tabindex="0" role="button" data-request="${esc(r.id)}"><div><div class="request-title">${esc(r.title || categoryLabel(r.issue_type) + ' issue')}</div><div class="request-sub">⌖ ${esc(r.location)} <span>•</span> ${esc(categoryLabel(r.issue_type))} <span>•</span> ${esc(dateLabel(r.created_at))}</div></div><div class="row-right">${badge(r.status)}<div class="priority ${esc(r.priority || '')}">${esc(priorityLabel(r.priority))}</div></div></article>`;
  const empty = (title, detail) => `<div class="empty"><div class="empty-icon">✳</div><b>${esc(title)}</b><p>${esc(detail)}</p></div>`;
  const showToast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3200); };
  async function load() {
    $('#recentList').innerHTML = '<div class="loading">Loading campus requests…</div>';
    try {
      state.requests = await api('/api/requests?sort=newest');
      renderDashboard(); renderAll(); renderMine();
      const summary = await api('/api/summary');
      $('#countTotal').textContent = summary.total ?? 0;
      $('#countOpen').textContent = summary.open ?? 0;
      $('#countProgress').textContent = summary.in_progress ?? 0;
      $('#countResolved').textContent = summary.resolved ?? 0;
    } catch (err) {
      $$('.request-list').forEach(el => el.innerHTML = `<div class="error-msg">${esc(err.message)}. Check the server and database connection, then <button class="text-btn" id="retry">try again</button>.</div>`);
      $('#retry')?.addEventListener('click', load);
    }
  }
  function filtered({ search = '', status = '', category = '', sort = 'newest' } = {}) {
    const q = search.trim().toLowerCase();
    let rows = state.requests.filter(r => (!q || `${r.title || ''} ${r.location || ''} ${r.description || ''}`.toLowerCase().includes(q)) && (!status || r.status === status) && (!category || r.issue_type === category));
    if (sort === 'priority') { const rank = { high: 0, medium: 1, low: 2 }; rows = [...rows].sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)); }
    else rows = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows;
  }
  function renderDashboard() {
    const rows = filtered({ search: $('#dashSearch')?.value || '', status: $('#dashStatus')?.value || '' }).slice(0, 5);
    $('#recentList').innerHTML = rows.length ? rows.map(requestRow).join('') : empty('Nothing to show yet', 'Be the first to report a campus issue.');
    const latest = [...state.requests].sort((a,b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)).slice(0, 4);
    $('#activityList').innerHTML = latest.length ? latest.map(r => `<div class="activity-item"><div class="activity-icon">${r.status === 'resolved' ? '✓' : r.status === 'in_progress' ? '⚒' : '＋'}</div><div><p><b>${esc(r.title || categoryLabel(r.issue_type))}</b> ${r.status === 'resolved' ? 'was resolved' : r.status === 'in_progress' ? 'is being worked on' : 'was reported'}.</p><small>${esc(r.location)} · ${esc(dateLabel(r.updated_at || r.created_at))}</small></div></div>`).join('') : `<div class="activity-item"><div class="activity-icon">✳</div><div><p><b>CampusFix is ready.</b> New reports will appear here.</p><small>Campus community activity</small></div></div>`;
  }
  function renderAll() {
    const rows = filtered({ search: $('#allSearch')?.value || '', status: $('#allStatus')?.value || '', category: $('#allCategory')?.value || '', sort: $('#allSort')?.value || 'newest' });
    $('#allList').innerHTML = rows.length ? rows.map(requestRow).join('') : empty('No matching requests', 'Try another filter or report a new issue.');
  }
  function renderMine() {
    const rows = state.requests.filter(r => state.owned.has(String(r.id)));
    $('#mineList').innerHTML = rows.length ? rows.map(requestRow).join('') : empty('Your reports will show up here', 'When you submit a report in this browser, you can track it here.');
  }
  function go(page) {
    state.page = page;
    $$('.page-section').forEach(el => el.classList.toggle('visible', el.id === `${page}Page`));
    $$('.nav button').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    $('#crumbTitle').textContent = ({ dashboard: 'Overview', requests: 'All requests', mine: 'My reports', detail: 'Request details' })[page] || 'Overview';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function openDetail(id) {
    go('detail');
    const panel = $('#detailPanel'); panel.innerHTML = '<div class="loading">Loading request…</div>';
    try {
      const r = await api(`/api/requests/${encodeURIComponent(id)}`);
      panel.innerHTML = `<div class="detail"><div>${badge(r.status)} <span class="priority ${esc(r.priority || '')}">${esc(priorityLabel(r.priority))}</span></div><h2 class="detail-title">${esc(r.title || categoryLabel(r.issue_type) + ' issue')}</h2><p class="detail-description">${esc(r.description || 'No additional details were provided.')}</p><div class="detail-grid"><div><small>LOCATION</small><b>⌖ ${esc(r.location)}</b></div><div><small>CATEGORY</small><b>${esc(categoryLabel(r.issue_type))}</b></div><div><small>REPORTED</small><b>${esc(dateLabel(r.created_at))}</b></div><div><small>REQUEST NUMBER</small><b>#${esc(String(r.id).slice(0, 8).toUpperCase())}</b></div></div><h3 style="font:700 14px Manrope">Progress</h3><div class="timeline"><p><b>Report received</b>${esc(dateLabel(r.created_at))}</p><p><b>${r.status === 'open' ? 'Awaiting facilities review' : r.status === 'in_progress' ? 'Work is in progress' : 'Issue resolved'}</b>${esc(statusLabel(r.status))}</p></div></div>`;
    } catch (err) { panel.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
  }
  function modal(open) { $('#reportModal').classList.toggle('open', open); if (open) setTimeout(() => $('#title').focus(), 50); else $('#formError').textContent = ''; }
  $$('.nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => go(b.dataset.goto)));
  $$('.report-open').forEach(b => b.addEventListener('click', () => modal(true)));
  $('#closeModal').addEventListener('click', () => modal(false)); $('#cancelModal').addEventListener('click', () => modal(false));
  $('#reportModal').addEventListener('click', e => { if (e.target === $('#reportModal')) modal(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') modal(false); });
  $('#dashSearch').addEventListener('input', renderDashboard); $('#dashStatus').addEventListener('change', renderDashboard);
  ['allSearch','allStatus','allCategory','allSort'].forEach(id => $(`#${id}`).addEventListener(id === 'allSearch' ? 'input' : 'change', renderAll));
  document.addEventListener('click', e => { const row = e.target.closest('[data-request]'); if (row) openDetail(row.dataset.request); });
  document.addEventListener('keydown', e => { const row = e.target.closest?.('[data-request]'); if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(row.dataset.request); } });
  $('#reportForm').addEventListener('submit', async e => {
    e.preventDefault(); const form = e.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    for (const key of ['title','location','issue_type','priority','description']) if (typeof values[key] === 'string') values[key] = values[key].trim();
    if (Object.values(values).some(v => !v)) { $('#formError').textContent = 'Please complete all required fields.'; return; }
    $('#formError').textContent = ''; const btn = $('#submitBtn'); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const created = await api('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      state.owned.add(String(created.id)); localStorage.setItem('campusfixOwned', JSON.stringify([...state.owned]));
      modal(false); form.reset(); showToast(`Report received · #${String(created.id).slice(0, 8).toUpperCase()}`); await load(); openDetail(created.id);
    } catch (err) { $('#formError').textContent = err.message || 'Could not send your report. Please try again.'; }
    finally { btn.disabled = false; btn.textContent = 'Send report'; }
  });
  load();
})();
