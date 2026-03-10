import crypto from 'crypto';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const PW_HASH = process.env.PW_HASH;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = `${SUPABASE_URL}/rest/v1`;
  const dbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  // 세션 토큰 유효성 검사 함수
  async function isValidSession(token) {
    if (!token) return false;
    const r = await fetch(`${base}/sessions?token=eq.${token}&select=token`, { headers: dbHeaders });
    const json = await r.json();
    return json.length > 0;
  }

  if (req.method === 'GET') {
    const r = await fetch(`${base}/timetable?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const data = json[0]?.data || {};
    delete data.pwHash;
    return res.status(200).json(data);
  }

  // POST ?action=verify: 비밀번호 검증 → 세션 토큰 발급
  if (req.method === 'POST' && req.query.action === 'verify') {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ ok: false });
    const r = await fetch(`${base}/timetable?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const dbHash = json[0]?.data?.pwHash;
    const expected = dbHash || PW_HASH;
    if (hash !== expected) return res.status(200).json({ ok: false });
    // 세션 토큰 발급 및 저장
    const token = generateToken();
    await fetch(`${base}/sessions`, {
      method: 'POST',
      headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ token }),
    });
    return res.status(200).json({ ok: true, token });
  }

  // POST ?action=changepw: 비밀번호 변경 (세션 필요)
  if (req.method === 'POST' && req.query.action === 'changepw') {
    const sessionToken = req.headers['x-session-token'];
    if (!await isValidSession(sessionToken)) return res.status(401).json({ error: 'Unauthorized' });
    const { currentHash, newHash } = req.body;
    const r = await fetch(`${base}/timetable?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const data = json[0]?.data || {};
    const expected = data.pwHash || PW_HASH;
    if (currentHash !== expected) return res.status(403).json({ error: 'Wrong password' });
    data.pwHash = newHash;
    await fetch(`${base}/timetable?id=eq.main`, {
      method: 'PATCH',
      headers: dbHeaders,
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ ok: true });
  }

  // PUT: 데이터 저장 (세션 필요)
  if (req.method === 'PUT') {
    const sessionToken = req.headers['x-session-token'];
    if (!await isValidSession(sessionToken)) return res.status(401).json({ error: 'Unauthorized' });
    const r = await fetch(`${base}/timetable?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const existingPwHash = json[0]?.data?.pwHash;
    const newData = { ...req.body };
    delete newData.pwHash;
    if (existingPwHash) newData.pwHash = existingPwHash;
    const patch = await fetch(`${base}/timetable?id=eq.main`, {
      method: 'PATCH',
      headers: dbHeaders,
      body: JSON.stringify({ data: newData, updated_at: new Date().toISOString() }),
    });
    return res.status(patch.ok ? 200 : 500).json({ ok: patch.ok });
  }

  return res.status(405).end();
}
