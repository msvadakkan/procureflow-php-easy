/* ─── Purchase Approval System — SPA core ────────────────────────────────── */
'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let currentUser   = null;
let currentPage   = 'dashboard';
let activeCompany = null;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('user');
  const token  = localStorage.getItem('token');
  if (stored && token) {
    currentUser = JSON.parse(stored);
    initApp();
  } else {
    showLogin();
  }
});

// ── Auth ─────────────────────────────────────────────────────────────────────
function showLogin() {
  document.body.innerHTML = loginHTML();
  api.get('/admin/app-info').then(applyBranding).catch(() => {});
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass  = document.getElementById('password').value;
    setLoginError('');
    try {
      const data = await api.post('/auth/login', { email, password: pass });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      currentUser = data.user;
      initApp();
    } catch (err) {
      setLoginError(err.data?.error || 'Login failed');
    }
  });
}

function setLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = msg ? 'flex' : 'none'; }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  showLogin();
}

// ── App Shell ────────────────────────────────────────────────────────────────
function applyBranding(data) {
  const name = (data && data.name) ? data.name : null;
  if (!name) return;

  // Login page
  const loginName = document.getElementById('login-company-name');
  if (loginName) loginName.textContent = name;

  if (data.logo) {
    const loginLogo = document.getElementById('login-logo');
    if (loginLogo) loginLogo.innerHTML = `<img src="${data.logo}" alt="${name}" style="max-height:64px;max-width:180px;object-fit:contain;display:block;margin:0 auto .75rem">`;
  }

  // Sidebar
  const sidebarName = document.getElementById('sidebar-company-name');
  if (sidebarName) sidebarName.textContent = name;

  const sidebarIcon = document.getElementById('sidebar-logo-icon');
  if (sidebarIcon) {
    if (data.logo) {
      sidebarIcon.innerHTML = `<img src="${data.logo}" alt="${name}" style="width:32px;height:32px;object-fit:contain;border-radius:6px">`;
      sidebarIcon.style.background = 'transparent';
      sidebarIcon.style.padding = '0';
    } else {
      sidebarIcon.textContent = name.charAt(0).toUpperCase();
    }
  }

  document.title = name + ' — Purchase Approval';
}

function initApp() {
  document.body.innerHTML = appShellHTML();
  renderNav();
  renderUserInfo();
  // Mobile sidebar
  document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  // Load branding
  api.get('/admin/app-info').then(applyBranding).catch(() => {});
  // Routing
  const hash = window.location.hash.slice(1) || 'dashboard';
  navigateTo(hash);
  window.addEventListener('hashchange', () => navigateTo(window.location.hash.slice(1) || 'dashboard'));
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function navigateTo(page) {
  currentPage = page;
  closeSidebar();
  updateActiveNav(page);
  renderPage(page);
}

function updateActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page || page.startsWith(el.dataset.page + '/'));
  });
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  { group: 'Main',       items: [
    { page: 'dashboard', label: 'Dashboard',  icon: '⊞' },
    { page: 'requests',  label: 'Requests',   icon: '📋' },
    { page: 'approvals', label: 'Approvals',  icon: '✅', roles: ['admin','ceo','department_head','manager'] },
  ]},
  { group: 'Procurement', items: [
    { page: 'tenders',   label: 'Tenders',    icon: '📢' },
    { page: 'vendors',   label: 'Vendors',    icon: '🏪', roles: ['admin','ceo','department_head','manager'] },
    { page: 'lpos',      label: 'LPOs',       icon: '🧾' },
  ]},
  { group: 'Settings',   items: [
    { page: 'companies', label: 'Companies',  icon: '🏢', roles: ['admin'] },
    { page: 'admin',     label: 'Admin Panel',icon: '⚙️', roles: ['admin'] },
  ]},
];

function renderNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = NAV.map(({ group, items }) => {
    const filtered = items.filter(i => !i.roles || i.roles.includes(currentUser?.role));
    if (!filtered.length) return '';
    return `<div class="nav-group">
      <div class="nav-group-label">${group}</div>
      ${filtered.map(i => `<a class="nav-item" data-page="${i.page}" href="#${i.page}">
        <span>${i.icon}</span><span>${i.label}</span>
      </a>`).join('')}
    </div>`;
  }).join('');
}

const ROLE_LABELS = {
  admin:           'Administrator',
  ceo:             'CEO',
  department_head: 'Dept. Head',
  manager:         'Manager',
  employee:        'Employee',
};

