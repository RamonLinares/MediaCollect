/**
 * Isolated Content Script for Twitter / X & Threads Video Downloader
 * Handles DOM injection, MutationObserver, quality popovers, and communication.
 */

(function () {
  'use strict';

  const isThreads = location.hostname.includes('threads');
  const platformName = isThreads ? 'Threads' : 'X';

  // Video catalog: id -> VideoRecord
  const videoCatalog = new Map();
  let toastTimeout = null;
  let currentHref = location.href;

  // SVG Icons
  const SVG_DOWNLOAD = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3.25A.75.75 0 0 1 12 2.5zm-8.25 14a.75.75 0 0 1 .75.75v3.25c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-3.25a.75.75 0 0 1 1.5 0v3.25A2.25 2.25 0 0 1 18.75 22H5.25A2.25 2.25 0 0 1 3 19.75v-3.25a.75.75 0 0 1 .75-.75z"></path>
    </svg>
  `;

  const SVG_SPINNER = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity="0.25"></path>
      <path d="M12 2v4a6 6 0 0 1 6 6h4a10 10 0 0 0-10-10z"></path>
    </svg>
  `;

  const SVG_CHECK = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
    </svg>
  `;

  /**
   * Shows a floating toast message at the bottom right of the page
   */
  function showToast(message, isSuccess = true) {
    let toast = document.getElementById('twitvid-toast-container');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'twitvid-toast-container';
      toast.className = 'twitvid-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = isSuccess ? SVG_CHECK : SVG_DOWNLOAD;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);
    toast.classList.add('is-visible');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3500);
  }

  /**
   * Synchronize catalog with background service worker with debounce
   */
  let syncTimeout = null;
  function syncCatalogToBackground() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      const list = Array.from(videoCatalog.values());
      try {
        await chrome.runtime.sendMessage({
          type: 'STORE_PAGE_VIDEOS',
          payload: { videos: list }
        });
      } catch (_) {}
    }, 200);
  }

  /**
   * Register discovered video records with deduplication
   */
  function registerDiscoveredVideos(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return;
    const currentList = Array.from(videoCatalog.values());
    const merged = TwitVidUtils.mergeAndDeduplicateVideos(currentList, videos);

    videoCatalog.clear();
    for (const item of merged) {
      if (item.tweetId) {
        videoCatalog.set(item.tweetId, item);
      }
      if (item.mediaId) {
        videoCatalog.set(item.mediaId, item);
      }
    }

    syncCatalogToBackground();
  }

  // Listen to custom event from MAIN world interceptor
  window.addEventListener('__TWITVID_VIDEOS_DISCOVERED__', (e) => {
    if (e.detail) {
      registerDiscoveredVideos(Array.isArray(e.detail) ? e.detail : [e.detail]);
    }
  });

  // Initial request for cached videos
  window.dispatchEvent(new CustomEvent('__TWITVID_REQUEST_ALL_VIDEOS__'));

  /**
   * Tests if an element contains a video (X or Threads)
   */
  function postHasVideo(el) {
    if (!el) return false;
    return !!(
      el.querySelector('video') ||
      el.querySelector('[data-testid="videoPlayer"]') ||
      el.querySelector('[data-testid="videoComponent"]') ||
      el.querySelector('[aria-label="Embedded video"]') ||
      el.querySelector('[data-testid="playButton"]') ||
      el.querySelector('button[aria-label*="Play"]') ||
      el.querySelector('button[aria-label*="Watch"]') ||
      el.querySelector('a[href*="/video/"]') ||
      el.querySelector('div[data-testid="tweetPhoto"] video') ||
      el.querySelector('div[data-testid="placementTracking"]')
    );
  }

  /**
   * Extracts post metadata from Threads post DOM
   */
  function extractThreadsDataFromDOM(element) {
    if (!element) return null;

    let postId = null;
    let authorHandle = '';
    let authorName = '';
    let tweetText = '';
    let poster = '';

    // 1. Post links (/@user/post/CODE or /t/CODE)
    const postLinks = element.querySelectorAll('a[href*="/post/"], a[href*="/t/"]');
    for (const a of postLinks) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/@([^/?#]+)\/post\/([A-Za-z0-9_-]+)/) || href.match(/\/post\/([A-Za-z0-9_-]+)/) || href.match(/\/t\/([A-Za-z0-9_-]+)/);
      if (match) {
        if (match.length >= 3) {
          authorHandle = match[1];
          postId = match[2];
        } else {
          postId = match[1];
        }
        break;
      }
    }

    // 2. Author handle from profile links
    if (!authorHandle) {
      const userLink = element.querySelector('a[href^="/@"]');
      if (userLink) {
        const href = userLink.getAttribute('href') || '';
        const match = href.match(/\/@([^/?#]+)/);
        if (match) {
          authorHandle = match[1];
          authorName = userLink.innerText.trim() || authorHandle;
        }
      }
    }

    const normalized = TwitVidUtils.normalizeAuthorInfo(authorName, authorHandle);
    authorName = normalized.authorName;
    authorHandle = normalized.authorHandle;

    // 3. Caption text
    const textEls = element.querySelectorAll('span[dir="auto"], div[dir="auto"]');
    for (const t of textEls) {
      const text = t.innerText.trim();
      if (text.length > 5 && !text.startsWith('@') && text !== authorName) {
        tweetText = text;
        break;
      }
    }

    // 4. Video Poster & direct src
    const videoEl = element.querySelector('video');
    let directVideoSrc = '';
    if (videoEl) {
      poster = videoEl.poster || '';
      if (videoEl.src && !videoEl.src.startsWith('blob:')) {
        directVideoSrc = videoEl.src;
      }
      const sourceEl = videoEl.querySelector('source');
      if (!directVideoSrc && sourceEl && sourceEl.src && !sourceEl.src.startsWith('blob:')) {
        directVideoSrc = sourceEl.src;
      }
    }

    if (!postId) {
      if (directVideoSrc) {
        const clean = directVideoSrc.split('?')[0];
        const hash = clean.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '').slice(-12);
        postId = `threads_${hash}`;
      } else if (poster) {
        const hash = poster.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '').slice(-12);
        postId = `threads_${hash}`;
      }
    }

    return { tweetId: postId, authorHandle, authorName, tweetText, poster, directVideoSrc, platform: 'Threads' };
  }

  /**
   * Scrapes metadata directly from an X / Twitter Tweet DOM element
   */
  function extractTweetDataFromDOM(tweetElement) {
    if (!tweetElement) return null;

    if (isThreads) {
      return extractThreadsDataFromDOM(tweetElement);
    }

    let tweetId = null;
    let authorHandle = '';
    let authorName = '';
    let tweetText = '';
    let poster = '';
    let directVideoSrc = '';

    // 1. Tweet User Avatar (always present on X tweets and has the true handle and display name)
    const avatarEl = tweetElement.querySelector('div[data-testid="Tweet-User-Avatar"] a, a[data-testid="Tweet-User-Avatar"]');
    if (avatarEl) {
      const href = avatarEl.getAttribute('href') || '';
      const clean = href.replace(/^\//, '').split('/')[0].split('?')[0];
      if (clean && !['home', 'explore', 'notifications', 'messages', 'i'].includes(clean)) {
        authorHandle = clean;
      }
      const img = avatarEl.querySelector('img');
      if (img && img.getAttribute('alt')) {
        const alt = img.getAttribute('alt').trim();
        if (alt && !TwitVidUtils.isGenericAuthor(alt)) {
          authorName = alt;
        }
      }
    }

    // 2. User Name header container
    const userNameEl = tweetElement.querySelector('div[data-testid="User-Name"]');
    if (userNameEl) {
      const links = userNameEl.querySelectorAll('a[role="link"], a[href^="/"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const clean = href.replace(/^\//, '').split('/')[0].split('?')[0];
        if (clean && !['home', 'explore', 'notifications', 'messages', 'i'].includes(clean)) {
          if (!authorHandle) authorHandle = clean;
        }
      }

      const spans = userNameEl.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent.trim();
        if (text.startsWith('@') && text.length > 1) {
          if (!authorHandle) authorHandle = text.slice(1);
        } else if (text && !authorName && !text.startsWith('@') && text !== '·' && text !== '•') {
          if (!/^\d+[smhdwy]$/i.test(text) && !/^(\w{3}\s+\d+|\d+\s+\w{3})$/i.test(text) && !TwitVidUtils.isGenericAuthor(text)) {
            authorName = text;
          }
        }
      }
    }

    // 3. Time element permalink link -> definitive screen_name and tweet ID
    const timeLink = tweetElement.querySelector('time')?.closest('a');
    if (timeLink) {
      const href = timeLink.getAttribute('href') || '';
      const match = href.match(/(?:twitter\.com|x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
      if (match) {
        if (!['i', 'home', 'explore', 'notifications', 'messages'].includes(match[1])) {
          if (!authorHandle) authorHandle = match[1];
        }
        if (!tweetId) tweetId = match[2];
      }
    }

    // 4. Status links -> extract screen_name and tweet ID
    const statusLinks = tweetElement.querySelectorAll('a[href*="/status/"]');
    for (const a of statusLinks) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/(?:twitter\.com|x\.com)?\/([^/?#]+)\/status\/(\d+)/i);
      if (match) {
        const potentialHandle = match[1];
        if (!['i', 'home', 'explore', 'notifications', 'messages'].includes(potentialHandle)) {
          if (!authorHandle) authorHandle = potentialHandle;
        }
        if (!tweetId) tweetId = match[2];
        if (authorHandle && tweetId) break;
      }
      const numMatch = href.match(/\/status\/(\d+)/);
      if (numMatch && !tweetId) {
        tweetId = numMatch[1];
      }
    }

    // 4. Scan all internal links in the post (the first profile link is always the author)
    if (!authorHandle || !authorName) {
      const allLinks = tweetElement.querySelectorAll('a[href^="/"]');
      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        const parts = href.replace(/^\//, '').split('/');
        const candidate = parts[0].split('?')[0];
        if (candidate && !['home', 'explore', 'notifications', 'messages', 'i', 'search', 'hashtag', 'settings', 'tos', 'privacy'].includes(candidate.toLowerCase())) {
          if (!authorHandle) authorHandle = candidate;
          const text = link.innerText.trim();
          if (text && !authorName && !text.startsWith('@') && !TwitVidUtils.isGenericAuthor(text)) {
            authorName = text;
          }
          if (authorHandle && authorName) break;
        }
      }
    }

    // 5. Fallback from current page URL if on a status permalink page
    if (window.location.pathname) {
      const pageMatch = window.location.pathname.match(/\/([^/?#]+)\/status\/(\d+)/i);
      if (pageMatch) {
        if (!authorHandle && !['i', 'home', 'explore'].includes(pageMatch[1])) {
          authorHandle = pageMatch[1];
        }
        if (!tweetId) {
          tweetId = pageMatch[2];
        }
      }
    }

    // 6. Fallback from OpenGraph and page title metadata
    if (!authorName) {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogMatch = ogTitle.match(/^(.+?)\s+on\s+X\s*:/i) || document.title.match(/^(.+?)\s+on\s+X\s*:/i);
      if (ogMatch && !TwitVidUtils.isGenericAuthor(ogMatch[1])) {
        authorName = ogMatch[1].trim();
      }
    }
    if (!authorHandle) {
      const creator = document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content');
      if (creator && creator.startsWith('@')) {
        authorHandle = creator.replace('@', '').trim();
      }
    }

    const normalized = TwitVidUtils.normalizeAuthorInfo(authorName, authorHandle);
    authorName = normalized.authorName;
    authorHandle = normalized.authorHandle;

    // 4. Tweet Text
    const tweetTextEl = tweetElement.querySelector('div[data-testid="tweetText"]');
    if (tweetTextEl) {
      tweetText = tweetTextEl.innerText.trim();
    }

    // 5. Video Poster
    const videoEl = tweetElement.querySelector('video');
    if (videoEl) {
      poster = videoEl.poster || '';
      if (videoEl.src && !videoEl.src.startsWith('blob:')) {
        directVideoSrc = videoEl.src;
      }
    }
    if (!poster) {
      const imgThumb = tweetElement.querySelector('img[src*="video_thumb"], img[src*="media"], img[src*="ext_tw_video_thumb"]');
      if (imgThumb) poster = imgThumb.src;
    }

    return { tweetId, authorHandle, authorName, tweetText, poster, directVideoSrc, platform: 'X' };
  }

  /**
   * Trigger download for a given variant and video record
   */
  async function triggerDownload(variant, videoRecord, btnElement) {
    if (!variant || !variant.url) return;

    const label = TwitVidUtils.formatVariantLabel(variant);
    showToast(`Downloading ${label}...`);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO',
        payload: {
          url: variant.url,
          author: videoRecord.authorHandle || videoRecord.authorName || 'user',
          tweetId: videoRecord.tweetId || '',
          platform: videoRecord.platform || platformName,
          label
        }
      });

      if (response && response.success) {
        showToast('Download started in Chrome!', true);
      } else {
        showToast('Download started in Chrome!', true);
      }
    } catch (err) {
      console.error('[MediaCollect] Download message error:', err);
      const a = document.createElement('a');
      a.href = variant.url;
      a.download = TwitVidUtils.createVideoFilename({
        author: videoRecord.authorHandle || videoRecord.authorName,
        tweetId: videoRecord.tweetId,
        platform: videoRecord.platform || platformName,
        label
      });
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  /**
   * Builds the quality selector dropdown popover
   */
  function createQualityDropdown(videoRecord, buttonWrap) {
    const dropdown = document.createElement('div');
    dropdown.className = 'twitvid-dropdown';

    const header = document.createElement('div');
    header.className = 'twitvid-dropdown-header';
    header.innerHTML = `<span>Select Video Quality</span><span>MP4</span>`;
    dropdown.appendChild(header);

    const variants = videoRecord.variants || [];

    for (const v of variants) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'twitvid-dropdown-item';

      const label = TwitVidUtils.formatVariantLabel(v);
      const isHD = (v.width >= 1280 || v.height >= 720 || label.includes('HD'));
      const hdBadge = isHD ? `<span class="twitvid-hd-badge">HD</span>` : '';
      const meta = v.bitrateLabel ? `<span class="twitvid-item-meta">${v.bitrateLabel}</span>` : '';

      item.innerHTML = `
        <span class="twitvid-item-quality">
          ${label}
          ${hdBadge}
        </span>
        <span style="display: flex; align-items: center; gap: 6px;">
          ${meta}
          <span class="twitvid-item-icon">${SVG_DOWNLOAD}</span>
        </span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        dropdown.classList.remove('is-open');
        triggerDownload(v, videoRecord, buttonWrap);
      });

      dropdown.appendChild(item);
    }

    return dropdown;
  }

  /**
   * Proactively fetches video stream metadata for a tweet ID
   */
  async function resolveTweetMedia(tweetId, domData) {
    if (!tweetId) return null;

    let record = videoCatalog.get(tweetId);
    if (record && record.variants && record.variants.length > 0) {
      return record;
    }

    // Direct DOM video src check for Threads or X
    if (domData?.directVideoSrc) {
      const directRecord = {
        tweetId,
        authorHandle: domData.authorHandle,
        authorName: domData.authorName,
        tweetText: domData.tweetText,
        poster: domData.poster,
        platform: domData.platform || platformName,
        variants: TwitVidUtils.parseVideoVariants([{
          url: domData.directVideoSrc,
          label: 'Standard Quality',
          bitrate: 0
        }])
      };
      registerDiscoveredVideos([directRecord]);
      return directRecord;
    }

    // Twitter syndication fallback if on X
    if (!isThreads) {
      try {
        const fallbackRes = await chrome.runtime.sendMessage({
          type: 'FETCH_TWEET_MEDIA_FALLBACK',
          payload: { tweetId }
        });

        if (fallbackRes && fallbackRes.videoData) {
          const enriched = {
            ...fallbackRes.videoData,
            authorName: (domData?.authorName && domData.authorName !== 'Post' && domData.authorName !== 'X Post') ? domData.authorName : fallbackRes.videoData.authorName,
            authorHandle: domData?.authorHandle || fallbackRes.videoData.authorHandle,
            tweetText: domData?.tweetText || fallbackRes.videoData.tweetText,
            poster: domData?.poster || fallbackRes.videoData.poster,
            platform: 'X'
          };
          registerDiscoveredVideos([enriched]);
          return enriched;
        }
      } catch (_) {}
    }

    return null;
  }

  /**
   * Injects the download button on a tweet / threads post element
   */
  async function attachDownloadButtonToPost(postElement) {
    if (postElement.hasAttribute('data-twitvid-injected')) return;
    if (!postHasVideo(postElement)) return;

    let actionBar = postElement.querySelector('div[role="group"]');
    if (!actionBar && isThreads) {
      actionBar = postElement.querySelector('div[style*="flex-direction: row"]') || postElement.querySelector('svg')?.parentElement?.parentElement;
    }
    if (!actionBar) return;

    postElement.setAttribute('data-twitvid-injected', 'true');

    const domData = extractTweetDataFromDOM(postElement);
    if (!domData) return;

    const { tweetId, authorHandle, authorName, tweetText, poster } = domData;

    if (tweetId && videoCatalog.has(tweetId)) {
      const existing = videoCatalog.get(tweetId);
      if (authorName && !TwitVidUtils.isGenericAuthor(authorName)) existing.authorName = authorName;
      if (authorHandle && !TwitVidUtils.isGenericAuthor(authorHandle)) existing.authorHandle = authorHandle;
      if (tweetText && !existing.tweetText) existing.tweetText = tweetText;
      if (poster && !existing.poster) existing.poster = poster;
    }

    const wrap = document.createElement('div');
    wrap.className = 'twitvid-action-btn-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'twitvid-action-btn';
    btn.setAttribute('aria-label', 'Download Video');
    btn.setAttribute('title', `Download Video (${platformName})`);
    btn.innerHTML = SVG_DOWNLOAD;
    wrap.appendChild(btn);

    actionBar.appendChild(wrap);

    let dropdown = null;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      let record = tweetId ? videoCatalog.get(tweetId) : null;

      if (!record || !record.variants || record.variants.length === 0) {
        btn.classList.add('is-loading');
        btn.innerHTML = SVG_SPINNER;

        record = await resolveTweetMedia(tweetId, domData);

        if (!record || !record.variants || record.variants.length === 0) {
          const vidEl = postElement.querySelector('video');
          const src = vidEl?.src || vidEl?.querySelector('source')?.src;
          if (src && !src.startsWith('blob:')) {
            record = {
              tweetId: tweetId || `vid_${Date.now()}`,
              authorHandle,
              authorName,
              tweetText,
              poster,
              platform: platformName,
              variants: TwitVidUtils.parseVideoVariants([{
                url: src,
                label: 'Standard Quality',
                bitrate: 0,
                width: vidEl.videoWidth || 0,
                height: vidEl.videoHeight || 0
              }])
            };
            registerDiscoveredVideos([record]);
          }
        }

        btn.classList.remove('is-loading');
        btn.innerHTML = SVG_DOWNLOAD;
      }

      if (!record || !record.variants || record.variants.length === 0) {
        showToast('Scanning video streams... Please play video once if download is not ready.', false);
        return;
      }

      if (record.variants.length === 1) {
        triggerDownload(record.variants[0], record, wrap);
        return;
      }

      if (!dropdown) {
        dropdown = createQualityDropdown(record, wrap);
        wrap.appendChild(dropdown);
      }

      const isOpen = dropdown.classList.contains('is-open');
      document.querySelectorAll('.twitvid-dropdown.is-open').forEach(d => d.classList.remove('is-open'));

      if (!isOpen) {
        dropdown.classList.add('is-open');
      }
    });
  }

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.twitvid-action-btn-wrap')) {
      document.querySelectorAll('.twitvid-dropdown.is-open').forEach(d => d.classList.remove('is-open'));
    }
  });

  /**
   * Scans all visible post elements on the page
   */
  function processVisiblePosts() {
    if (location.href !== currentHref) {
      currentHref = location.href;
      videoCatalog.clear();
      window.dispatchEvent(new CustomEvent('__TWITVID_REQUEST_ALL_VIDEOS__'));
    }

    const selector = isThreads
      ? 'div[data-pressable-container="true"]:not([data-twitvid-injected]), article:not([data-twitvid-injected]), div[role="article"]:not([data-twitvid-injected])'
      : 'article[data-testid="tweet"]:not([data-twitvid-injected])';

    const posts = document.querySelectorAll(selector);
    for (const post of posts) {
      attachDownloadButtonToPost(post);
    }
  }

  // MutationObserver with strict debounce and un-processed node filtering
  let mutationTimeout = null;
  const observer = new MutationObserver(() => {
    if (mutationTimeout) return;
    mutationTimeout = setTimeout(() => {
      mutationTimeout = null;
      processVisiblePosts();
    }, 250);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processVisiblePosts);
  } else {
    processVisiblePosts();
  }

  window.addEventListener('popstate', processVisiblePosts);

  function isElementInViewport(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom >= -150 && rect.top <= windowHeight + 350;
  }

  /**
   * Collects all videos in current visible DOM order, proactively resolving streams
   */
  async function collectPageVideos() {
    // Request cached videos from main world
    window.dispatchEvent(new CustomEvent('__TWITVID_REQUEST_ALL_VIDEOS__'));
    await new Promise(r => setTimeout(r, 60));

    const selector = isThreads
      ? 'div[data-pressable-container="true"], article, div[role="article"], div:has(> video)'
      : 'article[data-testid="tweet"]';

    let domPosts = [];
    try {
      domPosts = Array.from(document.querySelectorAll(selector));
    } catch (_) {
      domPosts = Array.from(document.querySelectorAll('article, div[role="article"]'));
    }

    // Also include any standalone video tags if no posts matched
    if (domPosts.length === 0) {
      const standaloneVideos = document.querySelectorAll('video');
      domPosts = Array.from(standaloneVideos).map(v => v.closest('div[role="article"]') || v.parentElement || v);
    }

    domPosts.sort((a, b) => {
      const inA = isElementInViewport(a) ? 1 : 0;
      const inB = isElementInViewport(b) ? 1 : 0;
      if (inB !== inA) return inB - inA;
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    const visibleVideos = [];
    const seenIds = new Set();
    const resolutionPromises = [];

    for (const post of domPosts) {
      if (!postHasVideo(post)) continue;

      const data = extractTweetDataFromDOM(post);
      if (!data || !data.tweetId) continue;

      if (!seenIds.has(data.tweetId)) {
        seenIds.add(data.tweetId);
        let cached = videoCatalog.get(data.tweetId);

        if (!cached || !cached.variants || cached.variants.length === 0) {
          const p = (async () => {
            try {
              const res = await resolveTweetMedia(data.tweetId, data);
              if (res) visibleVideos.push(res);
            } catch (_) {}
          })();
          resolutionPromises.push(p);
        } else {
          const mergedAuthorHandle = (!TwitVidUtils.isGenericAuthor(data.authorHandle) && data.authorHandle)
            ? data.authorHandle
            : (!TwitVidUtils.isGenericAuthor(cached.authorHandle) ? cached.authorHandle : '');
          const mergedAuthorName = (!TwitVidUtils.isGenericAuthor(data.authorName) && data.authorName)
            ? data.authorName
            : (!TwitVidUtils.isGenericAuthor(cached.authorName) ? cached.authorName : '');

          const item = {
            ...cached,
            authorName: mergedAuthorName,
            authorHandle: mergedAuthorHandle,
            tweetText: data.tweetText || cached.tweetText,
            poster: data.poster || cached.poster,
            platform: data.platform || platformName
          };

          if (!isThreads && !mergedAuthorHandle && /^\d+$/.test(data.tweetId)) {
            const p = (async () => {
              try {
                const res = await chrome.runtime.sendMessage({
                  type: 'FETCH_TWEET_MEDIA_FALLBACK',
                  payload: { tweetId: data.tweetId }
                });
                if (res?.videoData?.authorHandle) {
                  item.authorHandle = res.videoData.authorHandle;
                  if (!item.authorName || TwitVidUtils.isGenericAuthor(item.authorName)) {
                    item.authorName = res.videoData.authorName || res.videoData.authorHandle;
                  }
                  if (res.videoData.tweetText && (!item.tweetText || item.tweetText.includes('Video from current'))) {
                    item.tweetText = res.videoData.tweetText;
                  }
                  cached.authorHandle = item.authorHandle;
                  cached.authorName = item.authorName;
                }
              } catch (_) {}
            })();
            resolutionPromises.push(p);
          }

          visibleVideos.push(item);
        }
      }
    }

    if (resolutionPromises.length > 0) {
      await Promise.race([
        Promise.allSettled(resolutionPromises),
        new Promise(r => setTimeout(r, 600))
      ]);
    }

    const allCatalog = Array.from(videoCatalog.values());
    return TwitVidUtils.mergeAndDeduplicateVideos(visibleVideos, allCatalog);
  }

  // Message listener from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CURRENT_PAGE_VIDEOS') {
      (async () => {
        const mergedList = await collectPageVideos();
        sendResponse({ success: true, videos: mergedList });
      })();
      return true;
    }

    if (message.type === 'CLEAR_PAGE_VIDEOS') {
      videoCatalog.clear();
      sendResponse({ success: true, videos: [] });
      return true;
    }

    return false;
  });

})();
