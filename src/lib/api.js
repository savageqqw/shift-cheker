function getToken() {
  return localStorage.getItem('shiftly_token');
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.pathname + url.search, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'Помилка запиту');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (password) => request('/api/auth', { method: 'POST', body: { password } }),

  getScheduleState: () => request('/api/schedule', { params: { action: 'state' } }),
  updateSettings: (payload) =>
    request('/api/schedule', { method: 'POST', params: { action: 'update-settings' }, body: payload }),
  setOverride: (payload) =>
    request('/api/schedule', { method: 'POST', params: { action: 'set-override' }, body: payload }),
  deleteOverride: (date) =>
    request('/api/schedule', { method: 'POST', params: { action: 'delete-override' }, body: { date } }),

  listShifts: (from, to) => request('/api/shifts', { params: { action: 'list', from, to } }),
  getStats: (from, to) => request('/api/shifts', { params: { action: 'stats', from, to } }),
  upsertShift: (payload) => request('/api/shifts', { method: 'POST', params: { action: 'upsert' }, body: payload }),
  deleteShift: (date) => request('/api/shifts', { method: 'POST', params: { action: 'delete' }, body: { date } })
};
