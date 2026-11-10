export default async function handler(req, res) {
  const { q, font } = req.query;

  if (!q) {
    return res.status(400).send('<p style="color:white;text-align:center;">Please enter a search term.</p>');
  }

  const requestedFont = Number(font);
  const initialFont = Number.isFinite(requestedFont) && requestedFont >= 14 && requestedFont <= 40 ? Math.round(requestedFont) : 22;
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

    // 1. Grab raw binary buffer from Linguee
    const buffer = await response.arrayBuffer();

    // 2. Decode using ISO-8859-1 (Latin-1) so Portuguese accents (ã, ç, é) map correctly
    const decoder = new TextDecoder('iso-8859-1');
    let html = decoder.decode(buffer);

    // Universal link interceptor & font change message handler
    const interceptorScript = `
      <script>
        window.onerror = function() { return true; };

        // Dynamic Font Scaler Listener
        window.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'SET_FONT_SIZE') {
            var px = Number(event.data.pixels);
            if (Number.isFinite(px) && px >= 14 && px <= 40) {
              document.documentElement.style.setProperty('--reader-font-size', px + 'px');
              document.documentElement.style.fontSize = px + 'px';
            }
          }
        });

        // Universal link interceptor
        document.addEventListener('click', function(e) {
          var link = e.target.closest('a');
          if (link) {
            var href = link.getAttribute('href');
            if (href) {
              var term = '';

              var queryMatch = href.match(/query=([^&]+)/);
              if (queryMatch && queryMatch[1]) {
                term = decodeURIComponent(queryMatch[1]);
              } else if (href.includes('/translation/') || href.endsWith('.html')) {
                var pathParts = href.split('/');
                var filename = pathParts[pathParts.length - 1];
                term = filename.replace('.html', '').replace(/\\+/g, ' ');
              } else if (href.includes('/search')) {
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

    // Dark Mode Stylesheet with Target Classes Forced to Dynamic REM Units
    const darkStyles = `
      <style>
        html {
          font-size: ${initialFont}px !important;
          --reader-font-size: ${initialFont}px;
        }

        body {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          padding: 10px !important;
          font-size: var(--reader-font-size) !important;
          font-weight: 400 !important;
          line-height: 1.55 !important;
          overflow-wrap: anywhere !important;
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
          padding: 0.65em !important;
          margin-bottom: 0.8em !important;
          height: auto !important;
          min-height: 0 !important;
          box-sizing: border-box !important;
        }

        /* Lookup Headings (e.g., "happy") */
        .lemma .tag_lemma a, .lemma h2, .exact .tag_lemma, .headline_translation {
          font-size: calc(var(--reader-font-size) * 1.12) !important;
          font-weight: 500 !important;
        }

        /* TARGETED FIX: Translated Target Words (e.g., "feliz", "satisfeito") */
        .translation, 
        .translation_lines, 
        .translation .dictLink, 
        .translation_desc .dictLink,
        a.dictLink,
        .dictLink {
          font-size: var(--reader-font-size) !important;
          font-weight: 400 !important;
          line-height: 1.55 !important;
        }

        /* Linguee supplies explicit pixel sizes on nested text elements.
           Set the chosen size on the actual dictionary text, not just html/body.
           Absolute px values avoid compounding through nested em rules. */
        body :is(div, span, a, p, td, th, li, strong, b, em, small, label,
                 h1, h2, h3, h4, blockquote, dt, dd) {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          font-size: var(--reader-font-size) !important;
          font-weight: 400 !important;
          line-height: 1.55 !important;
          overflow-wrap: anywhere !important;
          height: auto !important;
          min-height: 0 !important;
        }
        /* Restore a modest hierarchy after the broad Linguee override. */
        body :is(h1, h2, h3, .lemma .tag_lemma a, .headline_translation) {
          font-size: calc(var(--reader-font-size) * 1.12) !important;
          font-weight: 500 !important;
        }
        body :is(.tag_wordtype, .tag_type, .wordtype, .tag_lemma .tag_wordtype) {
          font-size: calc(var(--reader-font-size) * 0.85) !important;
          font-weight: 400 !important;
        }
        body :is(table, tbody, thead, tr) {
          height: auto !important;
          max-height: none !important;
        }

        /* High-Contrast Links & Words */
        a, a * {
          color: #4da6ff !important;
          text-decoration: none !important;
          cursor: pointer !important;
        }
        a:hover, a:active {
          text-decoration: underline !important;
        }

        /* Word Type & Grammar Tags (e.g., adj, noun, verb) */
        .tag_lemma, .tag_type, .wordtype, .tag_trans {
          color: #a0a0a0 !important;
          font-style: italic !important;
          font-size: calc(var(--reader-font-size) * 0.85) !important;
          font-weight: normal !important;
        }

        /* Usage Examples & Context Blocks */
        .example, .sentence, tr.e_row, tr.d_row {
          background-color: #252525 !important;
          color: #d0d0d0 !important;
          font-size: var(--reader-font-size) !important;
        }
        .example .tag_s, .example .tag_t {
          color: #ffffff !important;
          font-size: var(--reader-font-size) !important;
        }

        /* Let enlarged dictionary content wrap instead of colliding with fixed boxes. */
        #content_container, #content_container * {
          box-sizing: border-box !important;
          max-width: 100% !important;
        }
        #content_container .lemma, #content_container .translation,
        #content_container .translation_lines, #content_container .example,
        #content_container .sentence, #content_container .dictLink,
        #content_container .tag_lemma, #content_container .tag_trans {
          height: auto !important;
          min-height: 0 !important;
          line-height: 1.55 !important;
          overflow-wrap: anywhere !important;
          white-space: normal !important;
        }
        #content_container table { width: 100% !important; table-layout: auto !important; }
        #content_container td { height: auto !important; vertical-align: top !important; overflow-wrap: anywhere !important; }

        td {
          border-color: #333333 !important;
          padding: 0.45em !important;
          font-size: var(--reader-font-size) !important;
        }
      </style>
      <base href="https://www.linguee.com/">
    `;

    // Inject meta charset UTF-8 alongside scripts and styles
    html = html.replace('<head>', `<head><meta charset="UTF-8">${interceptorScript}${darkStyles}`);

    // Set response header explicitly to UTF-8
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('<p style="color:white;text-align:center;">Server error fetching Linguee content.</p>');
  }
}