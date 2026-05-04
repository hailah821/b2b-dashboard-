const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.HUBSPOT_TOKEN;

app.use(express.json());
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");if(req.method==="OPTIONS")return res.status(200).end();next();});
app.use(express.static(path.join(__dirname, 'public')));

async function hs(url, body) {
  const opts = { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };
  if (body) { opts.method = 'POST'; opts.body = JSON.stringify(body); }
  const r = await fetch(url, opts);
  return r.json();
}

async function fetchAll(url, body) {
  let all = [], after;
  while (true) {
    const b = { ...body, ...(after ? { after } : {}) };
    const d = await hs(url, b);
    all = all.concat(d.results || []);
    if (d.paging && d.paging.next && d.paging.next.after) after = d.paging.next.after;
    else return { results: all, total: all.length };
  }
}

app.get('/api/owners', async (req, res) => {
  try {
    const d = await hs('https://api.hubapi.com/crm/v3/owners?limit=100');
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stages', async (req, res) => {
  try {
    const d = await hs('https://api.hubapi.com/crm/v3/pipelines/deals');
    const stageMap = {};
    (d.results||[]).forEach(p => (p.stages||[]).forEach(s => { stageMap[s.id] = s.label; }));
    res.json({ stageMap });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contacts', async (req, res) => {
  try {
    const d = await fetchAll('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      limit: 100,
      properties: ['firstname','lastname','email','phone','company','createdate','lifecyclestage'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
    });
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/companies', async (req, res) => {
  try {
    const d = await fetchAll('https://api.hubapi.com/crm/v3/objects/companies/search', {
      limit: 100,
      properties: ['name','domain','industry','numberofemployees','annualrevenue','city','country','createdate'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
    });
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/deals', async (req, res) => {
  try {
    const { start, end } = req.query;
    const filters = [];
    if (start) filters.push({ propertyName: 'closedate', operator: 'GTE', value: start });
    if (end)   filters.push({ propertyName: 'closedate', operator: 'LTE', value: end });
    const d = await fetchAll('https://api.hubapi.com/crm/v3/objects/deals/search', {
      limit: 100,
      properties: ['dealname','amount','dealstage','pipeline','closedate','createdate','hubspot_owner_id'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      ...(filters.length ? { filterGroups: [{ filters }] } : {})
    });
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/meetings', async (req, res) => {
  try {
    const { start, end } = req.query;
    const filters = [];
    if (start) filters.push({ propertyName: 'hs_timestamp', operator: 'GTE', value: start });
    if (end)   filters.push({ propertyName: 'hs_timestamp', operator: 'LTE', value: end });
    const d = await fetchAll('https://api.hubapi.com/crm/v3/objects/meetings/search', {
      limit: 100,
      properties: ['hubspot_owner_id','hs_timestamp','hs_meeting_title'],
      ...(filters.length ? { filterGroups: [{ filters }] } : {})
    });
    res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/funnel', async (req, res) => {
  try {
    const { start, end } = req.query;
    const now = new Date();
    const y = now.getFullYear();
    const q = Math.floor(now.getMonth() / 3);
    const yearStart = new Date(y, 0, 1).toISOString().split('T')[0];
    const yearEnd = new Date(y, 11, 31).toISOString().split('T')[0];
    const lqStart = new Date(y, (q-1)*3, 1).toISOString().split('T')[0];
    const lqEnd = new Date(y, q*3, 0).toISOString().split('T')[0];

    const ownersData = await hs('https://api.hubapi.com/crm/v3/owners?limit=100');
    const owners = {};
    (ownersData.results||[]).forEach(o => {
      owners[o.id] = ((o.firstName||'') + ' ' + (o.lastName||'')).trim() || 'Rep'+o.id.slice(-4);
    });

    const funnels = {};
    Object.entries(owners).forEach(([id, name]) => {
      funnels[id] = { name, leads: 0, reachOut: 0, meetings: 0, closeWon: 0, retention: 0 };
    });

    const [leadsD, meetD, dealQD, dealLQD] = await Promise.all([
      fetchAll('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        limit: 100, properties: ['hubspot_owner_id'],
        filterGroups: [{ filters: [
          { propertyName: 'createdate', operator: 'GTE', value: yearStart },
          { propertyName: 'createdate', operator: 'LTE', value: yearEnd }
        ]}]
      }),
      fetchAll('https://api.hubapi.com/crm/v3/objects/meetings/search', {
        limit: 100, properties: ['hubspot_owner_id'],
        filterGroups: start && end ? [{ filters: [
          { propertyName: 'hs_timestamp', operator: 'GTE', value: start },
          { propertyName: 'hs_timestamp', operator: 'LTE', value: end }
        ]}] : []
      }),
      fetchAll('https://api.hubapi.com/crm/v3/objects/deals/search', {
        limit: 100, properties: ['hubspot_owner_id','dealstage'],
        filterGroups: start && end ? [{ filters: [
          { propertyName: 'closedate', operator: 'GTE', value: start },
          { propertyName: 'closedate', operator: 'LTE', value: end }
        ]}] : []
      }),
      fetchAll('https://api.hubapi.com/crm/v3/objects/deals/search', {
        limit: 100, properties: ['hubspot_owner_id'],
        filterGroups: [{ filters: [
          { propertyName: 'closedate', operator: 'GTE', value: lqStart },
          { propertyName: 'closedate', operator: 'LTE', value: lqEnd },
          { propertyName: 'dealstage', operator: 'EQ', value: 'closedwon' }
        ]}]
      })
    ]);

    (leadsD.results||[]).forEach(c => {
      const o = c.properties.hubspot_owner_id;
      if (o && funnels[o]) funnels[o].leads++;
    });
    (meetD.results||[]).forEach(m => {
      const o = m.properties.hubspot_owner_id;
      if (o && funnels[o]) funnels[o].meetings++;
    });
    (dealQD.results||[]).forEach(d => {
      const o = d.properties.hubspot_owner_id;
      if (o && funnels[o] && d.properties.dealstage === 'closedwon') funnels[o].closeWon++;
    });

    const lqOwners = new Set((dealLQD.results||[]).map(x => x.properties.hubspot_owner_id).filter(Boolean));
    const thisQOwners = new Set((dealQD.results||[]).map(x => x.properties.hubspot_owner_id).filter(Boolean));
    Object.keys(funnels).forEach(o => {
      if (lqOwners.has(o) && thisQOwners.has(o)) funnels[o].retention = 1;
    });

    const result = Object.values(funnels).filter(f => f.leads > 0 || f.meetings > 0 || f.closeWon > 0);
    res.json({ funnels: result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
