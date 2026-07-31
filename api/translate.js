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
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('<p style="color:white;text-align:center;">Unable to load Linguee data.</p>');
    }

    let html = await response.text();

    // Injected script to intercept ALL tap/click events in Safari safely via postMessage
    const safariScript = `
      <script>
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link) {
            const href = link.getAttribute('href');
            if (href && href.includes('query=')) {
              e.preventDefault();
              e.stopPropagation();
              
              // Extract query parameter from Linguee link
              const match = href.match(/query=([^&]+)/);
              if (match && match[1]) {
                const term = decodeURIComponent(match[1]);
                // Safely post message to parent container (Safari-compatible)
                window.parent.postMessage({ type: 'LINGUEE_SEARCH', query: term }, '*');
              }
            }
          }
        }, true);
      </script>
    `;

    // Inject Dark Mode Custom Styles directly into Linguee's HTML
    const darkStyles = `
      <style>
        body, html {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          padding: 10px !important;
          -webkit-tap-highlight-color: rgba(77, 166, 255, 0.3) !important;
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
          cursor: pointer !important;
        }
        a:hover, a:active {
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

    html = html.replace('</head>', `${darkStyles}${safariScript}</head>`);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('<p style="color:white;text-align:center;">Server error fetching Linguee content.</p>');
  }
}