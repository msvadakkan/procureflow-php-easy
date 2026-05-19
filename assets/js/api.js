/* ─── Lightweight API client ─────────────────────────────────────────────── */
// Derive base from the script's own URL so subdirectory installs work.
// e.g. https://example.com/procurement/assets/js/api.js → /procurement/api
const BASE = (() => {
  const src = document.querySelector('script[src*="api.js"]')?.src || '';
  return src ? src.replace(/\/assets\/js\/api\.js.*$/, '/api') : (window.location.origin + '/api');
})();

async function request(method, path, body = null, isFormData = false) {
  const headers = {};
  const isVendorPath = window.location.pathname.startsWith('/vendor');
  const token = isVendorPath
    ? localStorage.getItem('vendorToken')
    : localStorage.getItem('token');

  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw { status: res.status, data };
  return data;
}

const api = {
  get:    (path)          => request('GET',    path),
  post:   (path, body, fd) => request('POST',  path, body, fd),
  put:    (path, body)    => request('PUT',    path, body),
  delete: (path)          => request('DELETE', path),
};
