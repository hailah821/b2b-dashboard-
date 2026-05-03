export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const { start, end } = req.query;

  try {
    const filters = [];
    if (start) filters.push({ propertyName: 'hs_timestamp', operator: 'GTE', value: start });
    if (end)   filters.push({ propertyName: 'hs_timestamp', operator: 'LTE', value: end });

    const body = {
      limit: 100,
      properties: ['hs_meeting_title','hubspot_owner_id','hs_timestamp','hs_meeting_outcome','hs_activity_type'],
      ...(filters.length ? { filterGroups: [{ filters }] } : {})
    };
    const r = await fetch('https://api.hubapi.com/crm/v3/objects/meetings/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
