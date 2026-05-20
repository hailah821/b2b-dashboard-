export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'No token' });
  try {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const y = now.getFullYear();
    const start = new Date(y, q * 3, 1).toISOString();
    const end = new Date(y, q * 3 + 3, 0).toISOString();
    const r = await fetch('https://api.hubapi.com/crm/v3/objects/notes/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        properties: ['hs_note_body', 'hubspot_owner_id', 'hs_createdate', 'hs_timestamp'],
        sorts: [{ propertyName: 'hs_createdate', direction: 'DESCENDING' }],
        filterGroups: [{ filters: [
          { propertyName: 'hs_createdate', operator: 'GTE', value: start },
          { propertyName: 'hs_createdate', operator: 'LTE', value: end }
        ]}]
      })
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
}
