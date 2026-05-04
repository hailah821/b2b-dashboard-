export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const { start, end } = req.query;

  try {
    const startDate = start ? new Date(parseInt(start)).toISOString().split('T')[0] : undefined;
    const endDate = end ? new Date(parseInt(end)).toISOString().split('T')[0] : undefined;

    const body = {
      limit: 100,
      properties: ['hubspot_owner_id', 'hs_timestamp', 'hs_meeting_title', 'hs_activity_type'],
      filterGroups: startDate && endDate ? [{ filters: [
        { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: startDate },
        { propertyName: 'hs_lastmodifieddate', operator: 'LTE', value: endDate }
      ]}] : []
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
