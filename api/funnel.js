export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const { start, end, type } = req.query;

  try {
    const qStart = start;
    const qEnd = end;
    const yearStart = new Date(new Date(start).getFullYear(), 0, 1).toISOString().split('T')[0];
    const yearEnd = new Date(new Date(start).getFullYear(), 11, 31).toISOString().split('T')[0];
    const qStartDate = new Date(start);
    const lqStart = new Date(qStartDate.getFullYear(), qStartDate.getMonth() - 3, 1).toISOString().split('T')[0];
    const lqEnd = new Date(qStartDate.getTime() - 86400000).toISOString().split('T')[0];

    async function fetchPage(url, body) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) return { results: [], total: 0 };
      return r.json();
    }

    // Owners
    const ownersRes = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const ownersData = await ownersRes.json();
    const owners = {};
    (ownersData.results || []).forEach(o => {
      owners[o.id] = ((o.firstName||'') + ' ' + (o.lastName||'')).trim() || 'Rep'+o.id.slice(-4);
    });

    const funnels = {};
    Object.entries(owners).forEach(([id, name]) => {
      funnels[id] = { name, leads: 0, reachOut: 0, meetings: 0, closeWon: 0, retention: 0 };
    });

    if (type === 'leads') {
      // Leads this year - just first page
      const d = await fetchPage('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        limit: 100,
        properties: ['hubspot_owner_id'],
        filterGroups: [{ filters: [
          { propertyName: 'createdate', operator: 'GTE', value: yearStart },
          { propertyName: 'createdate', operator: 'LTE', value: yearEnd }
        ]}]
      });
      (d.results||[]).forEach(c => {
        const o = c.properties.hubspot_owner_id;
        if (o && funnels[o]) funnels[o].leads++;
      });
    }

    if (type === 'meetings') {
      // Meetings this quarter
      const d = await fetchPage('https://api.hubapi.com/crm/v3/objects/meetings/search', {
        limit: 100,
        properties: ['hubspot_owner_id'],
        filterGroups: [{ filters: [
          { propertyName: 'hs_timestamp', operator: 'GTE', value: new Date(qStart).getTime().toString() },
          { propertyName: 'hs_timestamp', operator: 'LTE', value: new Date(qEnd+'T23:59:59').getTime().toString() }
        ]}]
      });
      (d.results||[]).forEach(m => {
        const o = m.properties.hubspot_owner_id;
        if (o && funnels[o]) funnels[o].meetings++;
      });
    }

    if (type === 'deals') {
      // Close won this quarter
      const d = await fetchPage('https://api.hubapi.com/crm/v3/objects/deals/search', {
        limit: 100,
        properties: ['hubspot_owner_id','dealstage'],
        filterGroups: [{ filters: [
          { propertyName: 'closedate', operator: 'GTE', value: qStart },
          { propertyName: 'closedate', operator: 'LTE', value: qEnd }
        ]}]
      });
      (d.results||[]).forEach(d => {
        const o = d.properties.hubspot_owner_id;
        if (o && funnels[o] && d.properties.dealstage === 'closedwon') funnels[o].closeWon++;
      });

      // Retention
      const lqD = await fetchPage('https://api.hubapi.com/crm/v3/objects/deals/search', {
        limit: 100,
        properties: ['hubspot_owner_id'],
        filterGroups: [{ filters: [
          { propertyName: 'closedate', operator: 'GTE', value: lqStart },
          { propertyName: 'closedate', operator: 'LTE', value: lqEnd },
          { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }
        ]}]
      });
      const lqOwners = new Set((lqD.results||[]).map(x => x.properties.hubspot_owner_id).filter(Boolean));
      const thisQD = await fetchPage('https://api.hubapi.com/crm/v3/objects/deals/search', {
        limit: 100,
        properties: ['hubspot_owner_id'],
        filterGroups: [{ filters: [
          { propertyName: 'closedate', operator: 'GTE', value: qStart },
          { propertyName: 'closedate', operator: 'LTE', value: qEnd }
        ]}]
      });
      const thisQOwners = new Set((thisQD.results||[]).map(x => x.properties.hubspot_owner_id).filter(Boolean));
      Object.keys(funnels).forEach(o => {
        if (lqOwners.has(o) && thisQOwners.has(o)) funnels[o].retention = 1;
      });
    }

    const result = Object.values(funnels).filter(f =>
      f.leads > 0 || f.meetings > 0 || f.closeWon > 0 || f.reachOut > 0
    );

    res.status(200).json({ funnels: result, owners });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
