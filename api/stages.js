export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  try {
    // Get all pipelines and their stages
    const r = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    // Build a flat map of stageId -> label
    const stageMap = {};
    (data.results || []).forEach(pipeline => {
      (pipeline.stages || []).forEach(stage => {
        stageMap[stage.id] = stage.label;
      });
    });

    res.status(200).json({ stageMap, pipelines: data.results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
