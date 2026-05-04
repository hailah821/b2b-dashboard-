export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const { start, end } = req.query;

  try {
    // Use Activities API to get meetings
    const startDate = start ? new Date(parseInt(start)).toISOString().split('T')[0] : undefined;
    const endDate = end ? new Date(parseInt(end)).toISOString().split('T')[0] : undefined;

    const filters = [];
    if (startDate) filters.push({ propertyName: 'hs_activity_date', operator: 'GTE', value: startDate });
    if (endDate)   filters.push({ propertyName: 'hs_activity_date', operator: 'LTE', value: endDate });
    filters.push({ propertyName: 'hs_activity_type', operator: 'EQ', value: 'MEETING' });

    const body = {
      limit: 100,
      properties: ['hubspot_owner_id', 'hs_activity_date', 'hs_activity_type', 'hs_body_preview'],
      filterGroups: filters.length ? [{ filters }] : []
    };

    // Try engagements search
    const r = await fetch('https://api.hubapi.com/engagements/v1/engagements/search?type=MEETING&count=100', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (r.ok) {
      const data = await r.json();
      // Filter by date
      const results = (data.results || []).filter(e => {
        const ts = e.engagement?.timestamp;
        if (!ts) return true;
        const startMs = start ? parseInt(start) : 0;
        const endMs = end ? parseInt(end) : Infinity;
        return ts >= startMs && ts <= endMs;
      }).map(e => ({
        id: e.engagement?.id,
        properties: {
          hubspot_owner_id: e.engagement?.ownerId?.toString(),
          hs_timestamp: e.engagement?.timestamp,
          hs_meeting_title: e.metadata?.title
        }
      }));

      return res.status(200).json({ results, total: results.length });
    }

    // Fallback to CRM meetings
    const r2 = await fetch('https://api.hubapi.com/crm/v3/objects/meetings/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        properties: ['hubspot_owner_id', 'hs_timestamp', 'hs_meeting_title'],
        filterGroups: start && end ? [{ filters: [
          { propertyName: 'hs_timestamp', operator: 'GTE', value: start },
          { propertyName: 'hs_timestamp', operator: 'LTE', value: end }
        ]}] : []
      })
    });
    const data2 = await r2.json();
    res.status(200).json(data2);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
