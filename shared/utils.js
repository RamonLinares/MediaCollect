/**
 * Shared Utilities for Twitter / X & Threads Video Downloader
 */

/**
 * Extracts a tweet or Threads post ID from various URL patterns or strings.
 * @param {string} input - URL or text containing status/post path
 * @returns {string|null} Tweet/Post ID or null
 */
function extractPostId(input) {
  if (!input || typeof input !== 'string') return null;
  // Match X/Twitter status IDs
  const twitterMatch = input.match(/status\/(\d+)/i) || input.match(/^(\d{10,25})$/);
  if (twitterMatch) return twitterMatch[1];

  // Match Threads post IDs (e.g. /@user/post/DGEq7p3yGj9 or /t/DGEq7p3yGj9)
  const threadsMatch = input.match(/post\/([A-Za-z0-9_-]+)/i) || input.match(/\/t\/([A-Za-z0-9_-]+)/i);
  if (threadsMatch) return threadsMatch[1];

  return null;
}

const extractTweetId = extractPostId;

/**
 * Formats a bitrate value into Mbps or Kbps
 */
function formatBitrate(bitrate) {
  if (!bitrate || bitrate <= 0) return '';
  if (bitrate >= 1000000) {
    return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bitrate / 1000)} Kbps`;
}

/**
 * Extracts structured resolution parts (resTitle, subTitle)
 */
function getResolutionParts(v) {
  let width = v.width || 0;
  let height = v.height || 0;

  if (v.url && (!width || !height)) {
    const m = v.url.match(/\/vid\/(?:avc1\/)?(\d+)x(\d+)\//i) || v.url.match(/(\d+)x(\d+)/i);
    if (m) {
      width = width || parseInt(m[1], 10);
      height = height || parseInt(m[2], 10);
    }
  }

  const minDim = Math.min(width, height) || 0;
  const maxDim = Math.max(width, height) || 0;

  if (minDim >= 1080 || maxDim >= 1920) return { resTitle: '1080p', subTitle: 'Full HD' };
  if (minDim >= 720 || maxDim >= 1280) return { resTitle: '720p', subTitle: 'HD' };
  if (minDim >= 480 || maxDim >= 854) return { resTitle: '480p', subTitle: 'SD' };
  if (minDim >= 360 || maxDim >= 640) return { resTitle: '360p', subTitle: 'SD' };
  if (minDim >= 240 || maxDim >= 320) return { resTitle: '240p', subTitle: 'Low' };
  if (minDim > 0) return { resTitle: `${minDim}p`, subTitle: 'MP4' };

  if (v.bitrate) {
    const kbps = Math.round(v.bitrate / 1000);
    if (kbps >= 2000) return { resTitle: '1080p', subTitle: 'HD' };
    if (kbps >= 1000) return { resTitle: '720p', subTitle: 'HD' };
    if (kbps >= 500) return { resTitle: '480p', subTitle: 'SD' };
    return { resTitle: `${kbps}k`, subTitle: 'SD' };
  }

  return { resTitle: 'MP4', subTitle: 'Video' };
}

/**
 * Formats a clean resolution and quality label for a video variant.
 */
function formatVariantLabel(v) {
  if (!v) return 'Standard Quality';
  if (v.label && typeof v.label === 'string' && v.label !== 'undefined' && v.label.trim() !== '') {
    return v.label;
  }

  const parts = getResolutionParts(v);
  return `${parts.resTitle} ${parts.subTitle}`;
}

/**
 * Parses and sorts video variants from Twitter's video_info or Threads video_versions.
 * Returns only MP4 video variants sorted by quality (highest bitrate/resolution first).
 */
function parseVideoVariants(variants) {
  if (!Array.isArray(variants)) return [];

  const mp4s = variants
    .filter(v => v && (v.content_type === 'video/mp4' || (v.url && !v.url.includes('.m3u8'))))
    .map(v => {
      let width = v.width || 0;
      let height = v.height || 0;

      if (v.url) {
        const resMatch = v.url.match(/\/vid\/(?:avc1\/)?(\d+)x(\d+)\//i) || v.url.match(/(\d+)x(\d+)/i);
        if (resMatch) {
          width = width || parseInt(resMatch[1], 10);
          height = height || parseInt(resMatch[2], 10);
        }
      }

      const bitrate = v.bitrate || 0;
      const rateLabel = formatBitrate(bitrate);
      const { resTitle, subTitle } = getResolutionParts({ width, height, bitrate, url: v.url });
      const label = `${resTitle} ${subTitle}`;

      return {
        url: v.url,
        bitrate,
        width,
        height,
        resTitle,
        subTitle,
        rateLabel,
        label,
        bitrateLabel: rateLabel,
        contentType: v.content_type || 'video/mp4'
      };
    })
    .sort((a, b) => {
      if (b.bitrate && a.bitrate && b.bitrate !== a.bitrate) {
        return (b.bitrate || 0) - (a.bitrate || 0);
      }
      return ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0));
    });

  // Deduplicate variants with the same clean URL
  const seen = new Set();
  const unique = [];
  for (let i = 0; i < mp4s.length; i++) {
    const item = mp4s[i];
    const cleanUrl = item.url.split('?')[0];
    if (!seen.has(cleanUrl)) {
      seen.add(cleanUrl);
      unique.push({
        ...item,
        isBest: unique.length === 0
      });
    }
  }

  return unique;
}

/**
 * Checks if a given author name or handle is a generic placeholder
 */
function isGenericAuthor(str) {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim().toLowerCase();
  return !s ||
    s === 'post' ||
    s === 'x post' ||
    s === 'threads post' ||
    s === 'user' ||
    s === 'x user' ||
    s === 'threads user' ||
    s === 'x_user' ||
    s === '@x_user' ||
    s === 'threads_user' ||
    s === 'unknown';
}

/**
 * Normalizes author name and handle, discarding generic placeholders
 */
function normalizeAuthorInfo(name, handle) {
  let cleanHandle = (handle || '').trim().replace(/^@/, '');
  if (isGenericAuthor(cleanHandle)) cleanHandle = '';

  let cleanName = (name || '').trim();
  if (isGenericAuthor(cleanName)) cleanName = '';

  if (!cleanName && cleanHandle) {
    cleanName = cleanHandle;
  }

  return {
    authorName: cleanName,
    authorHandle: cleanHandle
  };
}

/**
 * Creates a clean, safe filename for downloading a video.
 */
function createVideoFilename({ author = 'user', tweetId = '', label = '', platform = '' } = {}) {
  const prefix = platform ? platform.toLowerCase() : (tweetId && tweetId.length < 15 && isNaN(tweetId) ? 'threads' : 'x');
  const safeAuthor = (author || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const safeId = (tweetId || Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanLabel = (label || 'video').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  return `${prefix}_${safeAuthor}_${safeId}_${cleanLabel}.mp4`;
}

/**
 * Formats duration in milliseconds to MM:SS
 */
function formatDuration(ms) {
  if (!ms || isNaN(ms)) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Deduplicates and merges lists of video records smartly.
 */
function mergeAndDeduplicateVideos(listA = [], listB = []) {
  const all = [...(listA || []), ...(listB || [])];
  const results = [];

  for (const item of all) {
    if (!item) continue;

    let existingIndex = -1;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      // 1. Match by exact Post/Tweet ID
      if (item.tweetId && r.tweetId && item.tweetId === r.tweetId && !item.tweetId.startsWith('vid_')) {
        existingIndex = i;
        break;
      }

      // 2. Match by poster URL if valid
      if (item.poster && r.poster && item.poster === r.poster && item.poster.length > 10) {
        existingIndex = i;
        break;
      }

      // 3. Match by any MP4 variant URL
      if (Array.isArray(item.variants) && Array.isArray(r.variants)) {
        const itemUrls = new Set(item.variants.map(v => (v.url || '').split('?')[0]));
        const hasMatchingUrl = r.variants.some(v => itemUrls.has((v.url || '').split('?')[0]));
        if (hasMatchingUrl) {
          existingIndex = i;
          break;
        }
      }
    }

    const itemAuth = normalizeAuthorInfo(item.authorName, item.authorHandle);

    if (existingIndex >= 0) {
      const old = results[existingIndex];
      const oldAuth = normalizeAuthorInfo(old.authorName, old.authorHandle);

      const finalAuthorName = !isGenericAuthor(itemAuth.authorName)
        ? itemAuth.authorName
        : (!isGenericAuthor(oldAuth.authorName) ? oldAuth.authorName : (itemAuth.authorHandle || oldAuth.authorHandle || ''));

      const finalAuthorHandle = !isGenericAuthor(itemAuth.authorHandle) && itemAuth.authorHandle
        ? itemAuth.authorHandle
        : (!isGenericAuthor(oldAuth.authorHandle) && oldAuth.authorHandle ? oldAuth.authorHandle : '');

      const isGenericText = (t) => !t || t.includes('timeline / post') || t.includes('Video from') || t.trim() === '';
      const mergedTweetText = !isGenericText(item.tweetText)
        ? item.tweetText
        : (!isGenericText(old.tweetText) ? old.tweetText : (item.tweetText || old.tweetText || ''));

      const mergedTweetId = (old.tweetId && !old.tweetId.startsWith('vid_'))
        ? old.tweetId
        : (item.tweetId || old.tweetId);

      // Merge variants
      const variantsMap = new Map();
      for (const v of (old.variants || [])) {
        if (v.url) variantsMap.set(v.url.split('?')[0], v);
      }
      for (const v of (item.variants || [])) {
        if (v.url) variantsMap.set(v.url.split('?')[0], v);
      }

      results[existingIndex] = {
        ...old,
        ...item,
        tweetId: mergedTweetId,
        authorName: finalAuthorName,
        authorHandle: finalAuthorHandle,
        tweetText: mergedTweetText,
        poster: old.poster || item.poster,
        durationMs: old.durationMs || item.durationMs,
        platform: item.platform || old.platform || 'X',
        variants: parseVideoVariants(Array.from(variantsMap.values())),
        timestamp: Math.max(old.timestamp || 0, item.timestamp || 0)
      };
    } else {
      results.push({
        ...item,
        authorName: itemAuth.authorName,
        authorHandle: itemAuth.authorHandle,
        platform: item.platform || 'X',
        variants: parseVideoVariants(item.variants || []),
        timestamp: item.timestamp || Date.now()
      });
    }
  }

  // Sort by newest timestamp first
  return results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Safely escapes HTML special characters to prevent cross-site scripting (XSS).
 * @param {string} str - Raw string
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates and sanitizes a URL to ensure safe protocols (http, https, data, blob).
 * Rejects javascript: or unsafe schemes.
 * @param {string} url - Candidate URL string
 * @returns {string} Sanitized URL or empty string if invalid
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^(https?:|data:image\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

const utilsExport = {
  extractPostId,
  extractTweetId,
  formatBitrate,
  getResolutionParts,
  formatVariantLabel,
  parseVideoVariants,
  normalizeAuthorInfo,
  createVideoFilename,
  formatDuration,
  mergeAndDeduplicateVideos,
  isGenericAuthor,
  escapeHtml,
  sanitizeUrl
};

// Export for environments that use module or global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = utilsExport;
} else if (typeof globalThis !== 'undefined') {
  globalThis.TwitVidUtils = utilsExport;
  globalThis.MediaCollectUtils = utilsExport;
}
