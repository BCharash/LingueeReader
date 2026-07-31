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

    // Script that intercepts EVERY click and forces it back through our dark proxy
    const proxyInterceptorScript = `
      <script>
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link) {
            const href = link.getAttribute('href');
            if (href) {
              e.preventDefault();
              e.stopPropagation();
              
              let term = '';
              // Check if href contains a query parameter
              const match = href.match(/query=([^&]+)/);
              if (match && match[1]) {
                term = decodeURIComponent(match[1]);
              } else if (href.includes('/english-portuguese/search')) {
                // Handle path-based search links
                const parts = href.split('query=');
                if (parts[1]) term = decodeURIComponent(parts[1]);
              }

              if (term) {
                // Post message to parent to load the term via /api/translate
                window.parent.postMessage({ type: 'LINGUEE_SEARCH', query: term }, '*');
              } else if (href.startsWith('http')) {
                // For external links, open in a new browser tab
                window.open(href, '_blank');
              }
            }
          }
        }, true);
      </script>
    `;

    // Inject Dark Mode Custom Styles
    const darkStyles = `
      <style>
        body, html {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          padding: 10px !important;
          -webkit-tap-highlight-color: rgba(77, 166, 255, 0.3) !important;
        }
        /* Hide unnecessary headers, sidebars, footers, and banners */
        #header, #footer, #banner_left, #banner_right, .dl_header, .linguee_header, #app_banner, .header_container {
          display: none !important;
        }
        /* Main Content Boxes */
        #content_container, .exact, .inexact, .lemma, .dictionary {
          background-color: #1e1e1e !important;
          color: #e0e0e0 !important;
          border: 1px solid #333333 !important;
          border-radius: 8px !important;
          padding: 12px !important;
          margin-bottom: 15px !important;
        }
        /* Text Highlighting & Hyperlinks */
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
        /* Context Example Rows */
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

    html = html.replace('</head>', `${darkStyles}${proxyInterceptorScript}</head>`);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('<p style="color:white;text-align:center;">Server error fetching Linguee content.</p>');
  }
}