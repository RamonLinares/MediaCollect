# Chrome Web Store Listing — MediaCollect

> Last Updated: 2026-09-03

## Store Listing

**Extension Name** [REQUIRED]
MediaCollect - Video Downloader & Full Screenshot Suite

**Short Description** [REQUIRED]
Download HD videos from X & Threads, plus capture custom selection, DOM elements, visible part, or entire full-page screenshots.

**Detailed Description** [REQUIRED]
MediaCollect is a fast, lightweight, and privacy-focused Chrome Extension combining high-definition social video downloading with a full-featured web screenshot engine.

Key Features:

🎬 HD Social Video Downloader:
- Multiple Resolutions: Download in Full HD (1080p), HD (720p), SD (480p, 360p, 240p), or audio/video MP4 streams.
- In-Post Action Buttons: Seamlessly adds native-styled download buttons to posts on X (Twitter) and Threads.
- Toolbar Feed Scanner: Browse and preview all page videos in an organized dashboard with quality tiles and bitrate indicators.

📸 Full Web Screenshot Suite:
- Capture Selection: Click and drag a custom rectangle to crop and capture any portion of any website.
- Capture DOM Element: Hover over any HTML element with a glowing inspector outline and click to capture.
- Capture Visible Part: 1-click instant screenshot of your current screen viewport.
- Capture Entire Page: Automated smooth scrolling and canvas stitching to capture the full length of long pages.
- Interactive Preview Modal: Preview your captures with dimensions, 1-click **Copy to Clipboard** as PNG, or **Save / Download**.

100% Client-Side & Private:
- No external tracking, no backend servers, no logins required. Your media and screenshots remain entirely in your browser.

**Category** [REQUIRED]
Productivity / Social & Communication

**Single Purpose** [REQUIRED]
Downloads videos from X and Threads and captures customizable web screenshots (selection, element, visible, full page) to disk or clipboard.

**Primary Language** [REQUIRED]
English

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `downloads` | permissions | Required to initiate browser downloads of selected video MP4 streams and PNG screenshots directly to the user's Downloads folder. |
| `storage` | permissions | Used with `chrome.storage.session` to temporarily cache detected video streams for the active tab without storing persistent personal data. |
| `tabs` | permissions | Required to inspect active tab URL to determine active platform status and capture visible viewport data for screenshots. |
| `activeTab` | permissions | Used to capture tabs and execute screenshot crop overlays on the user's current active tab upon click. |
| `scripting` | permissions | Required to inject the interactive selection overlay, element picker, and scrolling screenshot tools on the active webpage. |
| `https://x.com/*` | host_permissions | Required to detect video players and render download buttons on X.com. |
| `https://*.x.com/*` | host_permissions | Required to access subdomains of X.com for media detection. |
| `https://twitter.com/*` | host_permissions | Required to support Twitter.com domains and legacy links. |
| `https://*.twitter.com/*` | host_permissions | Required to support Twitter subdomains. |
| `https://threads.net/*` | host_permissions | Required to inject content scripts and detect video media on Threads web app. |
| `https://*.threads.net/*` | host_permissions | Required to support Threads subdomains. |
| `https://threads.com/*` | host_permissions | Required to support Threads domain redirects and web views. |
| `https://*.threads.com/*` | host_permissions | Required to support Threads subdomains. |
| `https://video.twimg.com/*` | host_permissions | Required to access and download video media files hosted on Twitter's official media CDN. |
| `https://cdn.syndication.twimg.com/*` | host_permissions | Required to query official syndication fallback metadata for tweets with videos. |
| `https://*.cdninstagram.com/*` | host_permissions | Required to download video files hosted on Meta / Instagram's official CDN for Threads videos. |
| `https://*.fbcdn.net/*` | host_permissions | Required to download video streams hosted on Meta's official media CDN for Threads. |

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-08-15 | Initial release with in-tweet buttons, quality selector, and page video popup scanner. | Released |
| 1.1.0 | 2026-08-18 | Added full support for Threads (threads.net & threads.com) video detection and downloads. | Released |
| 1.2.0 | 2026-09-03 | Added full Screenshot Capture Suite (Selection, DOM Element, Visible Part, Entire Page, Clipboard & Download). | Ready for packaging |
