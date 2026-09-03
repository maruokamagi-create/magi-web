const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://stqekbjijufefrykksji.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'magi_line_members';
const PROFILE_PREFIX = 'MAGI_PROFILE:';

const VALID_STATUS = new Set(['pending', 'active', 'disabled']);
const VALID_ROLE = new Set(['admin', 'coach', 'player', 'member']);
const REQUESTABLE_ROLE = new Set(['coach', 'player', 'member']);

export function memberStoreConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function headers(extra = {}) {
  const base = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (!SERVICE_KEY.startsWith('sb_secret_')) base.Authorization = `Bearer ${SERVICE_KEY}`;
  return { ...base, ...extra };
}

async function rest(query = '', options = {}) {
  if (!memberStoreConfigured()) throw new Error('member_store_not_configured');
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}${query ? `?${query}` : ''}`;
  const response = await fetch(url, { ...options, headers: headers(options.headers || {}) });
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

function clean(value, max = 80) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function encodeIdentity(formalName, lineDisplayName) {
  return PROFILE_PREFIX + JSON.stringify({
    formal: clean(formalName, 60),
    line: clean(lineDisplayName, 80)
  });
}

export function decodeIdentity(value) {
  const raw = String(value || '');
  if (raw.startsWith(PROFILE_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(PROFILE_PREFIX.length));
      return {
        formalName: clean(parsed?.formal, 60),
        lineDisplayName: clean(parsed?.line, 80),
        structured: true
      };
    } catch (_) {}
  }
  const legacy = clean(raw, 80);
  return { formalName: legacy, lineDisplayName: legacy, structured: false };
}

export function presentMember(member) {
  if (!member) return null;
  const identity = decodeIdentity(member.display_name);
  return {
    ...member,
    display_name: identity.formalName || identity.lineDisplayName || '',
    formal_name: identity.formalName,
    line_display_name: identity.lineDisplayName,
    profile_complete: Boolean(identity.formalName)
  };
}

const MEMBER_SELECT = 'id,line_sub,display_name,picture_url,status,role,created_at,updated_at,last_login_at';

function memberQueryBySub(sub) {
  const params = new URLSearchParams();
  params.set('line_sub', `eq.${String(sub)}`);
  params.set('select', MEMBER_SELECT);
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
  params.set('select', MEMBER_SELECT);
  params.set('limit', '1');
  const rows = await rest(params.toString());
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function ensureLineMember(profile) {
  const sub = String(profile?.sub || '');
  if (!sub) throw new Error('missing_line_sub');

  const now = new Date().toISOString();
  const lineName = clean(profile?.name, 80);
  let member = await getMemberBySub(sub);

  if (member) {
    const identity = decodeIdentity(member.display_name);
    let storedName = member.display_name;

    // Pending users created before this feature are converted to the new format.
    // Active legacy users (including the first administrator) keep their approved name.
    if (member.status === 'pending' && !identity.structured) {
      storedName = encodeIdentity('', lineName || identity.lineDisplayName);
    } else if (identity.structured) {
      storedName = encodeIdentity(identity.formalName, lineName || identity.lineDisplayName);
    }

    const params = new URLSearchParams();
    params.set('line_sub', `eq.${sub}`);
    const updated = await rest(params.toString(), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        display_name: storedName,
        picture_url: String(profile?.picture || member.picture_url || ''),
        last_login_at: now,
        updated_at: now
      })
    });
    const raw = Array.isArray(updated) && updated.length ? updated[0] : { ...member, display_name: storedName, last_login_at: now };
    return presentMember(raw);
  }

  const countParams = new URLSearchParams();
  countParams.set('select', 'id');
  countParams.set('limit', '1');
  const existing = await rest(countParams.toString());
  const firstUser = Array.isArray(existing) && existing.length === 0;

  const payload = {
    line_sub: sub,
    display_name: firstUser ? lineName : encodeIdentity('', lineName),
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
    const raw = Array.isArray(inserted) && inserted.length ? inserted[0] : payload;
    return presentMember(raw);
  } catch (error) {
    if (error?.status === 409) return presentMember(await getMemberBySub(sub));
    throw error;
  }
}

export async function submitOwnProfile(sub, profile = {}) {
  const formalName = clean(profile.formalName, 60);
  const requestedRole = clean(profile.requestedRole, 20);
  const lineDisplayName = clean(profile.lineDisplayName, 80);
  if (formalName.length < 2) throw new Error('invalid_formal_name');
  if (!REQUESTABLE_ROLE.has(requestedRole)) throw new Error('invalid_requested_role');

  const member = await getMemberBySub(sub);
  if (!member) throw new Error('member_not_found');
  if (member.status !== 'pending') throw new Error('profile_not_editable');

  const identity = decodeIdentity(member.display_name);
  const params = new URLSearchParams();
  params.set('line_sub', `eq.${String(sub)}`);
  const updated = await rest(params.toString(), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      display_name: encodeIdentity(formalName, lineDisplayName || identity.lineDisplayName),
      role: requestedRole,
      updated_at: new Date().toISOString()
    })
  });
  const raw = Array.isArray(updated) && updated.length ? updated[0] : member;
  return presentMember(raw);
}

export async function listMembers() {
  const params = new URLSearchParams();
  params.set('select', 'id,display_name,picture_url,status,role,created_at,updated_at,last_login_at');
  params.set('order', 'created_at.asc');
  const rows = await rest(params.toString());
  return Array.isArray(rows) ? rows.map(presentMember) : [];
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
  return Array.isArray(rows) && rows.length ? presentMember(rows[0]) : null;
}
