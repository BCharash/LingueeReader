export default async function handler(req, res) {
  const { q, source = 'en', target = 'pt' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const langPair = `${source === 'auto' ? 'en' : source}|${target}`;
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${langPair}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream translation error' });
    }

    const data = await response.json();
    
    // Extract translated text safely
    const translation = data.responseData?.translatedText || 'No translation found';

    return res.status(200).json({ translation, raw: data });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch translation data' });
  }
}