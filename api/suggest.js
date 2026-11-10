// Uses the autocomplete HTML fragment returned by Linguee.pt's qe endpoint.
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length > 60) return res.status(200).json({ suggestions: [] });

  try {
    const response = await axios.get('https://www.linguee.pt/portugues-ingles/search', {
      params: { qe: q, source: 'auto', cw: 516, ch: 694, as: 'shownOnStart' },
      timeout: 7000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.linguee.pt/portugues-ingles/'
      }
    });
    const contentType = response.headers['content-type'] || '';
    const charset = /charset=([^;\s]+)/i.exec(contentType)?.[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(charset).decode(response.data); }
    catch { html = new TextDecoder('utf-8').decode(response.data); }
    const $ = cheerio.load(html);
    const suggestions = [];
    const seen = new Set();

    $('.autocompletion_item').each((_, element) => {
      const main = $(element).find('.main_row .main_item').first();
      const word = main.text().replace(/\s+/g, ' ').trim();
      const lang = (main.attr('lc') || '').toUpperCase();
      if (!word || !['EN', 'PT'].includes(lang)) return;
      const key = `${lang}:${word.toLocaleLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const pos = $(element).find('.main_row .main_wordtype').first().text().trim();
      const translations = [];
      $(element).find('.translation_row .translation_item').each((_, translation) => {
        // Exclude the grammatical annotation and separator from the translated word.
        const copy = $(translation).clone();
        copy.find('.wordtype, .sep').remove();
        const term = copy.text().replace(/\s+/g, ' ').trim();
        if (term && !translations.includes(term)) translations.push(term);
      });
      suggestions.push({ word, lang, pos, translations: translations.slice(0, 4) });
    });
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(200).json({ suggestions: suggestions.slice(0, 20) });
  } catch (error) {
    console.error('Linguee autocomplete request failed:', error.message);
    return res.status(502).json({ error: 'Autocomplete temporarily unavailable', suggestions: [] });
  }
};
