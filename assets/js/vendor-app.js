/* ─── Vendor Portal SPA ──────────────────────────────────────────────────── */
'use strict';

let currentVendor = null;

document.addEventListener('DOMContentLoaded', () => {
  const token  = localStorage.getItem('vendorToken');
  const stored = localStorage.getItem('vendor');
  if (!token || !stored) {
    window.location.href = 'vendor-login.html';
    return;
  }
  currentVendor = JSON.parse(stored);
  initVendorApp();
});

function vendorLogout() {
  localStorage.removeItem('vendorToken');
  localStorage.removeItem('vendor');
  window.location.href = 'vendor-login.html';
}

function initVendorApp() {
  document.body.innerHTML = vendorShellHTML();
  renderVendorNav();
  renderVendorUserInfo();
  document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  api.get('/admin/app-info').then(data => {
    const name = data && data.name ? data.name : null;
    if (!name) return;
    const companyEl = document.getElementById('vendor-sidebar-company');
    if (companyEl) companyEl.textContent = name;
    const iconEl = document.getElementById('vendor-sidebar-icon');
    if (iconEl) {
      if (data.logo) {
        iconEl.innerHTML = `<img src="${data.logo}" alt="${name}" style="width:28px;height:28px;object-fit:contain;border-radius:4px">`;
        iconEl.style.background = 'transparent';
      } else {
        iconEl.textContent = name.charAt(0).toUpperCase();
      }
    }
    document.title = name + ' — Vendor Portal';
  }).catch(() => {});
  const hash = window.location.hash.slice(1) || 'dashboard';
  vendorNavigate(hash);
  window.addEventListener('hashchange', () => vendorNavigate(window.location.hash.slice(1) || 'dashboard'));
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

const VENDOR_NAV = [
  { page: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { page: 'tenders',   label: 'Browse Tenders', icon: '📢' },
  { page: 'my-quotes', label: 'My Quotes', icon: '💬' },
];

function renderVendorNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = `<div class="nav-group"><div class="nav-group-label">Vendor Portal</div>
    ${VENDOR_NAV.map(i => `<a class="nav-item" data-page="${i.page}" href="#${i.page}">
      <span>${i.icon}</span><span>${i.label}</span>
    </a>`).join('')}
  </div>`;
}

function renderVendorUserInfo() {
  const el = document.getElementById('user-info');
  if (!el) return;
  const initials = (currentVendor.company_name || 'V').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  el.innerHTML = `
    <div class="user-info">
      <div class="avatar" style="background:#22c55e">${initials}</div>
      <div><div class="name">${esc(currentVendor.company_name)}</div><div class="role">Vendor</div></div>
    </div>
    <button class="logout-btn" onclick="vendorLogout()">Sign Out</button>`;
}

function vendorNavigate(page) {
  closeSidebar();
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page || page.startsWith(el.dataset.page + '/'))
  );
  renderVendorPage(page);
}

