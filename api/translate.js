export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).send('<p style="color:white;text-align:center;">Please enter a search term.</p>');
  }

  const query = encodeURIComponent(q.trim());
  const lingueeUrl = `https://www.linguee.com/english-portuguese/search?source=auto&query=${query}`;

  try {
    const response = await fetch(lingueeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('<p style="color:white;text-align:center;">Unable to load Linguee data.</p>');
    }

    let html = await response.text();

    // Rewrite internal Linguee search links so clicking words re-runs searches inside your app
    html = html.replace(/href="\/english-portuguese\/search\?source=auto&amp;query=([^"]+)"/g, 'href="#" onclick="window.parent.searchFromLink(\'$1\'); return false;"');
    html = html.replace(/href="\/english-portuguese\/search\?source=spanish&amp;query=([^"]+)"/g, 'href="#" onclick="window.parent.searchFromLink(\'$1\'); return false;"');

    // Inject Dark Mode Custom Styles directly into Linguee's HTML
    const darkStyles = `
      <style>
        body, html {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          padding: 10px !important;
        }
        /* Hide unnecessary headers, sidebars, and ads */
        #header, #footer, #banner_left, #banner_right, .dl_header, .linguee_header, #app_banner {
          display: none !important;
        }
        /* Main Container Styling */
        #content_container, .exact, .inexact, .lemma {
          background-color: #1e1e1e !important;
          color: #e0e0e0 !important;
          border: 1px solid #333333 !important;
          border-radius: 8px !important;
          padding: 12px !important;
          margin-bottom: 15px !important;
        }
        /* Text Highlighting & Links */
        a, a * {
          color: #4da6ff !important;
          text-decoration: none !important;
        }
        a:hover {
          text-decoration: underline !important;
        }
        .tag_lemma, .tag_type, .wordtype {
          color: #a0a0a0 !important;
          font-style: italic !important;
        }
        /* Context Example Blocks */
        .example, .sentence, tr.e_row, tr.d_row {
          background-color: #252525 !important;
          color: #d0d0d0 !important;
        }
        .example .tag_s, .example .tag_t {
          color: #ffffff !important;
        }
        td {
          border-color: #333333 !important;
          padding: 8px !important;
        }
      </style>
      <base href="https://www.linguee.com/">
    `;

    html = html.replace('</head>', `${darkStyles}</head>`);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('<p style="color:white;text-align:center;">Server error fetching Linguee content.</p>');
  }
}