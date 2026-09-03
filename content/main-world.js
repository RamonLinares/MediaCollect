/**
 * Main World Network Interceptor for Twitter / X & Threads
 * Runs in the page's execution context to intercept GraphQL and API requests
 * containing video_info / video_versions safely and efficiently.
 */
(function () {
  'use strict';

  if (window.__TWITVID_INTERCEPTOR_ACTIVE__) return;
  window.__TWITVID_INTERCEPTOR_ACTIVE__ = true;

  const interceptedVideos = new Map();

  function formatBitrate(bitrate) {
    if (!bitrate || bitrate <= 0) return '';
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    }
    return `${Math.round(bitrate / 1000)} Kbps`;
  }

  function getResolutionParts(width, height, bitrate, url) {
    let w = width || 0;
    let h = height || 0;
    if (url && (!w || !h)) {
      const m = url.match(/\/vid\/(?:avc1\/)?(\d+)x(\d+)\//i) || url.match(/(\d+)x(\d+)/i);
      if (m) {
        w = parseInt(m[1], 10);
        h = parseInt(m[2], 10);
      }
    }

    const minDim = Math.min(w, h) || 0;
    const maxDim = Math.max(w, h) || 0;

    if (minDim >= 1080 || maxDim >= 1920) return { resTitle: '1080p', subTitle: 'Full HD' };
    if (minDim >= 720 || maxDim >= 1280) return { resTitle: '720p', subTitle: 'HD' };
    if (minDim >= 480 || maxDim >= 854) return { resTitle: '480p', subTitle: 'SD' };
    if (minDim >= 360 || maxDim >= 640) return { resTitle: '360p', subTitle: 'SD' };
    if (minDim >= 240 || maxDim >= 320) return { resTitle: '240p', subTitle: 'Low' };
    if (minDim > 0) return { resTitle: `${minDim}p`, subTitle: 'MP4' };

    if (bitrate) {
      const kbps = Math.round(bitrate / 1000);
      if (kbps >= 2000) return { resTitle: '1080p', subTitle: 'HD' };
      if (kbps >= 1000) return { resTitle: '720p', subTitle: 'HD' };
      if (kbps >= 500) return { resTitle: '480p', subTitle: 'SD' };
      return { resTitle: `${kbps}k`, subTitle: 'SD' };
    }

    return { resTitle: 'MP4', subTitle: 'Video' };
  }

  /**
   * Extracts clean MP4 video variants from a video_info or video_versions array
   */
  function extractMp4Variants(variants) {
    if (!Array.isArray(variants)) return [];

    const mp4s = variants
      .filter(v => v && (v.content_type === 'video/mp4' || (v.url && !v.url.includes('.m3u8'))))
      .map(v => {
        let width = v.width || 0;
        let height = v.height || 0;
        if (v.url) {
          const m = v.url.match(/\/vid\/(?:avc1\/)?(\d+)x(\d+)\//i) || v.url.match(/(\d+)x(\d+)/i);
          if (m) {
            width = width || parseInt(m[1], 10);
            height = height || parseInt(m[2], 10);
          }
        }

        const bitrate = v.bitrate || 0;
        const rateLabel = formatBitrate(bitrate);
        const { resTitle, subTitle } = getResolutionParts(width, height, bitrate, v.url);
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

    // Deduplicate by clean URL
    const seen = new Set();
    const unique = [];
    for (const item of mp4s) {
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
   * Finds user details in any user object or tweet/threads object
   */
  function extractUserInfo(obj) {
    let name = '';
    let screen_name = '';

    const candidates = [
      obj.core?.user_results?.result?.legacy,
      obj.core?.user_results?.result,
      obj.user_results?.result?.legacy,
      obj.user_results?.result,
      obj.user?.legacy,
      obj.user,
      obj.author?.legacy,
      obj.author
    ];

    for (const cand of candidates) {
      if (cand && typeof cand === 'object') {
        if (!name && (cand.name || cand.full_name)) name = cand.name || cand.full_name;
        if (!screen_name && (cand.screen_name || cand.username)) screen_name = cand.screen_name || cand.username;
        if (name && screen_name) break;
      }
    }

    return { name, screen_name };
  }

  /**
   * Processes a Tweet object from Twitter GraphQL / API
   */
  function extractFromTweetObject(tweetObj, foundRecords = []) {
    if (!tweetObj || typeof tweetObj !== 'object') return;

    let tweet = tweetObj;
    if (tweetObj.__typename === 'TweetWithVisibilityResults' && tweetObj.tweet) {
      tweet = tweetObj.tweet;
    } else if (tweetObj.tweet && typeof tweetObj.tweet === 'object') {
      tweet = tweetObj.tweet;
    } else if (tweetObj.tweet_results?.result) {
      tweet = tweetObj.tweet_results.result.tweet || tweetObj.tweet_results.result;
    }

    const tweetId = tweet.rest_id || tweet.id_str || tweet.id;
    const legacy = tweet.legacy || tweet;

    const { name: authorName, screen_name: authorHandle } = extractUserInfo(tweet);

    const tweetText = tweet.note_tweet?.note_tweet_results?.result?.text ||
                      legacy.full_text ||
                      tweet.full_text ||
                      legacy.text ||
                      tweet.text ||
                      '';

    const mediaList = legacy.extended_entities?.media ||
                      tweet.extended_entities?.media ||
                      legacy.entities?.media ||
                      tweet.entities?.media ||
                      [];

    for (const media of mediaList) {
      if (media.video_info && Array.isArray(media.video_info.variants)) {
        const variants = extractMp4Variants(media.video_info.variants);
        if (variants.length > 0) {
          const finalTweetId = tweetId || (media.expanded_url?.match(/status\/(\d+)/)?.[1]) || media.id_str;
          const poster = media.media_url_https || media.media_url || '';
          const durationMs = media.video_info.duration_millis || 0;

          const record = {
            tweetId: finalTweetId,
            mediaId: media.id_str,
            authorName: authorName || (authorHandle ? authorHandle : 'X Post'),
            authorHandle: authorHandle || '',
            tweetText,
            poster,
            durationMs,
            platform: 'X',
            variants,
            timestamp: Date.now()
          };

          if (finalTweetId) interceptedVideos.set(finalTweetId, record);
          if (media.id_str) interceptedVideos.set(media.id_str, record);
          foundRecords.push(record);
        }
      }
    }
  }

  /**
   * Processes a Threads Post object from Threads GraphQL / API
   */
  function extractFromThreadsPost(postObj, foundRecords = []) {
    if (!postObj || typeof postObj !== 'object') return;

    const post = postObj.post || postObj;
    const code = post.code || post.id || post.pk;
    if (!code) return;

    const { name: authorName, screen_name: authorHandle } = extractUserInfo(post);
    const captionText = post.caption?.text || post.text || '';
    const durationMs = (post.video_duration || 0) * 1000;

    let poster = '';
    if (post.image_versions2?.candidates?.length > 0) {
      poster = post.image_versions2.candidates[0].url;
    }

    // Direct video_versions
    let variants = [];
    if (Array.isArray(post.video_versions) && post.video_versions.length > 0) {
      variants = extractMp4Variants(post.video_versions);
    }

    // Carousel media
    if (Array.isArray(post.carousel_media)) {
      for (const item of post.carousel_media) {
        if (Array.isArray(item.video_versions) && item.video_versions.length > 0) {
          const subVariants = extractMp4Variants(item.video_versions);
          if (subVariants.length > 0 && variants.length === 0) {
            variants = subVariants;
            if (!poster && item.image_versions2?.candidates?.length > 0) {
              poster = item.image_versions2.candidates[0].url;
            }
          }
        }
      }
    }

    if (variants.length > 0) {
      const record = {
        tweetId: String(code),
        mediaId: String(code),
        authorName: authorName || (authorHandle ? authorHandle : 'Threads Post'),
        authorHandle: authorHandle || '',
        tweetText: captionText,
        poster,
        durationMs,
        platform: 'Threads',
        variants,
        timestamp: Date.now()
      };

      interceptedVideos.set(String(code), record);
      foundRecords.push(record);
    }
  }

  /**
   * Recursively traverses JSON objects with cyclical guard up to depth 35
   */
  function traverseJson(obj, foundRecords = [], visited = new WeakSet(), depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 35) return foundRecords;
    if (visited.has(obj)) return foundRecords;
    visited.add(obj);

    // Twitter / X tweet objects
    if (obj.rest_id && (obj.core || obj.legacy || obj.__typename === 'Tweet' || obj.__typename === 'TweetWithVisibilityResults')) {
      extractFromTweetObject(obj, foundRecords);
    } else if (obj.legacy && (obj.legacy.extended_entities || obj.legacy.full_text)) {
      extractFromTweetObject(obj, foundRecords);
    } else if (obj.video_info && Array.isArray(obj.video_info.variants)) {
      const variants = extractMp4Variants(obj.video_info.variants);
      if (variants.length > 0) {
        const tweetId = obj.id_str || obj.source_status_id_str || (obj.expanded_url?.match(/status\/(\d+)/)?.[1]);
        const record = {
          tweetId: tweetId || `vid_${Date.now()}`,
          mediaId: obj.id_str,
          authorName: 'X Post',
          authorHandle: '',
          tweetText: '',
          poster: obj.media_url_https || obj.media_url || '',
          durationMs: obj.video_info.duration_millis || 0,
          platform: 'X',
          variants,
          timestamp: Date.now()
        };
        if (tweetId) interceptedVideos.set(tweetId, record);
        if (obj.id_str) interceptedVideos.set(obj.id_str, record);
        foundRecords.push(record);
      }
    }

    // Threads post objects
    if (obj.video_versions && Array.isArray(obj.video_versions) && (obj.code || obj.pk || obj.user)) {
      extractFromThreadsPost(obj, foundRecords);
    } else if (obj.post && typeof obj.post === 'object' && (obj.post.video_versions || obj.post.code)) {
      extractFromThreadsPost(obj.post, foundRecords);
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        traverseJson(obj[i], foundRecords, visited, depth + 1);
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'prototype') continue;
        traverseJson(obj[key], foundRecords, visited, depth + 1);
      }
    }

    return foundRecords;
  }

  /**
   * Dispatches discovered videos to isolated content script
   */
  function dispatchDiscoveredVideos(records) {
    if (!records || records.length === 0) return;
    window.dispatchEvent(new CustomEvent('__TWITVID_VIDEOS_DISCOVERED__', {
      detail: records
    }));
  }

  /**
   * Process a text response from X/Twitter or Threads API
   */
  function inspectApiResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') return;
    if (!responseText.includes('video_info') && !responseText.includes('video_versions') && !responseText.includes('.mp4')) return;

    try {
      const data = JSON.parse(responseText);
      const foundRecords = [];
      traverseJson(data, foundRecords, new WeakSet(), 0);
      if (foundRecords.length > 0) {
        dispatchDiscoveredVideos(foundRecords);
      }
    } catch (_) {}
  }

  // --- Monkey-patch window.fetch ---
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      if (
        url.includes('/graphql') ||
        url.includes('/i/api/') ||
        url.includes('/api/v1/') ||
        url.includes('/api/graphql') ||
        url.includes('twitter.com') ||
        url.includes('x.com') ||
        url.includes('threads.net') ||
        url.includes('threads.com')
      ) {
        const clone = response.clone();
        clone.text().then(text => {
          inspectApiResponse(text);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  // --- Monkey-patch XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__twitvid_url = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = this.__twitvid_url || '';
        if (
          url.includes('/graphql') ||
          url.includes('/i/api/') ||
          url.includes('/api/v1/') ||
          url.includes('/api/graphql') ||
          url.includes('twitter.com') ||
          url.includes('x.com') ||
          url.includes('threads.net') ||
          url.includes('threads.com')
        ) {
          inspectApiResponse(this.responseText);
        }
      } catch (_) {}
    });
    return originalSend.apply(this, args);
  };

  // Listen for request for all cached videos
  window.addEventListener('__TWITVID_REQUEST_ALL_VIDEOS__', () => {
    const list = Array.from(interceptedVideos.values());
    if (list.length > 0) {
      dispatchDiscoveredVideos(list);
    }
  });

})();