async function renderVendorPage(page) {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="spinner"></div>';
  const titles = { dashboard: 'Dashboard', tenders: 'Open Tenders', 'my-quotes': 'My Quotes' };
  document.getElementById('topbar-title').textContent = titles[page.split('/')[0]] || 'Vendor Portal';
  try {
    const parts = page.split('/');
    switch (parts[0]) {
      case 'dashboard': await renderVendorDashboard(content); break;
      case 'tenders':
        if (parts[1]) await renderVendorTenderDetail(content, parts[1]);
        else          await renderVendorTenders(content);
        break;
      case 'my-quotes': await renderMyQuotes(content); break;
      default: await renderVendorDashboard(content);
    }
  } catch (err) {
    content.innerHTML = `<div class="alert alert-error">Error: ${esc(err.data?.error || err.message || 'Unknown')}</div>`;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function renderVendorDashboard(el) {
  const tenders = await api.get('/tenders').catch(() => []);
  const open    = tenders.filter(t => t.status === 'open');
  el.innerHTML = `
    <div class="page-header">
      <h2>Welcome, ${esc(currentVendor.company_name)}</h2>
      <p>Vendor Portal — browse tenders and submit your quotes</p>
    </div>
    <div class="grid grid-2 mb-4">
      <div class="card stat-card">
        <div class="stat-icon" style="background:#f0fdf4;color:#22c55e">📢</div>
        <div><div class="stat-num">${open.length}</div><div class="stat-label">Open Tenders</div></div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon" style="background:#e0e7ff;color:#6366f1">📋</div>
        <div><div class="stat-num">${tenders.length}</div><div class="stat-label">Total Tenders</div></div>
      </div>
    </div>
    <a href="#tenders" class="card card-body flex items-center gap-4 mb-4"
       style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;text-decoration:none;display:flex">
      <div style="width:44px;height:44px;background:rgba(255,255,255,.2);border-radius:.75rem;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0">📢</div>
      <div style="flex:1"><div style="font-weight:700">Browse Open Tenders</div><div style="font-size:.8rem;opacity:.8;margin-top:.125rem">View requirements and submit your quotes</div></div>
      <span style="font-size:1.2rem">→</span>
    </a>
    <div class="card">
      <div class="card-header"><h3>Latest Open Tenders</h3></div>
      ${open.length === 0
        ? '<div style="padding:2rem;text-align:center;color:var(--gray-400)">No open tenders at the moment</div>'
        : `<div>${open.slice(0, 5).map(t => `
          <a href="#tenders/${t.id}" style="display:flex;align-items:center;justify-content:space-between;padding:.875rem 1.25rem;border-bottom:1px solid var(--gray-50);color:inherit;text-decoration:none" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
            <div>
              <div style="font-weight:600;font-size:.9rem">${esc(t.title)}</div>
              <div style="font-size:.75rem;color:var(--gray-400);margin-top:.125rem">${esc(t.category || '')}${t.deadline ? ' · Due ' + fmtDate(t.deadline) : ''}</div>
            </div>
            <span style="color:var(--gray-300)">→</span>
          </a>`).join('')}</div>`}
    </div>`;
}

// ── Browse Tenders ────────────────────────────────────────────────────────────
async function renderVendorTenders(el) {
  const rows = await api.get('/tenders');
  const open = rows.filter(t => t.status === 'open');
  el.innerHTML = `
    <div class="page-header">
      <h2>Open Tenders</h2>
      <p>Browse procurement requirements and submit your quotes</p>
    </div>
    ${open.length === 0
      ? '<div class="card card-body" style="text-align:center;color:var(--gray-400);padding:3rem">No open tenders available</div>'
      : open.map(t => `
        <div class="card card-body mb-3" style="cursor:pointer" onclick="window.location.hash='tenders/${t.id}'">
          <div style="display:flex;align-items:start;justify-content:space-between;gap:1rem">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap">
                <span class="badge badge-open">Open</span>
                ${t.category ? `<span class="badge" style="background:#f0fdf4;color:#22c55e">${esc(t.category)}</span>` : ''}
              </div>
              <div style="font-weight:700;font-size:1rem">${esc(t.title)}</div>
              ${t.description ? `<div style="font-size:.85rem;color:var(--gray-500);margin-top:.375rem">${esc(t.description.slice(0, 120))}${t.description.length > 120 ? '…' : ''}</div>` : ''}
              <div style="display:flex;gap:1.25rem;margin-top:.625rem;font-size:.75rem;color:var(--gray-400)">
                ${t.deadline ? `<span>📅 Due ${fmtDate(t.deadline)}</span>` : ''}
                ${t.budget ? `<span>💰 Budget: AED ${fmt(t.budget)}</span>` : ''}
              </div>
            </div>
            <div style="width:40px;height:40px;background:#f0fdf4;border-radius:.625rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#22c55e;font-size:1.1rem">→</div>
          </div>
        </div>`).join('')}`;
}

// ── Tender Detail + Quote Submission ─────────────────────────────────────────
async function renderVendorTenderDetail(el, id) {
  const t      = await api.get('/tenders/' + id);
  const quotes = await api.get('/tenders/' + id + '/quotes').catch(() => []);
  const myQuote = quotes.find(q => q.vendor_id === currentVendor.id);
  const isClosed = t.status === 'closed';

  el.innerHTML = `
    <a href="#tenders" class="btn btn-outline btn-sm mb-4">← Back to Tenders</a>
    <div class="card mb-4" style="max-width:700px">
      <div class="card-header">
        <h3>${esc(t.title)}</h3>
        <span class="badge ${isClosed ? 'badge-closed' : 'badge-open'}">${isClosed ? 'Closed' : 'Open'}</span>
      </div>
      <div class="card-body">
        <div class="grid grid-3 gap-3 mb-4">
          ${t.budget   ? `<div><div class="text-xs text-gray">Budget</div><div class="font-bold">AED ${fmt(t.budget)}</div></div>` : ''}
          ${t.deadline ? `<div><div class="text-xs text-gray">Deadline</div><div class="font-bold">${fmtDate(t.deadline)}</div></div>` : ''}
          ${t.quantity ? `<div><div class="text-xs text-gray">Quantity</div><div class="font-bold">${esc(t.quantity)} ${esc(t.unit||'units')}</div></div>` : ''}
        </div>
        ${t.description    ? `<p style="font-size:.875rem;color:var(--gray-600);margin-bottom:.75rem">${esc(t.description)}</p>` : ''}
        ${t.specifications ? `<div style="background:var(--gray-50);border-radius:.5rem;padding:1rem;font-size:.85rem;color:var(--gray-700);white-space:pre-wrap">${esc(t.specifications)}</div>` : ''}
      </div>
    </div>

    ${myQuote ? `
    <div class="card card-body mb-4" style="background:#dcfce7;border-color:#bbf7d0;max-width:700px">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
        <span style="font-size:1.25rem">✅</span>
        <strong style="color:#15803d">Your Quote Submitted</strong>
      </div>
      <div class="grid grid-4">
        <div><div class="text-xs" style="color:#22c55e">Unit Price</div><div class="font-bold" style="color:#0f172a">AED ${fmt(myQuote.unit_price)}</div></div>
        ${myQuote.delivery_days ? `<div><div class="text-xs" style="color:#22c55e">Delivery</div><div class="font-bold">${myQuote.delivery_days} days</div></div>` : ''}
        ${myQuote.validity_days ? `<div><div class="text-xs" style="color:#22c55e">Valid For</div><div class="font-bold">${myQuote.validity_days} days</div></div>` : ''}
        <div><div class="text-xs" style="color:#22c55e">Submitted</div><div class="font-bold">${fmtDate(myQuote.created_at)}</div></div>
      </div>
      ${myQuote.notes ? `<p style="font-size:.85rem;color:#16a34a;margin-top:.75rem;padding-top:.75rem;border-top:1px solid #bbf7d0">${esc(myQuote.notes)}</p>` : ''}
    </div>` : ''}

    ${!isClosed && !myQuote ? `
    <div class="card" style="max-width:700px">
      <div class="card-header" onclick="toggleQuoteForm()" style="cursor:pointer">
        <h3>📤 Submit Your Quote</h3>
        <span id="quote-toggle">▼</span>
      </div>
      <div id="quote-form-body" class="card-body">
        <div id="quote-error"></div>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Unit Price (AED) <span style="color:red">*</span></label>
            <div class="input-prefix"><span class="prefix">AED</span>
              <input id="q-price" type="number" step="0.01" min="0.01" class="form-control" placeholder="0.00" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Delivery Time (days)</label>
            <input id="q-delivery" type="number" min="1" class="form-control" placeholder="14">
          </div>
          <div class="form-group">
            <label class="form-label">Quote Validity (days)</label>
            <input id="q-validity" type="number" min="1" value="30" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes / Remarks</label>
          <textarea id="q-notes" class="form-control" rows="3" placeholder="Any additional details, terms, or conditions…"></textarea>
        </div>
        <div class="btn-group">
          <a href="#tenders" class="btn btn-outline">Cancel</a>
          <button class="btn btn-primary" onclick="submitQuote('${t.id}')" style="background:#22c55e">📤 Submit Quote</button>
        </div>
      </div>
    </div>` : ''}

    ${isClosed && !myQuote ? `
    <div class="card card-body" style="text-align:center;max-width:700px">
      <div style="font-size:2rem;margin-bottom:.5rem">🔒</div>
      <p style="font-weight:600;color:var(--gray-700)">This tender is closed</p>
      <p style="font-size:.85rem;color:var(--gray-400);margin-top:.25rem">Quote submission is no longer available</p>
      <a href="#tenders" style="display:inline-block;margin-top:1rem;color:#22c55e;font-size:.875rem">Browse other tenders</a>
    </div>` : ''}`;
}

function toggleQuoteForm() {
  const body = document.getElementById('quote-form-body');
  const icon = document.getElementById('quote-toggle');
  if (body.style.display === 'none') { body.style.display = ''; icon.textContent = '▼'; }
  else { body.style.display = 'none'; icon.textContent = '▶'; }
}

async function submitQuote(tenderId) {
  const price = document.getElementById('q-price')?.value;
  if (!price || parseFloat(price) <= 0) {
    document.getElementById('quote-error').innerHTML = '<div class="alert alert-error">Please enter a valid unit price</div>';
    return;
  }
  const btn = document.querySelector('#quote-form-body .btn-primary');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    await api.post('/tenders/' + tenderId + '/quote', {
      unit_price:    parseFloat(price),
      delivery_days: parseInt(document.getElementById('q-delivery')?.value || 0) || null,
      validity_days: parseInt(document.getElementById('q-validity')?.value || 30),
      notes:         document.getElementById('q-notes')?.value || '',
    });
    vendorNavigate('tenders/' + tenderId);
  } catch (err) {
    document.getElementById('quote-error').innerHTML = `<div class="alert alert-error">${esc(err.data?.error || 'Failed to submit quote')}</div>`;
    btn.disabled = false; btn.textContent = '📤 Submit Quote';
  }
}

// ── My Quotes ─────────────────────────────────────────────────────────────────
async function renderMyQuotes(el) {
  const tenders = await api.get('/tenders').catch(() => []);
  const allQuotes = [];
  for (const t of tenders) {
    const quotes = await api.get('/tenders/' + t.id + '/quotes').catch(() => []);
    const mine = quotes.find(q => q.vendor_id === currentVendor.id);
    if (mine) allQuotes.push({ ...mine, tender_title: t.title, tender_status: t.status });
  }
  el.innerHTML = `
    <div class="page-header"><h2>My Quotes</h2><p>All quotes you have submitted</p></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tender</th><th>Unit Price (AED)</th><th>Delivery</th><th>Validity</th><th>Tender Status</th><th>Submitted</th></tr></thead>
          <tbody>
            ${allQuotes.length === 0
              ? '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-400)">No quotes submitted yet</td></tr>'
              : allQuotes.map(q => `<tr>
                  <td style="font-weight:600"><a href="#tenders/${q.tender_id}" style="color:#22c55e">${esc(q.tender_title)}</a></td>
                  <td style="font-weight:700">AED ${fmt(q.unit_price)}</td>
                  <td>${q.delivery_days ? q.delivery_days + ' days' : '—'}</td>
                  <td>${q.validity_days ? q.validity_days + ' days' : '—'}</td>
                  <td>${q.tender_status === 'open' ? '<span class="badge badge-open">Open</span>' : '<span class="badge badge-closed">Closed</span>'}</td>
                  <td>${fmtDate(q.created_at)}</td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n) { return parseFloat(n||0).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

// ── Shell ─────────────────────────────────────────────────────────────────────
function vendorShellHTML() {
  return `
    <div id="sidebar-overlay" class="overlay-bg"></div>
    <div id="app">
      <nav id="sidebar" class="sidebar">
        <div class="sidebar-logo">
          <div class="logo-icon" id="vendor-sidebar-icon" style="background:#22c55e">🏪</div>
          <div><span>Vendor Portal</span><small id="vendor-sidebar-company">Procurement System</small></div>
        </div>
        <div id="sidebar-nav"></div>
        <div class="nav-group" style="padding-top:0">
          <a class="nav-item" href="index.html"><span>🏠</span><span>Home</span></a>
        </div>
        <div class="sidebar-footer" id="user-info"></div>
      </nav>
      <div class="main-area">
        <header class="topbar">
          <div class="flex items-center gap-3">
            <button id="hamburger" class="hamburger">☰</button>
            <span id="topbar-title" class="topbar-title">Dashboard</span>
          </div>
        </header>
        <main class="page-content" id="page-content"><div class="spinner"></div></main>
      </div>
    </div>`;
}
