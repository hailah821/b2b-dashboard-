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
    if (start) filters.push({ propertyName: 'closedate', operator: 'GTE', value: start });
    if (end)   filters.push({ propertyName: 'closedate', operator: 'LTE', value: end });

    let allResults = [];
    let after = undefined;

    while (true) {
      const body = {
        limit: 100,
        properties: ['dealname','amount','dealstage','pipeline','closedate','createdate','hubspot_owner_id'],
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
        ...(filters.length ? { filterGroups: [{ filters }] } : {}),
        ...(after ? { after } : {})
      };

      const r = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      allResults = allResults.concat(data.results || []);

      if (data.paging?.next?.after) {
        after = data.paging.next.after;
      } else {
        return res.status(200).json({ results: allResults, total: allResults.length });
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
