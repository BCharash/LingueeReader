export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const query = encodeURIComponent(q.trim());
  const enToPtUrl = `https://api.mymemory.translated.net/get?q=${query}&langpair=en|pt`;
  const ptToEnUrl = `https://api.mymemory.translated.net/get?q=${query}&langpair=pt|en`;

  try {
    // Fetch both translation directions simultaneously
    const [enToPtRes, ptToEnRes] = await Promise.all([
      fetch(enToPtUrl),
      fetch(ptToEnUrl)
    ]);

    const enToPtData = enToPtRes.ok ? await enToPtRes.json() : null;
    const ptToEnData = ptToEnRes.ok ? await ptToEnRes.json() : null;

    return res.status(200).json({
      query: q,
      enToPt: enToPtData?.responseData?.translatedText || 'No translation found',
      ptToEn: ptToEnData?.responseData?.translatedText || 'No translation found'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch translation data' });
  }
}