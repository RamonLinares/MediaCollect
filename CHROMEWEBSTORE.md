# Chrome Web Store Listing — MediaCollect

> Last Updated: 2026-09-03
> Target Version: 1.2.0

---

## Store Listing Metadata

**Extension Name** [REQUIRED - Max 45 characters]
`MediaCollect - Video & Screenshot Suite`

**Short Description** [REQUIRED - Max 132 characters]
`Download HD videos from X & Threads, capture custom selections, elements, and full-page screenshots with an interactive editor.`

**Detailed Description** [REQUIRED]
```markdown
MediaCollect is a fast, lightweight, and privacy-focused Chrome Extension combining high-definition social video downloading with a full-featured web screenshot engine — designed in an authentic, tactile Neumorphic (Soft UI) interface.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 HD SOCIAL VIDEO DOWNLOADER (X & Threads)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Multi-Resolution Downloads: Download in Full HD (1080p), HD (720p), SD (480p, 360p, 240p) or direct MP4 audio/video streams.
• Native In-Post Action Buttons: Adds seamless download buttons directly to post action bars on X (Twitter) and Threads.
• Tactile Quality Popover: Click the download button on any post to open a soft Neumorphic quality menu with bitrate tags and HD indicators.
• Toolbar Feed Scanner: Browse, search, and preview detected page videos in an organized dashboard with instant download tiles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 FULL WEB SCREENSHOT SUITE (Any Website)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Capture Selection: Click and drag a custom rectangle to crop and capture any portion of any website.
• Capture DOM Element: Hover over any HTML element with a glowing inspector outline and click to capture.
• Capture Visible Part: 1-click instant high-resolution snapshot of your current screen viewport.
• Capture Entire Page: Automated smooth scrolling and canvas stitching to capture full-length articles and long feeds.
• Interactive Screenshot Studio & Editor:
  - ✏️ Annotation Tools: Draw freehand with smooth curves, crisp callout arrows, bounding boxes, neon highlighters, and inline text.
  - ✂️ Interactive Cropper: 8-handle resizable crop box with instant apply.
  - 🔍 Smooth Zoom & Pan: Fit to screen, mouse wheel zoom, trackpad pinch, and panning across large captures.
  - 🎨 Palette & Stroke Control: Preset color swatches and stroke thickness selector.
  - ↩️ Instant Undo: Revert strokes with ⌘Z / Ctrl+Z.
  - ⤢ Dedicated Multi-Tab Mode: Pop out any capture into its own browser tab so you can keep multiple screenshot editors open simultaneously.
  - 📋 Direct Clipboard Paste: Press ⌘V / Ctrl+V anywhere in a Studio tab to paste and edit images directly.
  - 💾 1-Click Copy & Save: Flattened PNG clipboard copy for instant pasting into Slack, Discord, Figma, or direct file save to disk.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 100% PRIVATE & CLIENT-SIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Zero Tracking: No analytics, no telemetry, no cookies, no user tracking.
• Zero Cloud Processing: All video parsing, canvas annotations, and screenshot rendering occur 100% locally on your machine.
• No Accounts or Subscriptions: Completely free, no registration required.
```

**Category** [REQUIRED]
Productivity / Social & Communication

**Single Purpose** [REQUIRED]
Downloads user-selected video streams from X and Threads and captures customizable web screenshots (selection, element, visible, full page) to local disk or clipboard.

**Primary Language** [REQUIRED]
English

---

## Permissions Justification

