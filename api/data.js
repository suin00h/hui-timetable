import crypto from 'crypto';

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const WRITE_SECRET = process.env.WRITE_SECRET;
  const PW_HASH = process.env.PW_HASH;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-write-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = `${SUPABASE_URL}/rest/v1/timetable`;
  const dbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  // GET: 데이터 읽기 (pwHash 제외)
  if (req.method === 'GET') {
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const data = json[0]?.data || {};
    delete data.pwHash; // 절대 클라이언트에 노출 안 함
    return res.status(200).json(data);
  }

  // POST /api/data?action=verify: 비밀번호 검증
  if (req.method === 'POST' && req.query.action === 'verify') {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ ok: false });
    // 현재 비밀번호: DB에 저장된 것 우선, 없으면 환경변수
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const dbHash = json[0]?.data?.pwHash;
    const expected = dbHash || PW_HASH;
    return res.status(200).json({ ok: hash === expected });
  }

  // POST /api/data?action=changepw: 비밀번호 변경
  if (req.method === 'POST' && req.query.action === 'changepw') {
    if (req.headers['x-write-token'] !== WRITE_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { currentHash, newHash } = req.body;
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const data = json[0]?.data || {};
    const expected = data.pwHash || PW_HASH;
    if (currentHash !== expected) return res.status(403).json({ error: 'Wrong password' });
    // 새 해시를 DB에 저장
    data.pwHash = newHash;
    await fetch(`${base}?id=eq.main`, {
      method: 'PATCH',
      headers: dbHeaders,
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ ok: true });
  }

  // PUT: 데이터 저장 (토큰 필요)
  if (req.method === 'PUT') {
    if (req.headers['x-write-token'] !== WRITE_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // pwHash는 클라이언트가 건드리지 못하게 DB 값 유지
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const existingPwHash = json[0]?.data?.pwHash;
    const newData = { ...req.body };
    delete newData.pwHash; // 클라이언트 보낸 pwHash 무시
    if (existingPwHash) newData.pwHash = existingPwHash; // DB 값 유지
    const patch = await fetch(`${base}?id=eq.main`, {
      method: 'PATCH',
      headers: dbHeaders,
      body: JSON.stringify({ data: newData, updated_at: new Date().toISOString() }),
    });
    return res.status(patch.ok ? 200 : 500).json({ ok: patch.ok });
  }

  return res.status(405).end();
}
