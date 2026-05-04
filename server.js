const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.HUBSPOT_TOKEN;

app.use(express.json());
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
    if (d.paging?.next?.after) after = d.paging.next.after;
    else return { results: all, total: all.length };
  }
}

app.get('/api/owners', async (req, res) => {
  const d = await hs('https://api.hubapi.com/crm/v3/owners?limit=100');
  res.json(d);
});

app.get('/api/stages', async (req, res) => {
  const d = await hs('https://api.hubapi.com/crm/v3/pipelines/deals');
  const stageMap = {};
  (d.results||[]).forEach(p => (p.stages||[]).forEach(s => stageMap[s.id] = s.label));
  res.json({ stageMap });
});

app.get('/api/contacts', async (req, res) => {
  const d = await fetchAll('https://api.hubapi.com/crm/v3/objects/contacts/search', { limit:100, properties:['firstname','lastname','email','phone','company'
cd ~/Downloads/b2b-vercel
cat > package.json << 'EOF'
{
  "name": "b2b-dashboard",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