function renderUserInfo() {
  const el = document.getElementById('user-info');
  if (!el || !currentUser) return;
  const initials  = (currentUser.name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const roleLabel = ROLE_LABELS[currentUser.role] || currentUser.role;
  const isAdmin   = currentUser.role === 'admin';
  el.innerHTML = `
    <div class="user-info">
      <div class="avatar" style="${isAdmin ? 'background:var(--primary);color:#fff' : ''}">${initials}</div>
      <div>
        <div class="name">${esc(currentUser.name)}</div>
        <div class="role" style="display:flex;align-items:center;gap:.3rem">
          ${isAdmin ? '<span style="background:#fce7f3;color:#be185d;font-size:.65rem;font-weight:800;padding:.1rem .35rem;border-radius:4px;text-transform:uppercase;letter-spacing:.04em">Admin</span>' : ''}
          ${esc(roleLabel)}
        </div>
      </div>
    </div>
    <button class="logout-btn" onclick="logout()">Sign Out</button>`;
}

// ── Page Router ───────────────────────────────────────────────────────────────
async function renderPage(page) {
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="spinner"></div>`;
  document.getElementById('topbar-title').textContent = pageTitles[page.split('/')[0]] || 'Dashboard';
  try {
    const parts = page.split('/');
    switch (parts[0]) {
      case 'dashboard': await renderDashboard(content);   break;
      case 'requests':
        if (parts[1] === 'new')      await renderRequestForm(content);
        else if (parts[1])           await renderRequestDetail(content, parts[1]);
        else                         await renderRequests(content);
        break;
      case 'approvals': await renderApprovals(content);   break;
      case 'tenders':
        if (parts[1] === 'new')      await renderTenderForm(content);
        else if (parts[1])           await renderTenderDetail(content, parts[1]);
        else                         await renderTenders(content);
        break;
      case 'vendors':   await renderVendors(content);     break;
      case 'lpos':
        if (parts[1] === 'new')      await renderLPOForm(content);
        else if (parts[1])           await renderLPODetail(content, parts[1]);
        else                         await renderLPOs(content);
        break;
      case 'companies':
        if (parts[1] === 'new')      await renderCompanyForm(content);
        else                         await renderCompanies(content);
        break;
      case 'admin':     await renderAdmin(content);       break;
      default:          await renderDashboard(content);
    }
  } catch (err) {
    content.innerHTML = `<div class="alert alert-error">Failed to load page: ${err.data?.error || err.message || 'Unknown error'}</div>`;
  }
}

const pageTitles = {
  dashboard: 'Dashboard', requests: 'Purchase Requests', approvals: 'Pending Approvals',
  tenders: 'Tenders', vendors: 'Vendor Registry', lpos: 'Local Purchase Orders',
  companies: 'Companies', admin: 'Admin Panel',
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function renderDashboard(el) {
  const [stats, requests] = await Promise.all([
    api.get('/admin/stats').catch(() => ({})),
    api.get('/requests').catch(() => []),
  ]);
  el.innerHTML = `
    <div class="page-header"><h2>Dashboard</h2><p>Welcome back, ${currentUser?.name}</p></div>
    <div class="grid grid-4 mb-4">
      ${statCard('📋', stats.total_requests   ?? 0, 'Total Requests',  '#fce7f3', '#ec4899')}
      ${statCard('⏳', stats.pending_requests  ?? 0, 'Pending',         '#fef3c7', '#f59e0b')}
      ${statCard('✅', stats.approved_requests ?? 0, 'Approved',        '#d1fae5', '#10b981')}
      ${statCard('📢', stats.open_tenders      ?? 0, 'Open Tenders',    '#f0fdf4', '#22c55e')}
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Recent Requests</h3>
        <a href="#requests/new" class="btn btn-primary btn-sm">+ New Request</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Items</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${requests.slice(0,8).map(r => `<tr>
              <td><a href="#requests/${r.id}" style="color:var(--primary);font-weight:600">${esc(r.title)}</a></td>
              <td>${(r.items||[]).length} item${(r.items||[]).length !== 1 ? 's' : ''}</td>
              <td>${badge(r.status)}</td>
              <td>${fmtDate(r.created_at)}</td>
            </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:2rem">No requests yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function statCard(icon, num, label, bg, color) {
  return `<div class="card stat-card">
    <div class="stat-icon" style="background:${bg};color:${color}">${icon}</div>
    <div><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>
  </div>`;
}

// ── Requests ──────────────────────────────────────────────────────────────────
async function renderRequests(el) {
  const rows = await api.get('/requests');
  el.innerHTML = `
    <div class="page-header flex items-center justify-between">
      <div><h2>Purchase Requests</h2><p>Manage and track procurement requests</p></div>
      <a href="#requests/new" class="btn btn-primary">+ New Request</a>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Items</th><th>Category</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td style="font-weight:600">${esc(r.title)}</td>
              <td>${(r.items||[]).length} item${(r.items||[]).length !== 1 ? 's' : ''}</td>
              <td>${esc(r.category || '—')}</td>
              <td>${badge(r.status)}</td>
              <td>${fmtDate(r.created_at)}</td>
              <td><a href="#requests/${r.id}" class="btn btn-outline btn-sm">View</a></td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-400)">No requests found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function renderRequestForm(el) {
  const companies = await api.get('/companies').catch(() => []);
  el.innerHTML = `
    <div class="page-header"><h2>New Purchase Request</h2></div>
    <div class="card" style="max-width:760px">
      <div class="card-body">
        <div id="req-error"></div>
        <div class="form-group">
          <label class="form-label">Request Title *</label>
          <input id="req-title" class="form-control" placeholder="Brief description of what you need">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <input id="req-category" class="form-control" placeholder="e.g. IT Equipment">
        </div>
        ${companies.length ? `<div class="form-group">
          <label class="form-label">Company</label>
          <select id="req-company" class="form-control">
            <option value="">Select company…</option>
            ${companies.map(c => `<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="form-group">
          <label class="form-label">Items *</label>
          <div class="table-wrap" style="margin-bottom:.625rem">
            <table id="items-table" style="min-width:100%">
              <thead><tr>
                <th>Item Name *</th>
                <th style="width:90px">Qty *</th>
                <th>Brand</th>
                <th>Model</th>
                <th style="width:44px"></th>
              </tr></thead>
              <tbody id="items-body"></tbody>
            </table>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="addItemRow()">+ Add Item</button>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea id="req-desc" class="form-control" rows="3" placeholder="Additional details…"></textarea>
        </div>
        <div class="btn-group">
          <a href="#requests" class="btn btn-outline">Cancel</a>
          <button class="btn btn-primary" onclick="submitRequest()">Submit Request</button>
        </div>
      </div>
    </div>`;
  addItemRow();
}

function addItemRow() {
  const tbody = document.getElementById('items-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="form-control form-control-sm item-name" placeholder="Item name" required></td>
    <td><input class="form-control form-control-sm item-qty" type="number" min="1" value="1" required></td>
    <td><input class="form-control form-control-sm item-brand" placeholder="Optional"></td>
    <td><input class="form-control form-control-sm item-model" placeholder="Optional"></td>
    <td><button type="button" onclick="removeItemRow(this)" class="btn btn-danger btn-sm" style="padding:.25rem .5rem">×</button></td>`;
  tbody.appendChild(tr);
  tr.querySelector('.item-name').focus();
}

function removeItemRow(btn) {
  const tbody = document.getElementById('items-body');
  if (tbody && tbody.children.length > 1) btn.closest('tr').remove();
}

async function submitRequest() {
  const title = document.getElementById('req-title')?.value?.trim();
  if (!title) { showFormError('req-error', 'Request title is required'); return; }
  const itemRows = document.querySelectorAll('#items-body tr');
  const items = [];
  for (const row of itemRows) {
    const name = row.querySelector('.item-name')?.value?.trim();
    const qty  = parseInt(row.querySelector('.item-qty')?.value || '1', 10);
    if (!name) { showFormError('req-error', 'Item name is required for every row'); return; }
    items.push({
      name, quantity: qty,
      brand: row.querySelector('.item-brand')?.value?.trim() || '',
      model: row.querySelector('.item-model')?.value?.trim() || '',
    });
  }
  if (!items.length) { showFormError('req-error', 'Add at least one item'); return; }
  const compSel = document.getElementById('req-company');
  const body = {
    title, items,
    category:     document.getElementById('req-category')?.value || '',
    description:  document.getElementById('req-desc')?.value     || '',
    company_id:   compSel?.value   || null,
    company_name: compSel?.options[compSel?.selectedIndex]?.dataset?.name || null,
  };
  try {
    await api.post('/requests', body);
    window.location.hash = 'requests';
  } catch (err) { showFormError('req-error', err.data?.error || 'Failed to submit'); }
}

async function renderRequestDetail(el, id) {
  const [r, vendors] = await Promise.all([
    api.get('/requests/' + id),
    api.get('/vendors').catch(() => []),
  ]);
  const approvedVendors = vendors.filter(v => v.status === 'approved');
  const items = r.items || [];
  const canAct = r.status === 'pending' && canApprove();
  const comp = r.comparison || null;

  el.innerHTML = `
    <a href="#requests" class="btn btn-outline btn-sm mb-4">← Back</a>
    <div style="max-width:900px">

      <!-- Request Info -->
      <div class="card mb-4">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
          <h3 style="margin:0">${esc(r.title)}</h3>
          ${badge(r.status)}
        </div>
        <div class="card-body">
          <div class="grid grid-2 gap-4 mb-4">
            <div><div class="text-xs text-gray">Requester</div><div class="font-bold">${esc(r.requester_name || '—')}</div></div>
            <div><div class="text-xs text-gray">Category</div><div>${esc(r.category || '—')}</div></div>
            <div><div class="text-xs text-gray">Department</div><div>${esc(r.department || '—')}</div></div>
            <div><div class="text-xs text-gray">Date</div><div>${fmtDate(r.created_at)}</div></div>
          </div>
          ${items.length ? `
          <div class="mb-4">
            <div class="text-xs text-gray mb-2" style="font-weight:700;text-transform:uppercase;letter-spacing:.05em">Requested Items</div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Item Name</th><th>Qty</th><th>Brand</th><th>Model</th></tr></thead>
                <tbody>
                  ${items.map(i => `<tr>
                    <td style="font-weight:600">${esc(i.name)}</td>
                    <td>${i.quantity}</td>
                    <td>${esc(i.brand || '—')}</td>
                    <td>${esc(i.model || '—')}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>` : ''}
          ${r.description ? `<p class="text-sm text-gray mb-4">${esc(r.description)}</p>` : ''}
          ${r.status === 'pending' && r.requester_id === currentUser?.id ? `
            <button class="btn btn-outline btn-sm" onclick="doCancel('${r.id}')">Cancel Request</button>` : ''}
          ${(r.history || []).length ? `
            <h4 style="font-size:.9rem;font-weight:700;margin:1.25rem 0 .5rem">Approval History</h4>
            ${r.history.map(h => `<div style="padding:.625rem;background:var(--gray-50);border-radius:.5rem;margin-bottom:.5rem;font-size:.8rem">
              <strong>${esc(h.approver_name)}</strong> (${esc(h.approver_role)}) — <em>${h.action}</em> — ${fmtDate(h.created_at)}
              ${h.comments ? `<div style="color:var(--gray-500);margin-top:.25rem">${esc(h.comments)}</div>` : ''}
            </div>`).join('')}` : ''}
        </div>
      </div>

      <!-- Vendor Comparison Sheet -->
      ${(canAct || comp) ? comparisonCard(r, items, approvedVendors, comp, canAct) : ''}

    </div>`;

  // Init live totals if editable form is present
  if (document.getElementById('comp-sheet-form')) updateCompTotals();
}

function comparisonCard(r, items, vendors, comp, canAct) {
  const showForm = canAct;
  const vendorOpts = vendors.map(v =>
    `<option value="${esc(v.id)}" data-name="${esc(v.company_name)}">${esc(v.company_name)}</option>`
  ).join('');

  // Pre-fill from saved comparison if exists
  const sv = comp ? comp.vendors : [];
  const sp = comp ? comp.line_items : [];

  const vendorSelects = [0,1,2].map(vi => `
    <div>
      <label class="form-label" style="font-size:.8rem;font-weight:700">Vendor ${vi+1}</label>
      <select id="comp-v${vi}-sel" class="form-control form-control-sm" onchange="updateCompTotals()">
        <option value="">— Select Vendor —</option>
        ${vendors.map(v => `<option value="${v.id}" data-name="${esc(v.company_name)}"${sv[vi] && sv[vi].id === v.id ? ' selected' : ''}>${esc(v.company_name)}</option>`).join('')}
      </select>
    </div>`).join('');

  const itemRows = items.map((item, ii) => {
    const savedPrices = sp[ii] ? sp[ii].vendor_prices : [0,0,0];
    return `<tr>
      <td style="font-weight:600">${esc(item.name)}</td>
      <td style="text-align:center">${item.quantity}</td>
      ${[0,1,2].map(vi => `
        <td style="min-width:110px"><input id="comp-p-${ii}-${vi}" class="form-control form-control-sm" type="number" min="0" step="0.01" placeholder="0.00" value="${savedPrices[vi] > 0 ? savedPrices[vi] : ''}" oninput="updateCompTotals()" style="max-width:100px"></td>
        <td id="comp-lt-${ii}-${vi}" style="text-align:right;font-size:.85rem;color:var(--gray-500)">—</td>
      `).join('')}
    </tr>`;
  }).join('');

  const roView = comp ? compReadOnly(comp) : '';

  return `
    <div class="card mb-4">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
        <div>
          <h4 style="margin:0;font-size:1rem;font-weight:800">Vendor Comparison Sheet</h4>
          <div class="text-xs text-gray" style="margin-top:.2rem">Compare up to 3 vendor quotes — cheapest is auto-highlighted</div>
        </div>
        ${comp && canAct ? `<button class="btn btn-outline btn-sm" onclick="toggleCompEdit()">Re-enter Prices</button>` : ''}
      </div>
      <div class="card-body">
        ${comp ? `<div id="comp-readonly">${roView}</div>` : ''}
        <div id="comp-sheet-form" ${comp ? 'style="display:none"' : ''}>
          ${vendors.length === 0 ? `<p style="color:var(--gray-400);text-align:center;padding:1.5rem">No approved vendors found. Approve vendors in the Vendors section first.</p>` : `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.25rem">
            ${vendorSelects}
          </div>
          <div class="table-wrap" style="overflow-x:auto">
            <table id="comp-table" style="min-width:700px">
              <thead>
                <tr>
                  <th rowspan="2">Item Name</th>
                  <th rowspan="2" style="text-align:center">Qty</th>
                  <th colspan="2" id="comp-th-0" style="text-align:center;background:var(--gray-50)">Vendor 1</th>
                  <th colspan="2" id="comp-th-1" style="text-align:center;background:var(--gray-50)">Vendor 2</th>
                  <th colspan="2" id="comp-th-2" style="text-align:center;background:var(--gray-50)">Vendor 3</th>
                </tr>
                <tr>
                  ${[0,1,2].map(vi => `<th style="text-align:center;font-size:.75rem;background:var(--gray-50)">Unit Price</th><th style="text-align:right;font-size:.75rem;background:var(--gray-50)">Line Total</th>`).join('')}
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
              <tfoot>
                <tr style="font-weight:700;border-top:2px solid var(--gray-200)">
                  <td colspan="2">Grand Total</td>
                  ${[0,1,2].map(vi => `<td colspan="2" id="comp-grand-${vi}" style="text-align:right;font-size:.95rem">—</td>`).join('')}
                </tr>
              </tfoot>
            </table>
          </div>
          <div id="comp-cheapest-banner" style="display:none;margin-top:.75rem;padding:.625rem 1rem;border-radius:.5rem;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;font-size:.875rem;font-weight:600"></div>
          <div class="btn-group mt-4">
            <button class="btn btn-outline" onclick="saveComparison('${r.id}')">Save Comparison</button>
            ${canAct ? `<button class="btn btn-primary" onclick="verifyAndApprove('${r.id}')">Verify Amount &amp; Approve</button>
            <button class="btn btn-danger btn-sm" onclick="doReject('${r.id}')">Reject</button>` : ''}
          </div>`}
        </div>
      </div>
    </div>`;
}

function compReadOnly(comp) {
  const vnames = comp.vendors.map(v => v.name);
  const ci = comp.cheapest_vendor_index;
  const highlight = ['','',''].map((_,i) =>
    i === ci ? 'background:#f0fdf4;color:#15803d;font-weight:700' : '');

  const rows = (comp.line_items || []).map(li => `<tr>
    <td style="font-weight:600">${esc(li.name)}</td>
    <td style="text-align:center">${li.quantity}</td>
    ${(li.vendor_prices || []).map((p, vi) => {
      const total = p * li.quantity;
      return `<td style="text-align:right;${highlight[vi]}">${fmt(p)}</td><td style="text-align:right;${highlight[vi]}">${fmt(total)}</td>`;
    }).join('')}
  </tr>`).join('');

  const totals = (comp.totals || []).map((t, vi) =>
    `<td colspan="2" style="text-align:right;font-size:.95rem;font-weight:700;${highlight[vi]}">${fmt(t)}${vi === ci ? ' ✓' : ''}</td>`
  ).join('');

  return `
    <div style="margin-bottom:.75rem;font-size:.8rem;color:var(--gray-500)">
      Saved by <strong>${esc(comp.saved_by)}</strong> on ${fmtDate(comp.saved_at)}
    </div>
    <div style="padding:.625rem 1rem;border-radius:.5rem;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;font-size:.875rem;font-weight:600;margin-bottom:1rem">
      Cheapest vendor: <strong>${esc(vnames[ci] || '—')}</strong> — Total: ${fmt((comp.totals||[])[ci] || 0)}
    </div>
    <div class="table-wrap" style="overflow-x:auto">
      <table style="min-width:600px">
        <thead>
          <tr>
            <th rowspan="2">Item Name</th>
            <th rowspan="2" style="text-align:center">Qty</th>
            ${vnames.map((n,vi) => `<th colspan="2" style="text-align:center;${highlight[vi]}">${esc(n)}</th>`).join('')}
          </tr>
          <tr>
            ${vnames.map((_,vi) => `<th style="text-align:right;font-size:.75rem;${highlight[vi]}">Unit</th><th style="text-align:right;font-size:.75rem;${highlight[vi]}">Total</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--gray-200)">
            <td colspan="2" style="font-weight:700">Grand Total</td>
            ${totals}
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function toggleCompEdit() {
  const form = document.getElementById('comp-sheet-form');
  const ro   = document.getElementById('comp-readonly');
  if (!form) return;
  const hidden = form.style.display === 'none';
  form.style.display = hidden ? '' : 'none';
  if (ro) ro.style.display = hidden ? 'none' : '';
  if (hidden) updateCompTotals();
}

function updateCompTotals() {
  const items = document.querySelectorAll('#comp-table tbody tr');
  if (!items.length) return;
  const grandTotals = [0, 0, 0];
  const vNames = [0,1,2].map(vi => {
    const sel = document.getElementById(`comp-v${vi}-sel`);
    return sel ? (sel.options[sel.selectedIndex]?.dataset?.name || `Vendor ${vi+1}`) : `Vendor ${vi+1}`;
  });

  // Update column headers
  [0,1,2].forEach(vi => {
    const th = document.getElementById(`comp-th-${vi}`);
    if (th) th.textContent = vNames[vi];
  });

  items.forEach((row, ii) => {
    const qtyCell = row.cells[1];
    const qty = parseInt(qtyCell?.textContent || '1', 10);
    [0,1,2].forEach(vi => {
      const inp = document.getElementById(`comp-p-${ii}-${vi}`);
      const ltEl = document.getElementById(`comp-lt-${ii}-${vi}`);
      if (!inp || !ltEl) return;
      const price = parseFloat(inp.value) || 0;
      const lineTotal = price * qty;
      ltEl.textContent = price > 0 ? fmt(lineTotal) : '—';
      grandTotals[vi] += lineTotal;
    });
  });

  // Find cheapest among columns that have any price entered
  let cheapest = -1;
  let minTotal = Infinity;
  [0,1,2].forEach(vi => {
    const sel = document.getElementById(`comp-v${vi}-sel`);
    if (sel && sel.value && grandTotals[vi] > 0 && grandTotals[vi] < minTotal) {
      minTotal = grandTotals[vi];
      cheapest = vi;
    }
  });

  // Update grand total cells + highlight
  [0,1,2].forEach(vi => {
    const el = document.getElementById(`comp-grand-${vi}`);
    if (!el) return;
    el.textContent = grandTotals[vi] > 0 ? fmt(grandTotals[vi]) + (vi === cheapest ? ' ✓' : '') : '—';
    el.style.color      = vi === cheapest ? '#15803d' : '';
    el.style.background = vi === cheapest ? '#f0fdf4' : '';

    // Also highlight line-total cells in that column
    items.forEach((_, ii) => {
      const ltEl = document.getElementById(`comp-lt-${ii}-${vi}`);
      if (ltEl) {
        ltEl.style.color      = vi === cheapest ? '#15803d' : 'var(--gray-500)';
        ltEl.style.fontWeight = vi === cheapest ? '700' : '';
      }
    });
  });

  // Banner
  const banner = document.getElementById('comp-cheapest-banner');
  if (banner) {
    if (cheapest >= 0) {
      banner.textContent = `Cheapest: ${vNames[cheapest]} — Total: ${fmt(grandTotals[cheapest])}`;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }
}

function _collectCompData() {
  const vendors = [];
  [0,1,2].forEach(vi => {
    const sel = document.getElementById(`comp-v${vi}-sel`);
    if (sel && sel.value) vendors.push({ id: sel.value, name: sel.options[sel.selectedIndex]?.dataset?.name || '' });
  });
  if (!vendors.length) { alert('Select at least one vendor'); return null; }

  const itemRows = document.querySelectorAll('#comp-table tbody tr');
  const prices = Array.from(itemRows).map((_, ii) =>
    [0,1,2].slice(0, 3).map(vi => parseFloat(document.getElementById(`comp-p-${ii}-${vi}`)?.value || '0') || 0)
  );
  return { vendors, prices };
}

async function saveComparison(reqId) {
  const data = _collectCompData();
  if (!data) return;
  try {
    await api.post('/requests/' + reqId + '/comparison', data);
    navigateTo('requests/' + reqId);
  } catch (err) { alert(err.data?.error || 'Failed to save comparison'); }
}

async function verifyAndApprove(reqId) {
  const data = _collectCompData();
  if (!data) return;
  const comments = prompt('Approval comment (optional):') ?? '';
  try {
    await api.post('/requests/' + reqId + '/comparison', data);
    await api.post('/requests/' + reqId + '/approve', { comments });
    navigateTo('requests/' + reqId);
  } catch (err) { alert(err.data?.error || 'Failed'); }
}

function canApprove() {
  return ['admin','ceo','department_head','manager'].includes(currentUser?.role);
}

async function doApprove(id) {
  const comments = prompt('Approval comment (optional):') ?? '';
  try { await api.post('/requests/' + id + '/approve', { comments }); navigateTo('requests/' + id); }
  catch (err) { alert(err.data?.error || 'Failed'); }
}
async function doReject(id) {
  const comments = prompt('Reason for rejection:') ?? '';
  try { await api.post('/requests/' + id + '/reject', { comments }); navigateTo('requests/' + id); }
  catch (err) { alert(err.data?.error || 'Failed'); }
}
async function doCancel(id) {
  if (!confirm('Cancel this request?')) return;
  try { await api.post('/requests/' + id + '/cancel', {}); navigateTo('requests'); }
  catch (err) { alert(err.data?.error || 'Failed'); }
}

// ── Approvals ─────────────────────────────────────────────────────────────────
async function renderApprovals(el) {
  const rows = await api.get('/requests?pending=1');
  el.innerHTML = `
    <div class="page-header"><h2>Pending Approvals</h2><p>Requests awaiting your decision</p></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Requester</th><th>Items</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td style="font-weight:600">${esc(r.title)}</td>
              <td>${esc(r.requester_name || '—')}</td>
              <td>${(r.items||[]).length} item${(r.items||[]).length !== 1 ? 's' : ''}</td>
              <td>${fmtDate(r.created_at)}</td>
              <td>
                <div class="btn-group">
                  <button class="btn btn-primary btn-sm" onclick="doApprove('${r.id}')">Approve</button>
                  <button class="btn btn-danger btn-sm"  onclick="doReject('${r.id}')">Reject</button>
                </div>
              </td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gray-400)">No pending approvals</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Tenders ───────────────────────────────────────────────────────────────────
async function renderTenders(el) {
  const rows = await api.get('/tenders');
  el.innerHTML = `
    <div class="page-header flex items-center justify-between">
      <div><h2>Tenders</h2></div>
      ${['admin','ceo','department_head','manager'].includes(currentUser?.role) ? '<a href="#tenders/new" class="btn btn-primary">+ New Tender</a>' : ''}
    </div>
    <div class="grid grid-2 gap-3">
      ${rows.map(t => `<div class="card card-body">
        <div class="flex items-center justify-between mb-2">
          ${badge(t.status)}
          ${t.category ? `<span class="badge" style="background:#f0fdf4;color:#22c55e">${esc(t.category)}</span>` : ''}
        </div>
        <div style="font-weight:700;margin-bottom:.25rem">${esc(t.title)}</div>
        ${t.deadline ? `<div class="text-xs text-gray">Due: ${fmtDate(t.deadline)}</div>` : ''}
        <a href="#tenders/${t.id}" class="btn btn-outline btn-sm mt-2" style="width:fit-content">View Details →</a>
      </div>`).join('') || '<p style="color:var(--gray-400);padding:2rem;text-align:center">No tenders yet</p>'}
    </div>`;
}

async function renderTenderForm(el) {
  const companies = await api.get('/companies').catch(() => []);
  el.innerHTML = `
    <div class="page-header"><h2>New Tender</h2></div>
    <div class="card" style="max-width:600px">
      <div class="card-body">
        <div id="tender-error"></div>
        <div class="form-group"><label class="form-label">Title *</label><input id="t-title" class="form-control"></div>
        <div class="form-group"><label class="form-label">Category</label><input id="t-category" class="form-control"></div>
        <div class="grid grid-2">
          <div class="form-group"><label class="form-label">Budget (AED)</label><input id="t-budget" type="number" class="form-control"></div>
          <div class="form-group"><label class="form-label">Deadline</label><input id="t-deadline" type="date" class="form-control"></div>
          <div class="form-group"><label class="form-label">Quantity</label><input id="t-qty" type="number" class="form-control"></div>
          <div class="form-group"><label class="form-label">Unit</label><input id="t-unit" class="form-control" placeholder="pcs, kg, boxes…"></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><textarea id="t-desc" class="form-control" rows="3"></textarea></div>
        <div class="form-group"><label class="form-label">Specifications</label><textarea id="t-spec" class="form-control" rows="3"></textarea></div>
        <div class="btn-group">
          <a href="#tenders" class="btn btn-outline">Cancel</a>
          <button class="btn btn-primary" onclick="submitTender()">Publish Tender</button>
        </div>
      </div>
    </div>`;
}

async function submitTender() {
  const title = document.getElementById('t-title')?.value?.trim();
  if (!title) { showFormError('tender-error', 'Title is required'); return; }
  try {
    await api.post('/tenders', {
      title,
      category:       document.getElementById('t-category')?.value  || '',
      budget:         document.getElementById('t-budget')?.value    || null,
      deadline:       document.getElementById('t-deadline')?.value  || null,
      quantity:       document.getElementById('t-qty')?.value       || null,
      unit:           document.getElementById('t-unit')?.value      || null,
      description:    document.getElementById('t-desc')?.value      || '',
      specifications: document.getElementById('t-spec')?.value      || '',
    });
    window.location.hash = 'tenders';
  } catch (err) { showFormError('tender-error', err.data?.error || 'Failed'); }
}

async function renderTenderDetail(el, id) {
  const t = await api.get('/tenders/' + id);
  const quotesData = await api.get('/tenders/' + id + '/quotes').catch(() => []);
  const isAdmin = ['admin','ceo','department_head','manager'].includes(currentUser?.role);
  el.innerHTML = `
    <a href="#tenders" class="btn btn-outline btn-sm mb-4">← Back</a>
    <div class="card" style="max-width:700px">
      <div class="card-header">
        <h3>${esc(t.title)}</h3>
        ${badge(t.status)}
      </div>
      <div class="card-body">
        <div class="grid grid-3 gap-3 mb-4">
          ${t.budget   ? `<div><div class="text-xs text-gray">Budget</div><div class="font-bold">AED ${fmt(t.budget)}</div></div>` : ''}
          ${t.deadline ? `<div><div class="text-xs text-gray">Deadline</div><div class="font-bold">${fmtDate(t.deadline)}</div></div>` : ''}
          ${t.category ? `<div><div class="text-xs text-gray">Category</div><div>${esc(t.category)}</div></div>` : ''}
        </div>
        ${t.description    ? `<p class="text-sm text-gray mb-3">${esc(t.description)}</p>` : ''}
        ${t.specifications ? `<div class="mb-3"><strong style="font-size:.85rem">Specifications:</strong><pre style="font-size:.8rem;white-space:pre-wrap;color:var(--gray-600);margin-top:.5rem">${esc(t.specifications)}</pre></div>` : ''}
        ${isAdmin && t.status === 'open' ? `<button class="btn btn-outline btn-sm" onclick="closeTender('${t.id}')">Close Tender</button>` : ''}
        ${isAdmin && t.status === 'closed' ? `<button class="btn btn-outline btn-sm" onclick="reopenTender('${t.id}')">Reopen Tender</button>` : ''}
        ${isAdmin && quotesData.length ? `
          <h4 style="font-size:.9rem;font-weight:700;margin:1.25rem 0 .5rem">Quotes (${quotesData.length})</h4>
          <div class="table-wrap"><table>
            <thead><tr><th>Vendor</th><th>Unit Price</th><th>Delivery</th><th>Validity</th></tr></thead>
            <tbody>
              ${quotesData.map((q,i) => `<tr style="${i===0?'background:#f0fdf4':''
}">
                <td>${esc(q.company_name || '—')}</td>
                <td style="font-weight:700;color:${i===0?'#065f46':'inherit'}">AED ${fmt(q.unit_price)}${i===0?' ⭐':''}</td>
                <td>${q.delivery_days ? q.delivery_days + ' days' : '—'}</td>
                <td>${q.validity_days ? q.validity_days + ' days' : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : ''}
      </div>
    </div>`;
}

async function closeTender(id)   { await api.put('/tenders/' + id, { status: 'closed'  }); navigateTo('tenders/' + id); }
async function reopenTender(id)  { await api.put('/tenders/' + id, { status: 'open'    }); navigateTo('tenders/' + id); }

// ── Vendors ───────────────────────────────────────────────────────────────────
async function renderVendors(el) {
  const rows = await api.get('/vendors');
  el.innerHTML = `
    <div class="page-header"><h2>Vendor Registry</h2></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(v => `<tr>
              <td style="font-weight:600">${esc(v.company_name)}</td>
              <td>${esc(v.contact_number || '—')}</td>
              <td>${esc(v.email)}</td>
              <td>${badge(v.status)}</td>
              <td>
                ${v.status === 'pending' ? `
                <div class="btn-group">
                  <button class="btn btn-primary btn-sm" onclick="approveVendor('${v.id}')">Approve</button>
                  <button class="btn btn-danger btn-sm"  onclick="rejectVendor('${v.id}')">Reject</button>
                </div>` : badge(v.status)}
              </td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gray-400)">No vendors registered</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function approveVendor(id) {
  await api.post('/vendors/' + id + '/approve', {});
  navigateTo('vendors');
}
async function rejectVendor(id) {
  await api.post('/vendors/' + id + '/reject', {});
  navigateTo('vendors');
}

// ── LPOs ──────────────────────────────────────────────────────────────────────
async function renderLPOs(el) {
  const rows = await api.get('/lpos');
  el.innerHTML = `
    <div class="page-header flex items-center justify-between">
      <div><h2>Local Purchase Orders</h2></div>
      <a href="#lpos/new" class="btn btn-primary">+ New LPO</a>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>LPO Number</th><th>Vendor</th><th>Total (AED)</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            ${rows.map(l => `<tr>
              <td style="font-weight:700;font-family:monospace">${esc(l.lpo_number)}</td>
              <td>${esc(l.vendor_name || '—')}</td>
              <td>${fmt(l.total)}</td>
              <td>${badge(l.status)}</td>
              <td>${fmtDate(l.created_at)}</td>
              <td><a href="#lpos/${l.id}" class="btn btn-outline btn-sm">View</a></td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-400)">No LPOs yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function renderLPOForm(el) {
  const [vendors, companies] = await Promise.all([
    api.get('/vendors').catch(() => []),
    api.get('/companies').catch(() => []),
  ]);
  const approvedVendors = vendors.filter(v => v.status === 'approved');
  el.innerHTML = `
    <div class="page-header"><h2>New LPO</h2></div>
    <div class="card" style="max-width:700px">
      <div class="card-body">
        <div id="lpo-error"></div>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Vendor *</label>
            <select id="lpo-vendor" class="form-control">
              <option value="">Select vendor…</option>
              ${approvedVendors.map(v => `<option value="${v.id}" data-name="${esc(v.company_name)}">${esc(v.company_name)}</option>`).join('')}
            </select>
          </div>
          ${companies.length ? `<div class="form-group">
            <label class="form-label">Company</label>
            <select id="lpo-company" class="form-control">
              <option value="">Select company…</option>
              ${companies.map(c => `<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
            </select>
          </div>` : '<div></div>'}
          <div class="form-group"><label class="form-label">Payment Terms</label>
            <select id="lpo-terms" class="form-control">
              <option>Net 30</option><option>Net 60</option><option>Advance</option><option>On Delivery</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Delivery (days)</label>
            <input id="lpo-delivery" type="number" class="form-control" placeholder="14">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Notes</label>
          <textarea id="lpo-notes" class="form-control" rows="2"></textarea>
        </div>
        <h4 style="font-weight:700;margin-bottom:.75rem">Line Items</h4>
        <div id="lpo-items"></div>
        <button class="btn btn-outline btn-sm mb-4" onclick="addLPOItem()">+ Add Item</button>
        <div id="lpo-totals" style="text-align:right;font-size:.9rem;margin-bottom:1rem"></div>
        <div class="btn-group">
          <a href="#lpos" class="btn btn-outline">Cancel</a>
          <button class="btn btn-primary" onclick="submitLPO()">Create LPO</button>
        </div>
      </div>
    </div>`;
  addLPOItem();
  updateLPOTotals();
}

let lpoItemCount = 0;
function addLPOItem() {
  lpoItemCount++;
  const n = lpoItemCount;
  const wrap = document.getElementById('lpo-items');
  const row = document.createElement('div');
  row.id = 'lpo-item-' + n;
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:.5rem;margin-bottom:.5rem;align-items:end';
  row.innerHTML = `
    <div><input class="form-control lpo-desc" placeholder="Description" oninput="updateLPOTotals()"></div>
    <div><input class="form-control lpo-qty"  type="number" value="1" min="1" placeholder="Qty"   oninput="updateLPOTotals()"></div>
    <div><input class="form-control lpo-price" type="number" step="0.01" placeholder="Unit Price" oninput="updateLPOTotals()"></div>
    <button class="btn btn-outline btn-sm" onclick="document.getElementById('lpo-item-${n}').remove();updateLPOTotals()">✕</button>`;
  wrap.appendChild(row);
}

function updateLPOTotals() {
  let sub = 0;
  document.querySelectorAll('#lpo-items > div').forEach(row => {
    const qty   = parseFloat(row.querySelector('.lpo-qty')?.value   || 0);
    const price = parseFloat(row.querySelector('.lpo-price')?.value || 0);
    sub += qty * price;
  });
  const vat   = sub * 0.05;
  const total = sub + vat;
  document.getElementById('lpo-totals').innerHTML = `
    Subtotal: <strong>AED ${fmt(sub)}</strong> &nbsp;|&nbsp;
    VAT (5%): <strong>AED ${fmt(vat)}</strong> &nbsp;|&nbsp;
    <span style="font-size:1rem;color:var(--primary)">Total: <strong>AED ${fmt(total)}</strong></span>`;
}

async function submitLPO() {
  const vendorSel = document.getElementById('lpo-vendor');
  const vendorId  = vendorSel?.value;
  if (!vendorId) { showFormError('lpo-error', 'Please select a vendor'); return; }
  const items = [];
  document.querySelectorAll('#lpo-items > div').forEach(row => {
    const desc  = row.querySelector('.lpo-desc')?.value?.trim();
    const qty   = parseFloat(row.querySelector('.lpo-qty')?.value   || 0);
    const price = parseFloat(row.querySelector('.lpo-price')?.value || 0);
    if (desc && qty > 0 && price > 0) items.push({ description: desc, qty, unit_price: price });
  });
  if (!items.length) { showFormError('lpo-error', 'Add at least one line item'); return; }
  const compSel = document.getElementById('lpo-company');
  try {
    await api.post('/lpos', {
      vendor_id:    vendorId,
      vendor_name:  vendorSel.options[vendorSel.selectedIndex]?.dataset.name,
      company_id:   compSel?.value   || null,
      company_name: compSel?.options[compSel.selectedIndex]?.dataset.name || null,
      items,
      vat_pct:       5,
      payment_terms: document.getElementById('lpo-terms')?.value   || 'Net 30',
      delivery_days: document.getElementById('lpo-delivery')?.value || null,
      notes:         document.getElementById('lpo-notes')?.value    || '',
    });
    window.location.hash = 'lpos';
  } catch (err) { showFormError('lpo-error', err.data?.error || 'Failed'); }
}

async function renderLPODetail(el, id) {
  const l = await api.get('/lpos/' + id);
  el.innerHTML = `
    <a href="#lpos" class="btn btn-outline btn-sm mb-4">← Back</a>
    <div class="card" style="max-width:800px">
      <div class="card-header">
        <h3 style="font-family:monospace">${esc(l.lpo_number)}</h3>
        ${badge(l.status)}
      </div>
      <div class="card-body">
        <div class="grid grid-2 gap-4 mb-4">
          <div><div class="text-xs text-gray">Vendor</div><div class="font-bold">${esc(l.vendor_name || '—')}</div></div>
          <div><div class="text-xs text-gray">Company</div><div>${esc(l.company_name || '—')}</div></div>
          <div><div class="text-xs text-gray">Payment Terms</div><div>${esc(l.payment_terms || '—')}</div></div>
          <div><div class="text-xs text-gray">Date</div><div>${fmtDate(l.created_at)}</div></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit Price (AED)</th><th>Total (AED)</th></tr></thead>
            <tbody>
              ${(l.items || []).map(i => `<tr>
                <td>${esc(i.description)}</td>
                <td>${i.qty}</td>
                <td>${fmt(i.unit_price)}</td>
                <td>${fmt(i.qty * i.unit_price)}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="3" style="text-align:right;font-weight:600">Subtotal</td><td>${fmt(l.subtotal)}</td></tr>
              <tr><td colspan="3" style="text-align:right;font-weight:600">VAT (${l.vat_pct}%)</td><td>${fmt(l.vat_amount)}</td></tr>
              <tr style="background:var(--primary-l)"><td colspan="3" style="text-align:right;font-weight:800">Total</td><td style="font-weight:800;color:var(--primary)">AED ${fmt(l.total)}</td></tr>
            </tfoot>
          </table>
        </div>
        ${l.status === 'draft' ? `<button class="btn btn-primary btn-sm mt-4" onclick="advanceLPO('${l.id}','sent')">Mark as Sent</button>` : ''}
        ${l.status === 'sent'  ? `<button class="btn btn-primary btn-sm mt-4" onclick="advanceLPO('${l.id}','acknowledged')">Mark as Acknowledged</button>` : ''}
      </div>
    </div>`;
}

async function advanceLPO(id, status) {
  await api.put('/lpos/' + id, { status });
  navigateTo('lpos/' + id);
}

// ── Companies ─────────────────────────────────────────────────────────────────
async function renderCompanies(el) {
  const rows = await api.get('/companies');
  el.innerHTML = `
    <div class="page-header flex items-center justify-between">
      <div><h2>Companies</h2></div>
      <a href="#companies/new" class="btn btn-primary">+ Add Company</a>
    </div>
    <div class="grid grid-3 gap-3">
      ${rows.map(c => `<div class="card card-body">
        <div style="font-weight:700;font-size:1rem;margin-bottom:.25rem">${esc(c.name)}</div>
        ${c.vat_number ? `<div class="text-xs text-gray">VAT: ${esc(c.vat_number)}</div>` : ''}
        ${c.email      ? `<div class="text-xs text-gray">${esc(c.email)}</div>` : ''}
        <div class="flex items-center gap-2 mt-3">
          <button class="btn btn-danger btn-sm" onclick="deleteCompany('${c.id}','${esc(c.name)}')">Delete</button>
        </div>
      </div>`).join('') || '<p style="color:var(--gray-400);padding:2rem;text-align:center">No companies registered</p>'}
    </div>`;
}

async function renderCompanyForm(el) {
  el.innerHTML = `
    <div class="page-header"><h2>Add Company</h2></div>
    <div class="card" style="max-width:600px">
      <div class="card-body">
        <div id="company-error"></div>
        <div class="grid grid-2">
          <div class="form-group"><label class="form-label">Company Name *</label><input id="co-name" class="form-control"></div>
          <div class="form-group"><label class="form-label">Trade Name</label><input id="co-trade" class="form-control"></div>
          <div class="form-group"><label class="form-label">VAT Number</label><input id="co-vat" class="form-control"></div>
          <div class="form-group"><label class="form-label">Phone</label><input id="co-phone" class="form-control"></div>
          <div class="form-group"><label class="form-label">Email</label><input id="co-email" class="form-control"></div>
          <div class="form-group"><label class="form-label">Website</label><input id="co-web" class="form-control"></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><textarea id="co-addr" class="form-control" rows="2"></textarea></div>
        <div class="grid grid-2">
          <div class="form-group"><label class="form-label">Bank Name</label><input id="co-bank" class="form-control"></div>
          <div class="form-group"><label class="form-label">IBAN</label><input id="co-iban" class="form-control"></div>
          <div class="form-group"><label class="form-label">SWIFT / BIC</label><input id="co-swift" class="form-control"></div>
        </div>
        <div class="btn-group">
          <a href="#companies" class="btn btn-outline">Cancel</a>
          <button class="btn btn-primary" onclick="submitCompany()">Save Company</button>
        </div>
      </div>
    </div>`;
}

async function submitCompany() {
  const name = document.getElementById('co-name')?.value?.trim();
  if (!name) { showFormError('company-error', 'Company name is required'); return; }
  try {
    await api.post('/companies', {
      name, trade_name: document.getElementById('co-trade')?.value || '',
      vat_number: document.getElementById('co-vat')?.value   || '',
      phone:      document.getElementById('co-phone')?.value || '',
      email:      document.getElementById('co-email')?.value || '',
      website:    document.getElementById('co-web')?.value   || '',
      address:    document.getElementById('co-addr')?.value  || '',
      bank_name:  document.getElementById('co-bank')?.value  || '',
      iban:       document.getElementById('co-iban')?.value  || '',
      swift_code: document.getElementById('co-swift')?.value || '',
    });
    window.location.hash = 'companies';
  } catch (err) { showFormError('company-error', err.data?.error || 'Failed'); }
}

async function deleteCompany(id, name) {
  if (!confirm(`Delete ${name}?`)) return;
  await api.delete('/companies/' + id);
  navigateTo('companies');
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
async function renderAdmin(el) {
  const [levels, users] = await Promise.all([
    api.get('/admin/approval-levels'),
    api.get('/users'),
  ]);
  el.innerHTML = `
    <div class="page-header"><h2>Admin Panel</h2></div>
    <div class="card mb-4" style="max-width:600px">
      <div class="card-header"><h3>Approval Thresholds (AED)</h3></div>
      <div class="card-body">
        ${levels.filter(l => l.role !== 'ceo').map(l => `<div class="flex items-center justify-between mb-3">
          <label style="font-weight:600;font-size:.9rem">${esc(l.label)}</label>
          <div class="input-prefix" style="width:180px">
            <span class="prefix">AED</span>
            <input class="form-control" id="lvl-${l.role}" type="number" value="${l.max_amount}" style="padding-left:3rem">
          </div>
        </div>`).join('')}
        <button class="btn btn-accent mt-2" onclick="saveLevels(${JSON.stringify(levels.map(l=>l.role))})">Save Thresholds</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Users (${users.length})</h3>
        <button class="btn btn-accent btn-sm" onclick="showAddUser()">+ Add User</button>
      </div>
      <div id="users-table">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${users.map(u => `<tr>
                <td style="font-weight:600">${esc(u.name)}</td>
                <td>${esc(u.email)}</td>
                <td><span class="badge" style="background:#fce7f3;color:#9d174d">${esc(u.role)}</span></td>
                <td><span class="badge ${u.is_active ? 'badge-approved' : 'badge-cancelled'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}','${esc(u.name)}')">Delete</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="add-user-modal" class="hidden">
      <div class="modal-overlay">
        <div class="modal-box">
          <div class="modal-title">Add New User</div>
          <div id="add-user-error"></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label">Name *</label><input id="nu-name" class="form-control"></div>
            <div class="form-group"><label class="form-label">Email *</label><input id="nu-email" type="email" class="form-control"></div>
            <div class="form-group"><label class="form-label">Password *</label><input id="nu-pass" type="password" class="form-control"></div>
            <div class="form-group"><label class="form-label">Role *</label>
              <select id="nu-role" class="form-control">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="department_head">Dept Head</option>
                <option value="ceo">CEO</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Department</label><input id="nu-dept" class="form-control"></div>
          </div>
          <div class="btn-group mt-2">
            <button class="btn btn-outline" onclick="document.getElementById('add-user-modal').classList.add('hidden')">Cancel</button>
            <button class="btn btn-accent" onclick="doAddUser()">Create User</button>
          </div>
        </div>
      </div>
    </div>`;
}

async function saveLevels(roles) {
  const levels = roles.filter(r => r !== 'ceo').map(r => ({
    role: r, max_amount: parseFloat(document.getElementById('lvl-' + r)?.value || 0),
  }));
  try { await api.put('/admin/approval-levels', { levels }); alert('Saved!'); }
  catch { alert('Failed to save'); }
}

function showAddUser() { document.getElementById('add-user-modal')?.classList.remove('hidden'); }

async function doAddUser() {
  const body = {
    name:       document.getElementById('nu-name')?.value?.trim(),
    email:      document.getElementById('nu-email')?.value?.trim(),
    password:   document.getElementById('nu-pass')?.value,
    role:       document.getElementById('nu-role')?.value,
    department: document.getElementById('nu-dept')?.value || '',
  };
  if (!body.name || !body.email || !body.password) {
    showFormError('add-user-error', 'Name, email and password are required');
    return;
  }
  try {
    await api.post('/users', body);
    navigateTo('admin');
  } catch (err) { showFormError('add-user-error', err.data?.error || 'Failed'); }
}

async function deleteUser(id, name) {
  if (!confirm('Delete ' + name + '?')) return;
  await api.delete('/users/' + id);
  navigateTo('admin');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n) { return parseFloat(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
function badge(status) {
  const cls = { pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected',
    cancelled:'badge-cancelled', draft:'badge-draft', sent:'badge-sent', open:'badge-open', closed:'badge-closed' };
  return `<span class="badge ${cls[status] || 'badge-cancelled'}">${status || '—'}</span>`;
}
function showFormError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.innerHTML = `<div class="alert alert-error">${esc(msg)}</div>`; }
}

// ── HTML Templates ────────────────────────────────────────────────────────────
function loginHTML() {
  return `<div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <div id="login-logo" style="font-size:2.5rem;margin-bottom:.75rem">🛒</div>
        <h1 id="login-company-name">Purchase Approval System</h1>
        <p>Staff &amp; Admin Portal</p>
      </div>
      <div class="auth-body">
        <div id="login-error" class="alert alert-error" style="display:none"></div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="email" class="form-control" placeholder="you@company.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="password" class="form-control" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-primary w-full" style="justify-content:center">Sign In →</button>
        </form>
        <p style="text-align:center;font-size:.8rem;color:var(--gray-400);margin-top:1.25rem">
          Vendor? <a href="vendor-login.html" style="color:var(--primary)">Vendor Portal →</a>
          &nbsp;|&nbsp; <a href="index.html" style="color:var(--gray-400)">Home</a>
        </p>
      </div>
    </div>
  </div>`;
}

function appShellHTML() {
  return `
    <div id="sidebar-overlay" class="overlay-bg"></div>
    <div id="app">
      <nav id="sidebar" class="sidebar">
        <div class="sidebar-logo">
          <div class="logo-icon" id="sidebar-logo-icon">🏢</div>
          <div><span id="sidebar-company-name">Procurement</span><small>Purchase Approval</small></div>
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
        <main class="page-content" id="page-content">
          <div class="spinner"></div>
        </main>
      </div>
    </div>`;
}
