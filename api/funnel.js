export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  const { start, end } = req.query;

  try {
    // Get owners
    const ownersRes = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const ownersData = await ownersRes.json();
    const owners = {};
    (ownersData.results || []).forEach(o => {
      owners[o.id] = ((o.firstName||'') + ' ' + (o.lastName||'')).trim() || 'Rep'+o.id.slice(-4);
    });

    const filters = [];
    if (start) filters.push({ propertyName: 'closedate', operator: 'GTE', value: start });
    if (end)   filters.push({ propertyName: 'closedate', operator: 'LTE', value: end });

    // Get ALL deals with pagination
    let allDeals = [];
    let after = undefined;
    while (true) {
      const body = {
        limit: 100,
        properties: ['dealname','amount','dealstage','hubspot_owner_id','createdate','closedate','num_notes'],
        ...(filters.length ? { filterGroups: [{ filters }] } : {}),
        ...(after ? { after } : {})
      };
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      allDeals = allDeals.concat(data.results || []);
      if (data.paging?.next?.after) after = data.paging.next.after;
      else break;
    }

    // Get meetings
    const meetFilters = [];
    if (start) meetFilters.push({ propertyName: 'hs_timestamp', operator: 'GTE', value: new Date(start).getTime().toString() });
    if (end)   meetFilters.push({ propertyName: 'hs_timestamp', operator: 'LTE', value: new Date(end + 'T23:59:59').getTime().toString() });

    let allMeetings = [];
    let mAfter = undefined;
    while (true) {
      const body = {
        limit: 100,
        properties: ['hubspot_owner_id','hs_timestamp','hs_meeting_outcome'],
        ...(meetFilters.length ? { filterGroups: [{ filters: meetFilters }] } : {}),
        ...(mAfter ? { after: mAfter } : {})
      };
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/meetings/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      allMeetings = allMeetings.concat(data.results || []);
      if (data.paging?.next?.after) mAfter = data.paging.next.after;
      else break;
    }

    // Get contacts (leads) per owner
    let allContacts = [];
    let cAfter = undefined;
    while (true) {
      const body = {
        limit: 100,
        properties: ['hubspot_owner_id','createdate'],
        ...(cAfter ? { after: cAfter } : {})
      };
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      allContacts = allContacts.concat(data.results || []);
      if (data.paging?.next?.after && allContacts.length < 500) cAfter = data.paging.next.after;
      else break;
    }

    // Get notes/activities per owner
    let allNotes = [];
    let nAfter = undefined;
    while (true) {
      const body = {
        limit: 100,
        properties: ['hubspot_owner_id','hs_timestamp'],
        ...(nAfter ? { after: nAfter } : {})
      };
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/notes/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      allNotes = allNotes.concat(data.results || []);
      if (data.paging?.next?.after && allNotes.length < 500) nAfter = data.paging.next.after;
      else break;
    }

    // Build funnel per owner
    const funnels = {};
    Object.entries(owners).forEach(([id, name]) => {
      funnels[id] = { name, leads: 0, reachOut: 0, meetings: 0, closeWon: 0, retention: 0 };
    });

    allContacts.forEach(c => {
      const o = c.properties.hubspot_owner_id;
      if (o && funnels[o]) funnels[o].leads++;
    });

    allNotes.forEach(n => {
      const o = n.properties.hubspot_owner_id;
      if (o && funnels[o]) funnels[o].reachOut++;
    });

    allMeetings.forEach(m => {
      const o = m.properties.hubspot_owner_id;
      if (o && funnels[o]) funnels[o].meetings++;
    });

    allDeals.forEach(d => {
      const o = d.properties.hubspot_owner_id;
      if (!o || !funnels[o]) return;
      if (d.properties.dealstage === 'closedwon') funnels[o].closeWon++;
    });

    res.status(200).json({ funnels: Object.values(funnels).filter(f => f.leads > 0 || f.meetings > 0 || f.closeWon > 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