| Permission | Type | Plain-English Justification for Review Team |
|------------|------|---------------------------------------------|
| `downloads` | permissions | Required to initiate browser downloads of user-requested video files (MP4) and screenshot images (PNG) directly to the user's Downloads directory. |
| `storage` | permissions | Required to temporarily store video catalog information for the active tab in `chrome.storage.session` and maintain user capture buffers across extension views. |
| `unlimitedStorage` | permissions | Required to store multiple high-resolution screenshot buffers locally in `chrome.storage.local` without hitting the default 5MB quota when users open multiple dedicated studio tabs. |
| `tabs` | permissions | Required to inspect the current tab URL to detect platform status (X vs Threads) and capture the active tab's viewport using `chrome.tabs.captureVisibleTab`. |
| `activeTab` | permissions | Required to perform user-initiated area selection, element inspection, and scrolling full-page captures on the user's current webpage upon interaction. |
| `scripting` | permissions | Required to inject the interactive screenshot selection engine, element highlight overlay, and scrolling capture stitcher onto the current page when triggered by the user. |
| `https://x.com/*` | host_permissions | Required to detect video players and render download action buttons on X.com. |
| `https://*.x.com/*` | host_permissions | Required to support subdomains of X.com for media stream detection. |
| `https://twitter.com/*` | host_permissions | Required to support Twitter.com links and legacy posts. |
| `https://*.twitter.com/*` | host_permissions | Required to support Twitter subdomains. |
| `https://threads.net/*` | host_permissions | Required to detect video media and inject download buttons on the Threads web app. |
| `https://*.threads.net/*` | host_permissions | Required to support Threads subdomains. |
| `https://threads.com/*` | host_permissions | Required to support Threads domain redirects and web views. |
| `https://*.threads.com/*` | host_permissions | Required to support Threads subdomains. |
| `https://video.twimg.com/*` | host_permissions | Required to access and download video media files hosted on Twitter's official media CDN. |
| `https://cdn.syndication.twimg.com/*` | host_permissions | Required to query official syndication fallback metadata for tweets containing videos. |
| `https://*.cdninstagram.com/*` | host_permissions | Required to download video files hosted on Meta / Instagram's official CDN for Threads videos. |
| `https://*.fbcdn.net/*` | host_permissions | Required to download video streams hosted on Meta's official media CDN for Threads. |

---

## Privacy Policy & Data Disclosure Form

### Data Use Declarations (Chrome Developer Dashboard)

1. **Do you collect or transmit any user data?**
   - **NO**. MediaCollect does NOT collect, transmit, store externally, or sell any personal data, authentication credentials, browsing history, or user communications.
2. **What data is processed locally?**
   - Video media URLs and tweet metadata are detected from the DOM or network responses on the active tab solely to present download options to the user.
   - Screen pixel data is captured solely upon explicit user command and rendered in local HTML5 Canvas memory.
3. **Is any data transferred to external servers?**
   - **NO**. All network requests made by the extension are direct media downloads to the user's local disk via `chrome.downloads`. No telemetry or analytics servers exist.

### Privacy Policy Text (For Hosting)

```markdown
# Privacy Policy for MediaCollect

Effective Date: September 3, 2026

MediaCollect ("the Extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user data.

1. Information We Do Not Collect:
   MediaCollect does NOT collect, store, transmit, or share any personal information, browsing history, account credentials, cookies, or user telemetry.

2. Local Operations:
   All operations—including video detection, stream resolution, screenshot capture, image cropping, and annotations—are performed 100% locally on your device within the browser sandbox.

3. Media Downloads:
   When you choose to download a video or screenshot, files are transferred directly between the host CDN (e.g., Twitter/Meta servers) and your computer's local Downloads folder. No intermediate servers or third parties receive your data.

4. Changes to This Policy:
   Any updates to this policy will be posted on this page with an updated effective date.

5. Contact:
   For questions regarding this policy, please open an issue on our GitHub repository: https://github.com/RamonLinares/MediaCollect
```

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-08-15 | Initial release with in-tweet buttons, quality selector, and page video popup scanner. | Released |
| 1.1.0 | 2026-08-18 | Added full support for Threads (`threads.net` & `threads.com`) video detection and downloads. | Released |
| 1.2.0 | 2026-09-03 | • Renamed extension to MediaCollect.<br>• Redesigned entire UI to tactile Neumorphic (Soft UI) Bone White design system.<br>• Full Web Screenshot Suite (Selection, DOM Element, Visible Part, Entire Page).<br>• Standalone Multi-Tab Screenshot Studio (`studio.html`) with direct clipboard paste (`⌘V`).<br>• Canvas2D `willReadFrequently` readback performance optimization.<br>• Security audit: DOM XSS sanitization and protocol guards. | Ready for Submission |
