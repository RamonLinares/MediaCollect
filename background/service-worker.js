/**
 * Background Service Worker for Twitter / X Video Downloader
 * Manifest V3 compliant service worker.
 */

// Import shared utilities
importScripts('../shared/utils.js');

/**
 * Downloads a video using chrome.downloads API
 */
async function handleDownloadVideo(request) {
  const { url, filename, author, tweetId, label } = request;

  if (!url) {
    throw new Error('No video URL provided for download.');
  }

  const finalFilename = filename || TwitVidUtils.createVideoFilename({
    author: author || 'user',
    tweetId: tweetId || Date.now().toString(),
    label: label || 'video',
    platform: request.platform || ''
  });

  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename: `MediaCollect/${finalFilename}`,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    return { success: true, downloadId, filename: finalFilename };
  } catch (err) {
    try {
      const downloadId = await chrome.downloads.download({
        url,
        filename: finalFilename,
        saveAs: false,
        conflictAction: 'uniquify'
      });
      return { success: true, downloadId, filename: finalFilename };
    } catch (fallbackErr) {
      console.error('[MediaCollect] Download failed:', fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * Fetches tweet details from Twitter syndication endpoint as a fallback
 */
async function fetchTweetMediaFallback(tweetId) {
  if (!tweetId) throw new Error('No tweet ID provided');

  const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;

  try {
    const res = await fetch(syndicationUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Syndication fetch returned status ${res.status}`);
    }

    const data = await res.json();
    if (!data) throw new Error('Empty syndication data');

    let variants = [];
    let poster = '';
    let rawAuthorName = data.user?.name || '';
    let rawAuthorHandle = data.user?.screen_name || '';
    let tweetText = data.text || '';

    if (Array.isArray(data.mediaDetails)) {
      for (const m of data.mediaDetails) {
        if (m.video_info && Array.isArray(m.video_info.variants)) {
          variants = variants.concat(m.video_info.variants);
          poster = poster || m.media_url_https;
        }
      }
    }

    if (variants.length === 0 && data.video && Array.isArray(data.video.variants)) {
      variants = data.video.variants;
      poster = poster || data.video.poster;
    }

    const parsedVariants = TwitVidUtils.parseVideoVariants(variants);
    if (parsedVariants.length === 0) return null;

    const normalized = TwitVidUtils.normalizeAuthorInfo(rawAuthorName, rawAuthorHandle);

    return {
      tweetId,
      authorName: normalized.authorName,
      authorHandle: normalized.authorHandle,
      tweetText,
      poster,
      variants: parsedVariants,
      timestamp: Date.now()
    };
  } catch (err) {
    console.warn('[MediaCollect] Syndication fallback error for tweet ' + tweetId, err);
    return null;
  }
}

/**
 * Cache videos for a given tab ID in chrome.storage.session
 */
async function storeTabVideos(tabId, videos) {
  if (!tabId || !Array.isArray(videos)) return;
  const key = `tab_videos_${tabId}`;
  
  const existing = await chrome.storage.session.get(key);
  const existingList = existing[key] || [];

  const merged = TwitVidUtils.mergeAndDeduplicateVideos(videos, existingList);
  const trimmed = merged.slice(0, 35);
  await chrome.storage.session.set({ [key]: trimmed });
}

/**
 * Get cached videos for a tab ID
 */
async function getTabVideos(tabId) {
  if (!tabId) return [];
  const key = `tab_videos_${tabId}`;
  const data = await chrome.storage.session.get(key);
  return data[key] || [];
}

/**
 * Clear cached videos when a tab navigates or is refreshed
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const key = `tab_videos_${tabId}`;
    try {
      await chrome.storage.session.remove(key);
    } catch (_) {}
  }
});

// Clean up tab storage when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const key = `tab_videos_${tabId}`;
    await chrome.storage.session.remove(key);
  } catch (_) {}
});

// Message Passing Router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {};
  const tabId = sender.tab ? sender.tab.id : payload?.tabId;

  if (type === 'DOWNLOAD_VIDEO') {
    (async () => {
      try {
        const result = await handleDownloadVideo(payload);
        sendResponse({ success: true, result });
      } catch (err) {
        sendResponse({ success: false, error: err.message || 'Download error' });
      }
    })();
    return true;
  }

  if (type === 'STORE_PAGE_VIDEOS') {
    (async () => {
      try {
        if (tabId && payload?.videos) {
          await storeTabVideos(tabId, payload.videos);
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (type === 'GET_PAGE_VIDEOS') {
    (async () => {
      try {
        const videos = await getTabVideos(tabId);
        sendResponse({ success: true, videos });
      } catch (err) {
        sendResponse({ success: false, error: err.message, videos: [] });
      }
    })();
    return true;
  }

  if (type === 'CLEAR_PAGE_VIDEOS') {
    (async () => {
      try {
        if (tabId) {
          const key = `tab_videos_${tabId}`;
          await chrome.storage.session.remove(key);
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (type === 'FETCH_TWEET_MEDIA_FALLBACK') {
    (async () => {
      try {
        const videoData = await fetchTweetMediaFallback(payload.tweetId);
        sendResponse({ success: true, videoData });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

// Minimum interval to respect Chrome's MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND (2/sec)
let lastCaptureTimestamp = 0;
const MIN_CAPTURE_INTERVAL_MS = 550;

async function captureTabWithQuotaHandling(maxRetries = 5) {
  let delay = 600;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const elapsed = Date.now() - lastCaptureTimestamp;
    if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_CAPTURE_INTERVAL_MS - elapsed));
    }

    try {
      lastCaptureTimestamp = Date.now();
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      return dataUrl;
    } catch (err) {
      const isQuotaError = err.message && (
        err.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') ||
        err.message.includes('quota')
      );
      if (isQuotaError && attempt < maxRetries) {
        console.warn(`[MediaCollect] Capture quota pause: retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
        delay = Math.round(delay * 1.5);
        continue;
      }
      throw err;
    }
  }
}

  if (type === 'CAPTURE_VISIBLE_TAB') {
    (async () => {
      try {
        const dataUrl = await captureTabWithQuotaHandling();
        sendResponse({ success: true, dataUrl });
      } catch (err) {
        console.error('[MediaCollect] Capture tab error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (type === 'DOWNLOAD_SCREENSHOT') {
    (async () => {
      try {
        const { dataUrl, filename } = payload || {};
        const safeName = filename || `screenshot_${Date.now()}.png`;
        const downloadId = await chrome.downloads.download({
          url: dataUrl,
          filename: `MediaCollect/Screenshots/${safeName}`,
          saveAs: false,
          conflictAction: 'uniquify'
        });
        sendResponse({ success: true, downloadId });
      } catch (err) {
        console.error('[MediaCollect] Screenshot download error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (type === 'OPEN_STUDIO_TAB') {
    (async () => {
      try {
        const captureId = payload?.captureId || '';
        const url = chrome.runtime.getURL(`screenshot/studio.html?id=${encodeURIComponent(captureId)}`);
        const tab = await chrome.tabs.create({ url });
        sendResponse({ success: true, tabId: tab.id });
      } catch (err) {
        console.error('[MediaCollect] Open studio tab error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
