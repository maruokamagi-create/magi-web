const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://stqekbjijufefrykksji.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'magi_line_members';

const VALID_STATUS = new Set(['pending', 'active', 'disabled']);
const VALID_ROLE = new Set(['admin', 'coach', 'player', 'member']);

export function memberStoreConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function rest(query = '', options = {}) {
  if (!memberStoreConfigured()) throw new Error('member_store_not_configured');
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}${query ? `?${query}` : ''}`;
  const response = await fetch(url, {
    ...options,
    headers: headers(options.headers || {})
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    const error = new Error(`member_store_${response.status}`);
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

function memberQueryBySub(sub) {
  const params = new URLSearchParams();
  params.set('line_sub', `eq.${String(sub)}`);
  params.set('select', 'id,line_sub,display_name,picture_url,status,role,created_at,updated_at,last_login_at');
  params.set('limit', '1');
  return params.toString();
}

export async function getMemberBySub(sub) {
  const rows = await rest(memberQueryBySub(sub));
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function getMemberById(id) {
  const params = new URLSearchParams();
  params.set('id', `eq.${String(id)}`);
  params.set('select', 'id,line_sub,display_name,picture_url,status,role,created_at,updated_at,last_login_at');
  params.set('limit', '1');
  const rows = await rest(params.toString());
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function ensureLineMember(profile) {
  const sub = String(profile?.sub || '');
  if (!sub) throw new Error('missing_line_sub');

  const now = new Date().toISOString();
  let member = await getMemberBySub(sub);
  if (member) {
    const params = new URLSearchParams();
    params.set('line_sub', `eq.${sub}`);
    const updated = await rest(params.toString(), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        display_name: String(profile?.name || member.display_name || ''),
        picture_url: String(profile?.picture || member.picture_url || ''),
        last_login_at: now,
        updated_at: now
      })
    });
    return Array.isArray(updated) && updated.length ? updated[0] : { ...member, last_login_at: now };
  }

  const countParams = new URLSearchParams();
  countParams.set('select', 'id');
  countParams.set('limit', '1');
  const existing = await rest(countParams.toString());
  const firstUser = Array.isArray(existing) && existing.length === 0;
  const payload = {
    line_sub: sub,
    display_name: String(profile?.name || ''),
    picture_url: String(profile?.picture || ''),
    status: firstUser ? 'active' : 'pending',
    role: firstUser ? 'admin' : 'member',
    last_login_at: now,
    updated_at: now
  };

  try {
    const inserted = await rest('', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    return Array.isArray(inserted) && inserted.length ? inserted[0] : payload;
  } catch (error) {
    if (error?.status === 409) return getMemberBySub(sub);
    throw error;
  }
}

export async function listMembers() {
  const params = new URLSearchParams();
  params.set('select', 'id,display_name,picture_url,status,role,created_at,updated_at,last_login_at');
  params.set('order', 'created_at.asc');
  const rows = await rest(params.toString());
  return Array.isArray(rows) ? rows : [];
}

export async function updateMember(id, patch) {
  const status = String(patch?.status || '');
  const role = String(patch?.role || '');
  if (status && !VALID_STATUS.has(status)) throw new Error('invalid_status');
  if (role && !VALID_ROLE.has(role)) throw new Error('invalid_role');

  const body = { updated_at: new Date().toISOString() };
  if (status) body.status = status;
  if (role) body.role = role;

  const params = new URLSearchParams();
  params.set('id', `eq.${String(id)}`);
  const rows = await rest(params.toString(), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}
