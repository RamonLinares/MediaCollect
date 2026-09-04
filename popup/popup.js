/**
 * Popup Script for Videos & Screenshot Suite
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const inactiveView = document.getElementById('inactive-view');
  const activeView = document.getElementById('active-view');
  const btnOpenX = document.getElementById('btn-open-x');
  const btnOpenThreads = document.getElementById('btn-open-threads');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');
  const btnEmptyRescan = document.getElementById('btn-empty-rescan');
  const videoList = document.getElementById('video-list');
  const emptyState = document.getElementById('empty-state');
  const videoCountBadge = document.getElementById('video-count-badge');
  const filterChips = document.querySelectorAll('.filter-chip');

  // Search input elements
  const searchInput = document.getElementById('video-search-input');
  const btnSearchClear = document.getElementById('btn-search-clear');
  const searchEmptyState = document.getElementById('search-empty-state');
  const searchEmptyText = document.getElementById('search-empty-text');
  const btnSearchReset = document.getElementById('btn-search-reset');

  // Mode Tabs
  const modeTabs = document.querySelectorAll('.mode-tab');
  const tabVideos = document.getElementById('tab-videos');
  const tabScreenshot = document.getElementById('tab-screenshot');

  // Screenshot Buttons
  const btnSnapSelection = document.getElementById('btn-snap-selection');
  const btnSnapElement = document.getElementById('btn-snap-element');
  const btnSnapVisible = document.getElementById('btn-snap-visible');
  const btnSnapFull = document.getElementById('btn-snap-full');

  let currentVideos = [];
  let activeFilter = 'all';
  let searchQuery = '';

  // SVG Icons
  const SVG_DOWNLOAD_SM = `
    <svg viewBox="0 0 24 24" class="btn-icon">
      <path d="M12 2.5a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3.25A.75.75 0 0 1 12 2.5zm-8.25 14a.75.75 0 0 1 .75.75v3.25c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-3.25a.75.75 0 0 1 1.5 0v3.25A2.25 2.25 0 0 1 18.75 22H5.25A2.25 2.25 0 0 1 3 19.75v-3.25a.75.75 0 0 1 .75-.75z"/>
    </svg>
  `;

  const SVG_CHECK_SM = `
    <svg viewBox="0 0 24 24" class="btn-icon">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  `;

  const SVG_PLAY = `
    <svg viewBox="0 0 24 24" class="play-icon">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `;

  const SVG_PLAY_SM = `
    <svg viewBox="0 0 24 24" class="btn-icon">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `;

  const SVG_CLOSE_SM = `
    <svg viewBox="0 0 24 24" class="btn-icon">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;

  const SVG_SPINNER = `
    <svg viewBox="0 0 24 24" class="btn-icon spin">
      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
    </svg>
  `;

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const tabUrl = tab?.url || '';
  const isXDomain = tabUrl.includes('x.com') || tabUrl.includes('twitter.com');
  const isThreadsDomain = tabUrl.includes('threads.net') || tabUrl.includes('threads.com');
  const isVideoPlatform = isXDomain || isThreadsDomain;

  function switchTab(targetTab) {
    modeTabs.forEach(b => {
      if (b.dataset.tab === targetTab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (targetTab === 'videos') {
      tabVideos.style.display = 'block';
      tabScreenshot.style.display = 'none';
      if (isVideoPlatform) {
        statusBadge.className = 'status-badge status-active';
        statusText.textContent = isThreadsDomain ? 'Active on Threads' : 'Active on X.com';
      } else {
        statusBadge.className = 'status-badge status-inactive';
        statusText.textContent = 'Videos Inactive';
      }
    } else {
      tabVideos.style.display = 'none';
      tabScreenshot.style.display = 'block';
      statusBadge.className = 'status-badge status-active';
      statusText.textContent = 'Ready to Capture';
    }
  }

  // Setup tab switching
  modeTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // If not on X or Threads, default to Screenshot tab automatically to avoid an extra click!
  if (!isVideoPlatform) {
    switchTab('screenshot');
    inactiveView.style.display = 'block';
    activeView.style.display = 'none';

    if (btnOpenX) {
      btnOpenX.addEventListener('click', async () => {
        await chrome.tabs.create({ url: 'https://x.com' });
        window.close();
      });
    }
    if (btnOpenThreads) {
      btnOpenThreads.addEventListener('click', async () => {
        await chrome.tabs.create({ url: 'https://www.threads.net' });
        window.close();
      });
    }
  } else {
    // Active on X or Threads -> default to Videos tab
    switchTab('videos');
    inactiveView.style.display = 'none';
    activeView.style.display = 'block';
  }

  /**
   * Ensure Screenshot content scripts are injected on active tab
   */
  async function ensureScreenshotInjected(tabId) {
    if (!tabId) return;
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['screenshot/screenshot.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['screenshot/screenshot-content.js']
      });
    } catch (err) {
      console.error('[MediaCollect] Script injection error:', err);
    }
  }

  // --- SCREENSHOT BUTTON HANDLERS ---
  if (btnSnapSelection) {
    btnSnapSelection.addEventListener('click', async () => {
      if (!tab?.id) return;
      await ensureScreenshotInjected(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: 'START_AREA_SELECTION' });
      window.close();
    });
  }

  if (btnSnapElement) {
    btnSnapElement.addEventListener('click', async () => {
      if (!tab?.id) return;
      await ensureScreenshotInjected(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });
      window.close();
    });
  }

  if (btnSnapVisible) {
    btnSnapVisible.addEventListener('click', async () => {
      if (!tab?.id) return;
      await ensureScreenshotInjected(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_VISIBLE_VIEWPORT' });
      window.close();
    });
  }

  if (btnSnapFull) {
    btnSnapFull.addEventListener('click', async () => {
      if (!tab?.id) return;
      await ensureScreenshotInjected(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FULL_PAGE' });
      window.close();
    });
  }

  // --- VIDEO DOWNLOADER LOGIC ---

  /**
   * Triggers download of a video variant
   */
  async function downloadVariant(variant, record, btn) {
    if (!variant?.url) return;

    const label = TwitVidUtils.formatVariantLabel(variant);
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '0.85';
    btn.innerHTML = `${SVG_SPINNER}<span>Downloading...</span>`;

    try {
      await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO',
        payload: {
          url: variant.url,
          author: record.authorHandle || record.authorName || 'user',
          tweetId: record.tweetId || '',
          platform: record.platform || (isThreadsDomain ? 'Threads' : 'X'),
          label
        }
      });

      btn.classList.add('is-success');
      btn.innerHTML = `${SVG_CHECK_SM}<span>Saved!</span>`;
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('is-success');
        btn.style.opacity = '1';
        btn.innerHTML = originalContent;
      }, 2500);
    } catch (err) {
      console.error('[MediaCollect] Download error:', err);
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = originalContent;
    }
  }

  /**
   * Toggles inline video preview player in a card
   */
  function toggleVideoPreview(card, videoUrl) {
    document.querySelectorAll('.video-preview-wrap').forEach(el => {
      const vid = el.querySelector('video');
      if (vid) vid.pause();
      if (el.parentElement !== card) {
        el.parentElement?.classList.remove('is-previewing');
        el.remove();
      }
    });

    const existingPreview = card.querySelector('.video-preview-wrap');
    if (existingPreview) {
      const vid = existingPreview.querySelector('video');
      if (vid) vid.pause();
      existingPreview.remove();
      card.classList.remove('is-previewing');
      return;
    }

    const safeVideoUrl = TwitVidUtils.sanitizeUrl(videoUrl);
    if (!safeVideoUrl) return;

    const previewWrap = document.createElement('div');
    previewWrap.className = 'video-preview-wrap';
    previewWrap.innerHTML = `
      <div class="preview-header">
        <span>🎬 Playing Preview</span>
        <button type="button" class="btn-close-preview" title="Close preview">✕ Close</button>
      </div>
      <video class="preview-video-element" src="${safeVideoUrl}" controls autoplay playsinline></video>
    `;

    const closeBtn = previewWrap.querySelector('.btn-close-preview');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vid = previewWrap.querySelector('video');
      if (vid) vid.pause();
      previewWrap.remove();
      card.classList.remove('is-previewing');
    });

    card.appendChild(previewWrap);
    card.classList.add('is-previewing');

    // Ensure the video preview is fully visible in the viewport
    function ensurePreviewVisible() {
      previewWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    requestAnimationFrame(() => {
      ensurePreviewVisible();
    });
    setTimeout(ensurePreviewVisible, 80);

    const vidEl = previewWrap.querySelector('video');
    if (vidEl) {
      vidEl.addEventListener('loadedmetadata', ensurePreviewVisible, { once: true });
      vidEl.addEventListener('play', ensurePreviewVisible, { once: true });
    }
  }

  /**
   * Renders video items into popup based on active filter
   */
  function renderVideos(videos) {
    currentVideos = videos || [];
    videoList.innerHTML = '';

    if (!currentVideos || currentVideos.length === 0) {
      emptyState.style.display = 'block';
      if (searchEmptyState) searchEmptyState.style.display = 'none';
      videoCountBadge.textContent = '0';
      return;
    }

    // Apply active filter
    let filtered = currentVideos;
    if (activeFilter === 'hd') {
      filtered = currentVideos.filter(v => {
        const variants = v.variants || [];
        return variants.some(item => (item.width >= 1280 || item.height >= 720 || (item.resTitle && parseInt(item.resTitle) >= 720)));
      });
    } else if (activeFilter === 'short') {
      filtered = currentVideos.filter(v => (v.durationMs && v.durationMs <= 60000));
    }

    // Apply search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(v => {
        const name = (v.authorName || '').toLowerCase();
        const handle = (v.authorHandle || '').toLowerCase();
        const text = (v.tweetText || '').toLowerCase();
        const id = String(v.tweetId || '').toLowerCase();
        return name.includes(query) || handle.includes(query) || text.includes(query) || id.includes(query);
      });
    }

    if (!filtered || filtered.length === 0) {
      if (query) {
        emptyState.style.display = 'none';
        if (searchEmptyState) searchEmptyState.style.display = 'block';
        if (searchEmptyText) {
          searchEmptyText.textContent = `No videos match "${searchQuery.trim()}".`;
        }
      } else {
        emptyState.style.display = 'block';
        if (searchEmptyState) searchEmptyState.style.display = 'none';
      }
      videoCountBadge.textContent = '0';
      return;
    }

    emptyState.style.display = 'none';
    if (searchEmptyState) searchEmptyState.style.display = 'none';
    videoCountBadge.textContent = String(filtered.length);

    for (const v of filtered) {
      const card = document.createElement('div');
      card.className = 'video-card';

      // Duration
      const durationText = v.durationMs ? TwitVidUtils.formatDuration(v.durationMs) : '';
      const durationBadge = durationText ? `<span class="card-duration">${durationText}</span>` : '';

      const authorInfo = TwitVidUtils.normalizeAuthorInfo(v.authorName, v.authorHandle);
      let authorTitle = '';
      if (authorInfo.authorName && authorInfo.authorHandle && authorInfo.authorName.toLowerCase() !== authorInfo.authorHandle.toLowerCase()) {
        authorTitle = `${authorInfo.authorName} (@${authorInfo.authorHandle})`;
      } else if (authorInfo.authorHandle) {
        authorTitle = `@${authorInfo.authorHandle}`;
      } else if (authorInfo.authorName) {
        authorTitle = authorInfo.authorName.startsWith('@') ? authorInfo.authorName : `@${authorInfo.authorName}`;
      } else {
        const textMention = (v.tweetText || '').match(/@([A-Za-z0-9_]{1,25})/);
        const tabAccount = tabUrl.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
        const validTabAccount = (tabAccount && !['home', 'explore', 'notifications', 'messages', 'i', 'search'].includes(tabAccount[1])) ? tabAccount[1] : null;

        if (textMention) {
          authorTitle = `@${textMention[1]}`;
        } else if (validTabAccount) {
          authorTitle = `@${validTabAccount}`;
        } else if (v.tweetText && v.tweetText.length > 5 && !v.tweetText.includes('Video from current')) {
          const firstPhrase = v.tweetText.split(/[.\n!?]/)[0].trim().slice(0, 35);
          authorTitle = firstPhrase || (validTabAccount ? `@${validTabAccount}` : 'Media');
        } else {
          authorTitle = validTabAccount ? `@${validTabAccount}` : 'Media';
        }
      }
      const tweetText = v.tweetText || 'Video from current feed / post.';

      const variants = TwitVidUtils.parseVideoVariants(v.variants || []);
      const previewUrl = variants.length > 0 ? variants[0].url : '';

      // Build thumbnail HTML with fallback
      let thumbHtml = '';
      const safePoster = TwitVidUtils.sanitizeUrl(v.poster);
      const safePreviewUrl = TwitVidUtils.sanitizeUrl(previewUrl);

      if (safePoster) {
        thumbHtml = `<img class="card-thumbnail" src="${safePoster}" alt="Thumbnail" referrerpolicy="no-referrer" loading="lazy" />`;
      } else if (safePreviewUrl) {
        thumbHtml = `<video class="card-thumbnail" src="${safePreviewUrl}#t=0.1" preload="metadata" muted playsinline></video>`;
      } else {
        thumbHtml = `<svg class="card-thumbnail" viewBox="0 0 24 24" style="padding: 16px; fill: #536471;"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11zm6 3v5l4.5-2.5L10 9.5z"/></svg>`;
      }

      const safeAuthorTitle = TwitVidUtils.escapeHtml(authorTitle);
      const safeTweetText = TwitVidUtils.escapeHtml(tweetText);

      // Build options for quality select dropdown (defaulting to max quality = index 0)
      let selectOptionsHtml = '';
      if (variants.length === 0) {
        selectOptionsHtml = `<option value="" disabled selected>Streams resolving...</option>`;
      } else {
        selectOptionsHtml = variants.map((variant, index) => {
          const isBest = (index === 0);
          const tag = isBest ? ' (★ Max)' : (variant.rateLabel ? ` • ${variant.rateLabel}` : '');
          const label = `${variant.resTitle || 'MP4'} ${variant.subTitle || 'Video'}${tag}`;
          return `<option value="${index}" ${isBest ? 'selected' : ''}>${TwitVidUtils.escapeHtml(label)}</option>`;
        }).join('');
      }

      card.innerHTML = `
        <div class="card-main">
          <div class="card-thumbnail-wrap" title="Click to Preview Video">
            ${thumbHtml}
            ${durationBadge}
            <div class="play-overlay">
              ${SVG_PLAY}
            </div>
          </div>
          <div class="card-info">
            <div class="card-text-group" title="Click to view post on page">
              <div class="card-author-title">${safeAuthorTitle}</div>
              <div class="card-text">${safeTweetText}</div>
            </div>
            <div class="card-controls">
              <div class="quality-select-wrap">
                <select class="quality-select" aria-label="Select Video Quality">
                  ${selectOptionsHtml}
                </select>
                <svg class="select-chevron" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </div>
              <button type="button" class="btn-card-download" title="Download selected quality" ${variants.length === 0 ? 'disabled' : ''}>
                ${SVG_DOWNLOAD_SM}
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Fallback if image fails to load (e.g. anti-hotlinking)
      const imgThumb = card.querySelector('img.card-thumbnail');
      if (imgThumb && previewUrl) {
        imgThumb.addEventListener('error', () => {
          const vid = document.createElement('video');
          vid.className = 'card-thumbnail';
          vid.src = `${previewUrl}#t=0.1`;
          vid.preload = 'metadata';
          vid.muted = true;
          vid.playsInline = true;
          imgThumb.replaceWith(vid);
        });
      }

      // Preview toggle on thumbnail click
      const thumbWrap = card.querySelector('.card-thumbnail-wrap');
      if (previewUrl) {
        thumbWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleVideoPreview(card, previewUrl);
        });
      }

      // Isolate quality select from triggering card click
      const selectEl = card.querySelector('.quality-select');
      if (selectEl) {
        selectEl.addEventListener('click', (e) => e.stopPropagation());
        selectEl.addEventListener('change', (e) => e.stopPropagation());
      }

      // Click on text group to scroll the webpage to that post
      const textGroup = card.querySelector('.card-text-group');
      if (textGroup) {
        textGroup.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!tab?.id) return;

          textGroup.classList.add('jump-active');

          const payload = {
            tweetId: v.tweetId,
            authorHandle: v.authorHandle,
            authorName: v.authorName,
            tweetText: v.tweetText,
            poster: v.poster,
            platform: v.platform || (isThreadsDomain ? 'Threads' : 'X')
          };

          let scrolled = false;

          // 1. Send message to content script
          try {
            const resp = await chrome.tabs.sendMessage(tab.id, {
              type: 'SCROLL_TO_POST',
              payload
            });
            if (resp && resp.success) {
              scrolled = true;
            }
          } catch (_) {}

          // 2. Direct script execution fallback (works even on tabs opened before extension update)
          if (!scrolled) {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (data) => {
                  const isThreads = data.platform === 'Threads' || location.hostname.includes('threads');

                  function resolvePostContainer(el) {
                    if (!el) return null;
                    if (isThreads) {
                      return el.closest('div[data-pressable-container="true"]') ||
                             el.closest('article') ||
                             el.closest('div[role="article"]') ||
                             el.closest('[data-twitvid-post-id]') ||
                             el;
                    }
                    return el.closest('article[data-testid="tweet"]') ||
                           el.closest('article') ||
                           el.closest('div[data-testid="cellInnerDiv"]') ||
                           el.closest('[data-twitvid-post-id]') ||
                           el;
                  }

                  let target = null;
                  const tweetId = data.tweetId;

                  // A. Tagged post ID
                  if (tweetId) {
                    const cleanId = String(tweetId).replace(/^threads_/, '');
                    target = document.querySelector(`[data-twitvid-post-id="${tweetId}"], [data-twitvid-post-id="${cleanId}"]`);
                  }

                  // B. Link match
                  if (!target && tweetId && !String(tweetId).startsWith('vid_')) {
                    const cleanId = String(tweetId).replace(/^threads_/, '');
                    if (!isThreads) {
                      const links = document.querySelectorAll(`a[href*="/status/${cleanId}"], a[href*="${cleanId}"]`);
                      for (const l of links) {
                        const p = resolvePostContainer(l);
                        if (p) { target = p; break; }
                      }
                      if (!target) {
                        const dataEl = document.querySelector(`[data-tweet-id="${cleanId}"]`);
                        if (dataEl) target = resolvePostContainer(dataEl);
                      }
                      if (!target && window.location.pathname.includes(cleanId)) {
                        target = document.querySelector('article[data-testid="tweet"]');
                      }
                    } else {
                      const links = document.querySelectorAll(`a[href*="/post/${cleanId}"], a[href*="/t/${cleanId}"], a[href*="${cleanId}"]`);
                      for (const l of links) {
                        const p = resolvePostContainer(l);
                        if (p) { target = p; break; }
                      }
                    }
                  }

                  // C. Media poster match
                  if (!target && data.poster) {
                    try {
                      const filename = data.poster.split('?')[0].split('/').pop();
                      if (filename && filename.length > 5) {
                        const m = document.querySelector(`img[src*="${filename}"], video[poster*="${filename}"]`);
                        if (m) target = resolvePostContainer(m);
                      }
                    } catch (_) {}
                  }

                  // D. Words match from caption
                  if (!target && data.tweetText && data.tweetText.length > 6) {
                    const words = data.tweetText
                      .replace(/https?:\/\/\S+/g, '')
                      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                      .split(/\s+/)
                      .filter(w => w.length >= 4);

                    const selector = isThreads
                      ? 'div[data-pressable-container="true"], article, div[role="article"]'
                      : 'article[data-testid="tweet"], div[data-testid="cellInnerDiv"]';
                    const posts = Array.from(document.querySelectorAll(selector));

                    if (words.length >= 2) {
                      const topWords = words.slice(0, 4).map(w => w.toLowerCase());
                      for (const p of posts) {
                        const t = (p.innerText || '').toLowerCase();
                        if (topWords.filter(w => t.includes(w)).length >= Math.min(2, topWords.length)) {
                          target = p;
                          break;
                        }
                      }
                    }

                    if (!target) {
                      const snippet = data.tweetText.trim().slice(0, 25);
                      for (const p of posts) {
                        if ((p.innerText || '').includes(snippet)) {
                          target = p;
                          break;
                        }
                      }
                    }
                  }

                  // E. Author handle match
                  if (!target && data.authorHandle) {
                    const h = data.authorHandle.replace(/^@/, '').toLowerCase();
                    const selector = isThreads
                      ? 'div[data-pressable-container="true"], article, div[role="article"]'
                      : 'article[data-testid="tweet"]';
                    const posts = document.querySelectorAll(selector);
                    for (const p of posts) {
                      const link = p.querySelector(`a[href*="/${h}"]`);
                      if (link || (p.innerText && p.innerText.toLowerCase().includes(`@${h}`))) {
                        if (p.querySelector('video') || p.querySelector('img')) {
                          target = p;
                          break;
                        }
                      }
                    }
                  }

                  if (target) {
                    // Scroll parent overflow containers if present
                    try {
                      let parent = target.parentElement;
                      while (parent && parent !== document.body && parent !== document.documentElement) {
                        const style = window.getComputedStyle(parent);
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                          const parentRect = parent.getBoundingClientRect();
                          const elRect = target.getBoundingClientRect();
                          const relTop = elRect.top - parentRect.top;
                          parent.scrollTo({
                            top: parent.scrollTop + relTop - (parent.clientHeight / 2) + (elRect.height / 2),
                            behavior: 'smooth'
                          });
                        }
                        parent = parent.parentElement;
                      }
                    } catch (_) {}

                    // Window scroll calculation
                    try {
                      const rect = target.getBoundingClientRect();
                      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                      const targetY = scrollTop + rect.top - (window.innerHeight / 2) + (rect.height / 2);
                      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
                    } catch (_) {}

                    // Native scrollIntoView
                    try {
                      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                    } catch (_) {
                      try { target.scrollIntoView(true); } catch (_) {}
                    }

                    // Apply high-visibility pulse highlight
                    const prevOutline = target.style.outline;
                    const prevShadow = target.style.boxShadow;
                    const prevTransition = target.style.transition;
                    target.style.transition = 'outline 0.2s ease, box-shadow 0.2s ease';
                    target.style.outline = '3px solid #1d9bf0';
                    target.style.boxShadow = '0 0 24px 8px rgba(29, 155, 240, 0.55)';
                    setTimeout(() => {
                      target.style.outline = prevOutline;
                      target.style.boxShadow = prevShadow;
                      target.style.transition = prevTransition;
                    }, 2500);

                    return { found: true };
                  }

                  return { found: false };
                },
                args: [payload]
              });

              if (results?.[0]?.result?.found) {
                scrolled = true;
              }
            } catch (err) {
              console.warn('[MediaCollect] executeScript scroll error:', err);
            }
          }

          // 3. Fallback: If post was virtualized away by infinite scroll, navigate to its permalink
          if (!scrolled) {
            const cleanId = String(v.tweetId || '').replace(/^threads_/, '');
            if (!isThreadsDomain && /^\d+$/.test(cleanId)) {
              await chrome.tabs.update(tab.id, { url: `https://x.com/i/status/${cleanId}` });
              scrolled = true;
            } else if (isThreadsDomain && cleanId && !cleanId.startsWith('vid_')) {
              await chrome.tabs.update(tab.id, { url: `https://www.threads.net/t/${cleanId}` });
              scrolled = true;
            }
          }

          // Close popup immediately so user focuses on the centered & highlighted post on the webpage
          setTimeout(() => {
            window.close();
          }, 100);
        });
      }

      // Download button click with selected quality
      const downloadBtn = card.querySelector('.btn-card-download');

      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedIdx = parseInt(selectEl.value, 10);
        const selectedVariant = (!isNaN(selectedIdx) && variants[selectedIdx]) ? variants[selectedIdx] : variants[0];
        if (selectedVariant) {
          downloadVariant(selectedVariant, v, downloadBtn);
        }
      });

      videoList.appendChild(card);

      // Asynchronously enrich author info & text via syndication API if handle is missing and we have a numeric tweetId
      if (!authorInfo.authorHandle && /^\d+$/.test(v.tweetId)) {
        chrome.runtime.sendMessage({
          type: 'FETCH_TWEET_MEDIA_FALLBACK',
          payload: { tweetId: v.tweetId }
        }).then(res => {
          if (res?.videoData) {
            const data = res.videoData;
            const norm = TwitVidUtils.normalizeAuthorInfo(data.authorName, data.authorHandle);
            let updatedTitle = '';
            if (norm.authorName && norm.authorHandle && norm.authorName.toLowerCase() !== norm.authorHandle.toLowerCase()) {
              updatedTitle = `${norm.authorName} (@${norm.authorHandle})`;
            } else if (norm.authorHandle) {
              updatedTitle = `@${norm.authorHandle}`;
            } else if (norm.authorName) {
              updatedTitle = norm.authorName.startsWith('@') ? norm.authorName : `@${norm.authorName}`;
            }
            if (updatedTitle) {
              const titleEl = card.querySelector('.card-author-title');
              if (titleEl) titleEl.textContent = updatedTitle;
              v.authorName = norm.authorName;
              v.authorHandle = norm.authorHandle;
            }
            if (data.tweetText && (!v.tweetText || v.tweetText.includes('Video from current'))) {
              const textEl = card.querySelector('.card-text');
              if (textEl) textEl.textContent = data.tweetText;
              v.tweetText = data.tweetText;
            }
            if (variants.length === 0 && data.variants && data.variants.length > 0) {
              v.variants = data.variants;
              const newVariants = TwitVidUtils.parseVideoVariants(data.variants);
              if (newVariants.length > 0) {
                selectEl.innerHTML = newVariants.map((varItem, idx) => {
                  const isBest = (idx === 0);
                  const tag = isBest ? ' (★ Max)' : (varItem.rateLabel ? ` • ${varItem.rateLabel}` : '');
                  const label = `${varItem.resTitle || 'MP4'} ${varItem.subTitle || 'Video'}${tag}`;
                  return `<option value="${idx}" ${isBest ? 'selected' : ''}>${TwitVidUtils.escapeHtml(label)}</option>`;
                }).join('');
                downloadBtn.disabled = false;
              }
            }
            if (tab?.id) {
              chrome.runtime.sendMessage({
                type: 'STORE_PAGE_VIDEOS',
                payload: { tabId: tab.id, videos: [v] }
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }
    }
  }

  /**
   * Fetches detected videos from active tab & background storage
   */
  async function loadVideos() {
    if (!tab?.id || !isVideoPlatform) return;

    let contentVideos = [];
    let bgVideos = [];

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_PAGE_VIDEOS' });
      if (response && Array.isArray(response.videos)) {
        contentVideos = response.videos;
      }
    } catch (_) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['shared/utils.js', 'content/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });
        const retryRes = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_PAGE_VIDEOS' });
        if (retryRes && Array.isArray(retryRes.videos)) {
          contentVideos = retryRes.videos;
        }
      } catch (_) {}
    }

    try {
      const bgResponse = await chrome.runtime.sendMessage({
        type: 'GET_PAGE_VIDEOS',
        payload: { tabId: tab.id }
      });
      if (bgResponse && Array.isArray(bgResponse.videos)) {
        bgVideos = bgResponse.videos;
      }
    } catch (_) {}

    let allVideos = TwitVidUtils.mergeAndDeduplicateVideos(contentVideos, bgVideos);
    renderVideos(allVideos);

    if (allVideos.length === 0) {
      setTimeout(async () => {
        try {
          const retry = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_PAGE_VIDEOS' });
          if (retry && Array.isArray(retry.videos) && retry.videos.length > 0) {
            renderVideos(retry.videos);
          }
        } catch (_) {}
      }, 500);
    }
  }

  /**
   * Explicit Clear list action
   */
  async function clearList() {
    if (!tab?.id) return;

    if (searchInput) searchInput.value = '';
    searchQuery = '';
    if (btnSearchClear) btnSearchClear.style.display = 'none';
    if (searchEmptyState) searchEmptyState.style.display = 'none';

    renderVideos([]);

    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_PAGE_VIDEOS',
        payload: { tabId: tab.id }
      });

      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_PAGE_VIDEOS' });
    } catch (_) {}
  }

  // Clear button click
  if (btnClear) btnClear.addEventListener('click', clearList);

  // Search input event handlers
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      if (btnSearchClear) {
        btnSearchClear.style.display = searchQuery ? 'flex' : 'none';
      }
      renderVideos(currentVideos);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchQuery = '';
        if (btnSearchClear) btnSearchClear.style.display = 'none';
        renderVideos(currentVideos);
      }
    });
  }

  if (btnSearchClear) {
    btnSearchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      searchQuery = '';
      btnSearchClear.style.display = 'none';
      renderVideos(currentVideos);
    });
  }

  if (btnSearchReset) {
    btnSearchReset.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      searchQuery = '';
      if (btnSearchClear) btnSearchClear.style.display = 'none';
      renderVideos(currentVideos);
    });
  }

  // Scan feed / refresh buttons
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.style.opacity = '0.7';
      await loadVideos();
      btnRefresh.style.opacity = '1';
    });
  }

  if (btnEmptyRescan) {
    btnEmptyRescan.addEventListener('click', async () => {
      await loadVideos();
    });
  }

  // Filter chips click handler
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter || 'all';
      renderVideos(currentVideos);
    });
  });

  // Initial load
  if (isVideoPlatform) {
    await loadVideos();
  }
});
