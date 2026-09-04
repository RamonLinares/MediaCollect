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

  // SVG Icons
  const SVG_DOWNLOAD_TILE = `
    <svg viewBox="0 0 24 24" class="quality-tile-icon">
      <path d="M12 2.5a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3.25A.75.75 0 0 1 12 2.5zm-8.25 14a.75.75 0 0 1 .75.75v3.25c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-3.25a.75.75 0 0 1 1.5 0v3.25A2.25 2.25 0 0 1 18.75 22H5.25A2.25 2.25 0 0 1 3 19.75v-3.25a.75.75 0 0 1 .75-.75z"/>
    </svg>
  `;

  const SVG_CHECK_SM = `
    <svg viewBox="0 0 24 24" class="quality-tile-icon">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  `;

  const SVG_PLAY = `
    <svg viewBox="0 0 24 24" class="play-icon">
      <path d="M8 5v14l11-7z"/>
    </svg>
  `;

  const SVG_PLAY_SM = `
    <svg viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
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
  async function downloadVariant(variant, record, tileBtn) {
    if (!variant?.url) return;

    const label = TwitVidUtils.formatVariantLabel(variant);
    const originalContent = tileBtn.innerHTML;
    tileBtn.disabled = true;
    tileBtn.style.opacity = '0.7';

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

      const iconEl = tileBtn.querySelector('.quality-tile-icon');
      if (iconEl) {
        iconEl.outerHTML = SVG_CHECK_SM;
      }
      setTimeout(() => {
        tileBtn.disabled = false;
        tileBtn.style.opacity = '1';
        tileBtn.innerHTML = originalContent;
      }, 2500);
    } catch (err) {
      console.error('[MediaCollect] Download error:', err);
      tileBtn.disabled = false;
      tileBtn.style.opacity = '1';
      tileBtn.innerHTML = originalContent;
    }
  }

  /**
   * Toggles inline video preview player in a card
   */
  function toggleVideoPreview(card, videoUrl) {
    document.querySelectorAll('.video-preview-wrap').forEach(el => {
      const vid = el.querySelector('video');
      if (vid) vid.pause();
      if (el.parentElement !== card) el.remove();
    });

    const existingPreview = card.querySelector('.video-preview-wrap');
    if (existingPreview) {
      const vid = existingPreview.querySelector('video');
      if (vid) vid.pause();
      existingPreview.remove();
      return;
    }

    const safeVideoUrl = TwitVidUtils.sanitizeUrl(videoUrl);
    if (!safeVideoUrl) return;

    const previewWrap = document.createElement('div');
    previewWrap.className = 'video-preview-wrap';
    previewWrap.innerHTML = `
      <video class="preview-video-element" src="${safeVideoUrl}" controls autoplay playsinline></video>
      <div class="preview-header">
        <span>🎬 Playing Preview</span>
        <button type="button" class="btn-close-preview">✕ Close</button>
      </div>
    `;

    const closeBtn = previewWrap.querySelector('.btn-close-preview');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vid = previewWrap.querySelector('video');
      if (vid) vid.pause();
      previewWrap.remove();
    });

    const grid = card.querySelector('.resolution-grid');
    card.insertBefore(previewWrap, grid);
  }

  /**
   * Renders video items into popup based on active filter
   */
  function renderVideos(videos) {
    currentVideos = videos || [];
    videoList.innerHTML = '';

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

    if (!filtered || filtered.length === 0) {
      emptyState.style.display = 'block';
      videoCountBadge.textContent = '0';
      return;
    }

    emptyState.style.display = 'none';
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
        const textMatch = (v.tweetText || '').match(/^@([A-Za-z0-9_]{1,25})/);
        if (textMatch) {
          authorTitle = `@${textMatch[1]}`;
        } else {
          authorTitle = v.platform ? `${v.platform} Video` : 'Social Video';
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

      card.innerHTML = `
        <div class="card-top">
          <div class="card-thumbnail-wrap" title="Click to Preview Video">
            ${thumbHtml}
            ${durationBadge}
            <div class="play-overlay">
              ${SVG_PLAY}
            </div>
          </div>
          <div class="card-info">
            <div class="card-author-title">${safeAuthorTitle}</div>
            <div class="card-text">${safeTweetText}</div>
            <button type="button" class="btn-preview-toggle">
              ${SVG_PLAY_SM}
              <span>Preview</span>
            </button>
          </div>
        </div>
        <div class="resolution-grid"></div>
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

      // Thumbnail preview click
      const thumbWrap = card.querySelector('.card-thumbnail-wrap');
      if (previewUrl) {
        thumbWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleVideoPreview(card, previewUrl);
        });
      }

      // Preview toggle button click
      const previewBtn = card.querySelector('.btn-preview-toggle');
      if (previewUrl) {
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleVideoPreview(card, previewUrl);
        });
      } else {
        previewBtn.style.display = 'none';
      }

      const gridWrap = card.querySelector('.resolution-grid');

      if (variants.length === 0) {
        gridWrap.innerHTML = `<span style="font-size: 11px; color: var(--text-muted); padding: 6px;">Streams resolving... Click Scan Feed.</span>`;
      } else {
        variants.forEach((variant, index) => {
          const tile = document.createElement('button');
          tile.type = 'button';
          const isBest = (index === 0);
          tile.className = `quality-tile ${isBest ? 'is-best' : ''}`;

          const starBadgeHtml = isBest ? `<span class="star-badge">★</span>` : '';
          const rateLabelHtml = variant.rateLabel ? `<span class="tile-rate-label">${variant.rateLabel}</span>` : '';

          tile.innerHTML = `
            ${starBadgeHtml}
            ${SVG_DOWNLOAD_TILE}
            <div class="quality-tile-content">
              <span class="tile-res-title">${variant.resTitle || 'MP4'}</span>
              <span class="tile-sub-title">${variant.subTitle || 'Video'}</span>
              ${rateLabelHtml}
            </div>
          `;

          tile.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadVariant(variant, v, tile);
          });

          gridWrap.appendChild(tile);
        });
      }

      videoList.appendChild(card);
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
