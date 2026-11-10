// Suggestions are extracted from Linguee's live dictionary results.
// Linguee has no verified public autocomplete API; empty results are normal
// for prefixes that its search page does not return as dictionary entries.
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2 || q.length > 60) return res.status(200).json({ suggestions: [] });
  try {
    const url = `https://www.linguee.com/english-portuguese/search?source=auto&query=${encodeURIComponent(q)}`;
    const response = await axios.get(url, {
      timeout: 6500,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    const $ = cheerio.load(response.data);
    const suggestions = [];
    const seen = new Set();
    const prefix = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    // Only offer actual Linguee headwords, never invented completions.
    $('.dictionary .lemma .tag_lemma a, .dictionary .lemma .label, .dictionary .lemma .dictLink').each((_, el) => {
      const word = $(el).text().replace(/\s+/g, ' ').trim();
      const normalized = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
      if (!word || word.length > 65 || !normalized.startsWith(prefix) || seen.has(normalized)) return;
      seen.add(normalized);
      suggestions.push({ word, lang: 'EN / PT' });
    });
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    return res.status(200).json({ suggestions: suggestions.slice(0, 6) });
  } catch (error) {
    return res.status(200).json({ suggestions: [] });
  }
};
