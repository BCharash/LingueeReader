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

    // Universal link interceptor: captures query links AND .html translation paths
    const interceptorScript = `
      <script>
        window.onerror = function() { return true; };

        document.addEventListener('click', function(e) {
          var link = e.target.closest('a');
          if (link) {
            var href = link.getAttribute('href');
            if (href) {
              var term = '';

              // Pattern 1: URL with query parameter (?query=word)
              var queryMatch = href.match(/query=([^&]+)/);
              if (queryMatch && queryMatch[1]) {
                term = decodeURIComponent(queryMatch[1]);
              } 
              // Pattern 2: Translation page links (/translation/satisfeito.html)
              else if (href.includes('/translation/') || href.endsWith('.html')) {
                var pathParts = href.split('/');
                var filename = pathParts[pathParts.length - 1];
                term = filename.replace('.html', '').replace(/\\+/g, ' ');
              }
              // Pattern 3: General search paths (/english-portuguese/search?...)
              else if (href.includes('/search')) {
                var parts = href.split('query=');
                if (parts[1]) term = decodeURIComponent(parts[1]);
              }

              if (term) {
                e.preventDefault();
                e.stopPropagation();
                window.parent.postMessage({ type: 'LINGUEE_SEARCH', query: term }, '*');
              } else if (href.startsWith('http')) {
                e.preventDefault();
                window.open(href, '_blank');
              }
            }
          }
        }, true);
      </script>
    `;

    // Dark Mode Stylesheet + Larger Typography Rules
    const darkStyles = `
      <style>
        body, html {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          padding: 10px !important;
          font-size: 1.15rem !important; /* Increased global base font size */
          line-height: 1.6 !important;
          -webkit-tap-highlight-color: rgba(77, 166, 255, 0.3) !important;
        }

        /* Hide clutter: headers, footers, ads, and banners */
        #header, #footer, #banner_left, #banner_right, .dl_header, .linguee_header, #app_banner, .header_container, .ad_container {
          display: none !important;
        }

        /* Card Containers */
        #content_container, .exact, .inexact, .lemma, .dictionary {
          background-color: #1e1e1e !important;
          color: #e0e0e0 !important;
          border: 1px solid #333333 !important;
          border-radius: 8px !important;
          padding: 14px !important;
          margin-bottom: 15px !important;
        }

        /* Dictionary Term Headings */
        .lemma .tag_lemma a, .lemma h2, .exact .tag_lemma {
          font-size: 1.4rem !important;
          font-weight: 700 !important;
        }

        /* High-Contrast Links & Words */
        a, a * {
          color: #4da6ff !important;
          text-decoration: none !important;
          cursor: pointer !important;
          font-size: 1.15rem !important;
        }
        a:hover, a:active {
          text-decoration: underline !important;
        }

        /* Word Type Tags (e.g., noun, verb) */
        .tag_lemma, .tag_type, .wordtype {
          color: #a0a0a0 !important;
          font-style: italic !important;
          font-size: 1rem !important;
        }

        /* Sentence Example Pairs */
        .example, .sentence, tr.e_row, tr.d_row {
          background-color: #252525 !important;
          color: #d0d0d0 !important;
          font-size: 1.1rem !important;
        }
        .example .tag_s, .example .tag_t {
          color: #ffffff !important;
          font-size: 1.1rem !important;
        }

        td {
          border-color: #333333 !important;
          padding: 10px !important;
          font-size: 1.1rem !important;
        }
      </style>
      <base href="https://www.linguee.com/">
    `;

    html = html.replace('<head>', `<head>${interceptorScript}${darkStyles}`);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('<p style="color:white;text-align:center;">Server error fetching Linguee content.</p>');
  }
}