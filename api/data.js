const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('timetable')
      .select('data')
      .eq('id', 'main')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data.data);
  }

  if (req.method === 'PUT') {
    const { error } = await supabase
      .from('timetable')
      .update({ data: req.body, updated_at: new Date().toISOString() })
      .eq('id', 'main');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
