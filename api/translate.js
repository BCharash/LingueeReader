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

    // Linguee can return UTF-8 or a legacy Western encoding. Check the actual
    // bytes before trusting a possibly stale HTTP/HTML charset declaration.
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    const headerCharset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1];
    const prefix = new TextDecoder('windows-1252').decode(bytes.subarray(0, 8192));
    const metaCharset = /<meta\s+[^>]*charset\s*=\s*["']?([^\s"'/>;]+)/i.exec(prefix)?.[1]
      || /<meta\s+[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^;\s"']+)/i.exec(prefix)?.[1];
    let html;
    try {
      // UTF-8 is preferred only if *all* bytes form valid UTF-8.
      html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      const legacyCharset = headerCharset && !/^utf-?8$/i.test(headerCharset)
        ? headerCharset
        : metaCharset && !/^utf-?8$/i.test(metaCharset)
          ? metaCharset
          : 'windows-1252';
      try { html = new TextDecoder(legacyCharset, { fatal: true }).decode(bytes); }
      catch { html = new TextDecoder('windows-1252').decode(bytes); }
    }

    // A replacement character already in the decoded source cannot be repaired
    // by changing the browser's charset. Log its presence for diagnosis.
    if (html.includes('\uFFFD')) {
      console.warn('Linguee response contains Unicode replacement characters after decoding', {
        query: q, headerCharset, metaCharset
      });
    }

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

        // Capture navigation before Linguee's own click handlers can open a
        // new page, change the iframe, or create a nested document window.
        function routeDictionaryClick(e) {
          var target = e.target;
          if (!target || !target.closest) return;
          var link = target.closest('a');
          if (!link) return;
          var href = (link.getAttribute('href') || '').trim();
          if (!href || href.charAt(0) === '#') return;

          var dictionaryLink = link.hasAttribute('data-reader-term') || link.matches('.dictLink, .tag_lemma a, .tag_trans a') ||
            !!link.closest('.dictionary, .lemma, .translation, .tag_lemma, .tag_trans, .exact, .inexact');
          var url = null;
          try { url = new URL(href, document.baseURI); } catch (error) {}
          var lingueeLink = url && /(^|\.)linguee\.(com|pt|de|fr|es|it|nl|pl|ru|br)$/i.test(url.hostname);
          var searchLink = url && /\/(search|translation)\b/i.test(url.pathname);

          // Only take over dictionary navigation. Leave unrelated external
          // links (e.g. source citations) to their normal behavior.
          if (!dictionaryLink && !(lingueeLink && searchLink)) return;

          // Never allow a dictionary link to navigate its own frame or popup.
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();

          var visible = (link.textContent || '').replace(/\s+/g, ' ').trim();
          var term = '';
          if (link.hasAttribute('data-reader-term')) {
            try { term = decodeURIComponent(link.getAttribute('data-reader-term')); } catch (error) {}
          }
          if (!term && url) {
            try {
              term = url.searchParams.get('query') || url.searchParams.get('q') || '';
              if (!term && /\.html$/i.test(url.pathname)) {
                term = decodeURIComponent(url.pathname.split('/').pop().replace(/\.html$/i, ''))
                  .replace(/\+/g, ' ');
              }
            } catch (error) { term = ''; }
          }
          // For dictionary words, visible text is often more reliable than
          // Linguee's legacy-encoded URLs, especially for accented terms.
          if (!link.hasAttribute('data-reader-term') && dictionaryLink && visible && !/[\uFFFD]/.test(visible)) term = visible;
          if (!term || /[\uFFFD]/.test(term)) return;
          window.parent.postMessage({ type: 'LINGUEE_SEARCH', query: term }, '*');
        }
        window.addEventListener('click', routeDictionaryClick, true);
        window.addEventListener('auxclick', routeDictionaryClick, true);
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

    // Linguee's own scripts can navigate before/around our click interceptor.
    // Dictionary pages are server-rendered, so remove upstream scripts and
    // convert their dictionary links into local reader URLs before delivery.
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');

    function decodeEntities(value) {
      return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi, (match, entity) => {
        const named = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>' };
        const lower = entity.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(named, lower)) return named[lower];
        const cp = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
        try { return String.fromCodePoint(cp); } catch { return match; }
      });
    }

    html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (whole, attrs, inner) => {
      const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      if (!match) return whole;
      const href = decodeEntities(match[1] ?? match[2] ?? match[3]);
      if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return whole;
      let url;
      try { url = new URL(href, 'https://www.linguee.com/'); } catch { return whole; }
      if (!/(^|\.)linguee\.(com|pt|de|fr|es|it|nl|pl|ru|br)$/i.test(url.hostname)) return whole;
      const dictionaryContext = /\b(?:dictLink|tag_lemma|tag_trans)\b/i.test(attrs);
      const searchUrl = /\/(?:search|translation)\b/i.test(url.pathname) || /\.html$/i.test(url.pathname);
      if (!dictionaryContext && !searchUrl) return whole;

      const visible = decodeEntities(inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
      let term = url.searchParams.get('query') || url.searchParams.get('q') || '';
      if (!term && /\.html$/i.test(url.pathname)) {
        try { term = decodeURIComponent(url.pathname.split('/').pop().replace(/\.html$/i, '')).replace(/\+/g, ' '); }
        catch { term = ''; }
      }
      if (dictionaryContext && visible && !visible.includes('\uFFFD')) term = visible;
      if (!term || term.includes('\uFFFD')) return whole;
      const localHref = `/api/translate?q=${encodeURIComponent(term)}&font=${initialFont}`;
      const safeAttrs = attrs.replace(/\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
        .replace(/\btarget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\bonclick\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      return `<a${safeAttrs} href="${localHref}" target="_self" data-reader-term="${encodeURIComponent(term)}">${inner}</a>`;
    });

    // Remove any upstream charset declarations before supplying our own UTF-8
    // declaration. The response is sent as a UTF-8 JavaScript string.
    html = html.replace(/<meta\b[^>]*charset\s*=\s*[^>]*>/gi, '');
    html = html.replace(/<head\b([^>]*)>/i,
      (_, attrs) => `<head${attrs}><meta charset="UTF-8">${interceptorScript}${darkStyles}`);

    // Set response header explicitly to UTF-8
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('<p style="color:white;text-align:center;">Server error fetching Linguee content.</p>');
  }
}