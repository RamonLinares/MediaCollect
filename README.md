# MediaCollect - Video Downloader & Full Screenshot Suite

A fast, lightweight, and modern Google Chrome extension (Manifest V3) combining **HD Social Video Downloading** (X / Twitter & Threads) with a **Full-Featured Screenshot Engine** for all websites.

---

## Features

### 🎬 HD Video Downloader (X & Threads)
- **Dual-Platform Support**: Works on `x.com`, `twitter.com`, `threads.net`, and `threads.com`.
- **In-Post Download Buttons**: Injects native download buttons directly into post action bars.
- **Multiple Resolutions**: Download in **1080p (Full HD)**, **720p (HD)**, **480p (SD)**, **360p**, or **240p** MP4 format.
- **Feed Scanner**: Browse and preview detected videos in a 5-column resolution grid with bitrate indicators.

### 📸 Web Screenshot Capture Suite (Any Website)
- **Capture Selection**: Drag-and-drop custom rectangle crop with real-time dimensions.
- **Capture DOM Element**: Hover inspector with glowing highlight to capture any HTML element.
- **Capture Visible Part**: Instant high-resolution snapshot of your current screen viewport.
- **Capture Entire Page**: Automated smooth scrolling and canvas stitching for full web pages.
- **Interactive Screenshot Studio & Editor**:
  - **🔍 Zoom & Pan**: Zoom in/out, fit to screen, mouse wheel / trackpad pinch zoom, and pan across large captures.
  - **✂️ Crop Tool**: Interactive resizable crop box with 8 handles and instant apply.
  - **✏️ Annotations**:
    - **Arrow (↗️)**: Crisp directional arrows with arrowheads for UI callouts.
    - **Box / Rectangle (⬜)**: Frame buttons, text, or sections.
    - **Pen (✏️)**: Freehand drawing with smooth curves.
    - **Highlighter (🖍️)**: Semi-transparent neon marker for text/images.
    - **Text (🔤)**: Inline text typing with contrast pill backgrounds.
  - **🎨 Custom Styling**: 6 preset color swatches and line thicknesses.
  - **↩️ Undo**: Instant undo stack (<kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd>).
  - **⤢ Open in Tab**: Pop out captures into dedicated browser tabs to keep multiple screenshots open simultaneously.
  - **📋 Copy & Paste**: 1-click flattened PNG clipboard copy, and direct clipboard paste (<kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd>) into the studio.
  - **💾 Save Image**: Direct high-res download to disk.

---

## How to Install in Google Chrome

1. **Open Extensions Page**:
   - Navigate to `chrome://extensions/` in Chrome.
2. **Enable Developer Mode**:
   - Toggle **Developer mode** to **ON** in the top right.
3. **Load Unpacked Extension**:
   - Click **Load unpacked** and select this directory (`/Users/ramonlinarespallares/Documents/TwitVidDown`).
4. **Pin Extension**:
   - Click the puzzle piece icon (`🧩`) and pin **MediaCollect**.

---

## Technical Architecture (Manifest V3)

```
MediaCollect/
├── manifest.json                  # Manifest V3 configuration & permissions
├── background/
│   └── service-worker.js          # Downloads, tab management & capture dispatch
├── content/
│   ├── main-world.js              # Network & GraphQL stream interceptor
│   ├── content.js                 # In-post download button injection & video detector
│   └── content.css                # Neumorphic styling for download buttons & popovers
├── screenshot/
│   ├── screenshot-content.js      # Selection, Element Picker, Full Page Stitcher & Modal
│   ├── screenshot.css             # Neumorphic Bone White styling for editor & overlays
│   ├── studio.html                # Standalone full-browser tab Studio editor
│   └── studio.js                  # Multi-tab canvas editor & clipboard paste engine
├── popup/
│   ├── popup.html                 # Dual-mode dashboard (Videos & Screenshots)
│   ├── popup.css                  # Tactile Neumorphic Bone White design system
│   └── popup.js                   # Popup controller & state management
├── shared/
│   └── utils.js                   # Formatters, URL parsers, and filename sanitizers
├── CHROMEWEBSTORE.md              # Chrome Web Store metadata & documentation
└── README.md                      # Project documentation
```

---

## License
MIT License. Created for personal and educational use.
