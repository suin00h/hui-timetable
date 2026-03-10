export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = `${SUPABASE_URL}/rest/v1/timetable`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  if (req.method === 'GET') {
    const r = await fetch(`${base}?id=eq.main&select=data`, { headers });
    const json = await r.json();
    return res.status(200).json(json[0]?.data || {});
  }

  if (req.method === 'PUT') {
    const r = await fetch(`${base}?id=eq.main`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ data: req.body, updated_at: new Date().toISOString() }),
    });
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
  }

  return res.status(405).end();
}
