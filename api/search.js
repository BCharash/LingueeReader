const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // Explicitly target the English-Portuguese dictionary endpoint
    const searchUrl = `https://www.linguee.com/english-portuguese/search?source=auto&query=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Parse exact matching dictionary entries
    $('.dictionary .exact .lemma').each((_, element) => {
      const word = $(element).find('.label').first().text().trim();
      const pos = $(element).find('.tag_wordtype').first().text().trim();
      
      const translations = [];
      $(element).find('.tag_trans .tag_t').each((_, transEl) => {
        translations.push($(transEl).text().trim());
      });

      if (word && translations.length > 0) {
        results.push({ word, pos, translations });
      }
    });

    // Parse contextual example sentences
    const examples = [];
    $('.example_lines .example').slice(0, 5).each((_, element) => {
      const source = $(element).find('.tag_s').text().trim();
      const target = $(element).find('.tag_t').text().trim();
      if (source && target) {
        examples.push({ source, target });
      }
    });

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ query, results, examples });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch translations' });
  }
};