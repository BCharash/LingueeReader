export default async function handler(req, res) {
  const { q, source = 'auto', target = 'pt' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const apiUrl = `https://linguee-api.herokuapp.com/api?q=${encodeURIComponent(q)}&source=${source}&target=${target}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream API error' });
    }

    const data = await response.json();

    // Set CORS headers so your frontend can read it seamlessly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch translation data' });
  }
}