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

  if (req.method === 'GET') {
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const data = json[0]?.data || {};
    delete data.pwHash;
    return res.status(200).json(data);
  }

  if (req.method === 'POST' && req.query.action === 'verify') {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ ok: false });
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const dbHash = json[0]?.data?.pwHash;
    const expected = dbHash || PW_HASH;
    return res.status(200).json({ ok: hash === expected });
  }

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
    data.pwHash = newHash;
    await fetch(`${base}?id=eq.main`, {
      method: 'PATCH',
      headers: dbHeaders,
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PUT') {
    if (req.headers['x-write-token'] !== WRITE_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers: dbHeaders });
    const json = await r.json();
    const existingPwHash = json[0]?.data?.pwHash;
    const newData = { ...req.body };
    delete newData.pwHash;
    if (existingPwHash) newData.pwHash = existingPwHash;
    const patch = await fetch(`${base}?id=eq.main`, {
      method: 'PATCH',
      headers: dbHeaders,
      body: JSON.stringify({ data: newData, updated_at: new Date().toISOString() }),
    });
    return res.status(patch.ok ? 200 : 500).json({ ok: patch.ok });
  }

  return res.status(405).end();
}
