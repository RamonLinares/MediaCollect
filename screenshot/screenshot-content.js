/**
 * Screenshot Capture & Studio Editor Engine
 * Supports Area Selection, DOM Element Picker, Viewport, Full Page Stitching,
 * Zoom & Pan, Interactive Cropping, and Annotations (Pen, Arrow, Rectangle, Text, Highlighter).
 */

(function () {
  'use strict';

  if (window.__TWITVID_SCREENSHOT_INJECTED__) return;
  window.__TWITVID_SCREENSHOT_INJECTED__ = true;

  let activeOverlay = null;

  /**
   * Helper: Removes any active overlay or modal
   */
  function removeActiveOverlay() {
    if (activeOverlay && activeOverlay.parentElement) {
      activeOverlay.remove();
    }
    activeOverlay = null;
  }

  /**
   * Helper: Guarantees that the browser engine has flushed style recalculations
   * and repainted the compositor frame buffer before capturing.
   */
  function waitForRepaint(ms = 60) {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, ms);
        });
      });
    });
  }

  /**
   * Helper: Loads an image from data URL into an HTMLImageElement
   */
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /**
   * Shows a floating success toast
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'twitvid-toast-banner';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  /**
   * Helper: Draws an arrow on canvas from (x1, y1) to (x2, y2)
   */
  function drawArrowOnCanvas(ctx, x1, y1, x2, y2, color, width) {
    const headLength = Math.max(16, width * 3.5);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Shows the Interactive Screenshot Studio & Editor Modal
   */
  async function showScreenshotPreviewModal(initialDataUrl, initWidth, initHeight) {
    removeActiveOverlay();

    const root = document.createElement('div');
    root.id = 'twitvid-screenshot-root';

    const backdrop = document.createElement('div');
    backdrop.className = 'twitvid-modal-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'twitvid-preview-dialog';

    dialog.innerHTML = `
      <!-- Header -->
      <div class="twitvid-dialog-header">
        <div class="twitvid-dialog-title">
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #1d9bf0;">
            <path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
          </svg>
          <span>Screenshot Studio</span>
          <span class="twitvid-meta-pill" id="twitvid-studio-dim-pill">${initWidth} × ${initHeight} px</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="twitvid-btn twitvid-btn-ghost twitvid-btn-open-tab" title="Open in dedicated browser tab (keep multiple tabs open)">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
            <span>Open in Tab</span>
          </button>
          <button type="button" class="twitvid-btn twitvid-btn-ghost twitvid-btn-close" style="padding: 4px 10px; font-size: 14px;" title="Close Modal">✕</button>
        </div>
      </div>

      <!-- Studio Editor Toolbar -->
      <div class="twitvid-studio-toolbar">
        <!-- Tool Selection Group -->
        <div class="twitvid-toolbar-section">
          <button type="button" class="twitvid-tool-btn" data-tool="pan" title="Pan / Navigate image">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
            </svg>
            <span>Pan</span>
          </button>

          <button type="button" class="twitvid-tool-btn" data-tool="crop" title="Crop Image">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/>
            </svg>
            <span>Crop</span>
          </button>

          <div class="twitvid-toolbar-sep"></div>

          <button type="button" class="twitvid-tool-btn active" data-tool="pen" title="Draw Freehand">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            <span>Pen</span>
          </button>

          <button type="button" class="twitvid-tool-btn" data-tool="arrow" title="Draw Arrow">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
            <span>Arrow</span>
          </button>

          <button type="button" class="twitvid-tool-btn" data-tool="rect" title="Draw Box / Rectangle">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/>
            </svg>
            <span>Box</span>
          </button>

          <button type="button" class="twitvid-tool-btn" data-tool="highlighter" title="Highlight Text / Section">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M15.24 3.76a2.5 2.5 0 0 0-3.54 0L3 12.46V19h6.54l8.7-8.7a2.5 2.5 0 0 0 0-3.54l-3-3zm-2.12 1.41a.5.5 0 0 1 .71 0l3 3a.5.5 0 0 1 0 .71l-1.29 1.3-3.71-3.71 1.29-1.3zM5 17v-3.13l7.04-7.04 3.13 3.13L8.13 17H5z"/>
            </svg>
            <span>Highlighter</span>
          </button>

          <button type="button" class="twitvid-tool-btn" data-tool="text" title="Add Text Annotation">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M5 4v3h5.5v12h3V7H19V4z"/>
            </svg>
            <span>Text</span>
          </button>
        </div>

        <!-- Color & Stroke Selector -->
        <div class="twitvid-toolbar-section">
          <div class="twitvid-color-swatches">
            <div class="twitvid-color-dot active" data-color="#f4212e" style="background: #f4212e;" title="Red"></div>
            <div class="twitvid-color-dot" data-color="#1d9bf0" style="background: #1d9bf0;" title="Blue"></div>
            <div class="twitvid-color-dot" data-color="#00ba7c" style="background: #00ba7c;" title="Green"></div>
            <div class="twitvid-color-dot" data-color="#ffd400" style="background: #ffd400;" title="Yellow"></div>
            <div class="twitvid-color-dot" data-color="#ffffff" style="background: #ffffff;" title="White"></div>
            <div class="twitvid-color-dot" data-color="#000000" style="background: #000000; border: 1px solid #444;" title="Black"></div>
          </div>

          <div class="twitvid-toolbar-sep"></div>

          <!-- Stroke Size -->
          <div class="twitvid-stroke-group">
            <button type="button" class="twitvid-stroke-btn" data-stroke="3">Thin</button>
            <button type="button" class="twitvid-stroke-btn active" data-stroke="6">Med</button>
            <button type="button" class="twitvid-stroke-btn" data-stroke="12">Thick</button>
          </div>

          <div class="twitvid-toolbar-sep"></div>

          <!-- Zoom Controls -->
          <div class="twitvid-zoom-group">
            <button type="button" class="twitvid-zoom-btn" id="btn-zoom-out" title="Zoom Out">-</button>
            <span class="twitvid-zoom-text" id="zoom-level-text" title="Click to Fit Screen">100%</span>
            <button type="button" class="twitvid-zoom-btn" id="btn-zoom-in" title="Zoom In">+</button>
          </div>

          <div class="twitvid-toolbar-sep"></div>

          <!-- Undo Button -->
          <button type="button" class="twitvid-tool-btn" id="btn-undo" title="Undo Last Stroke (⌘Z)">
            <svg viewBox="0 0 24 24" class="twitvid-tool-icon">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
            <span>Undo</span>
          </button>
        </div>
      </div>

      <!-- Studio Canvas Body -->
      <div class="twitvid-dialog-body" id="twitvid-canvas-body">
        <div class="twitvid-canvas-wrapper" id="twitvid-canvas-wrap">
          <canvas class="twitvid-main-canvas" id="twitvid-studio-canvas"></canvas>
          <!-- Interactive Crop Overlay Mask -->
          <div class="twitvid-crop-mask" id="twitvid-crop-mask" style="display: none;">
            <div class="twitvid-crop-box" id="twitvid-crop-box">
              <div class="twitvid-crop-handle nw" data-dir="nw"></div>
              <div class="twitvid-crop-handle ne" data-dir="ne"></div>
              <div class="twitvid-crop-handle se" data-dir="se"></div>
              <div class="twitvid-crop-handle sw" data-dir="sw"></div>
              <div class="twitvid-crop-actions-bar">
                <button type="button" class="twitvid-btn twitvid-btn-secondary" id="btn-apply-crop" style="padding: 4px 10px; font-size: 11px;">
                  ✓ Apply Crop
                </button>
                <button type="button" class="twitvid-btn twitvid-btn-ghost" id="btn-cancel-crop" style="padding: 4px 10px; font-size: 11px;">
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Studio Footer -->
      <div class="twitvid-dialog-footer">
        <div style="font-size: 12px; color: #8899a6; display: flex; align-items: center; gap: 14px;">
          <span>💡 <strong>Tip:</strong> Press <kbd class="twitvid-kbd-key">⌘Z</kbd> to Undo • Scroll/pinch to Zoom</span>
        </div>
        <div class="twitvid-btn-group">
          <button type="button" class="twitvid-btn twitvid-btn-ghost twitvid-btn-open-tab" title="Open in dedicated browser tab">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
            <span>Open in Tab</span>
          </button>
          <button type="button" class="twitvid-btn twitvid-btn-secondary twitvid-btn-copy">
            <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <span>Copy to Clipboard</span>
          </button>
          <button type="button" class="twitvid-btn twitvid-btn-primary twitvid-btn-save">
            <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
            </svg>
            <span>Save Image</span>
          </button>
        </div>
      </div>
    `;

    backdrop.appendChild(dialog);
    root.appendChild(backdrop);
    document.body.appendChild(root);
    activeOverlay = root;

    // Load Image into Canvas with willReadFrequently optimization for fast getImageData readbacks
    const canvas = dialog.querySelector('#twitvid-studio-canvas');
    const canvasWrap = dialog.querySelector('#twitvid-canvas-wrap');
    const canvasBody = dialog.querySelector('#twitvid-canvas-body');
    const dimPill = dialog.querySelector('#twitvid-studio-dim-pill');
    const zoomText = dialog.querySelector('#zoom-level-text');

    const baseImg = await loadImage(initialDataUrl);
    canvas.width = baseImg.naturalWidth || initWidth;
    canvas.height = baseImg.naturalHeight || initHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(baseImg, 0, 0);

    // Undo Stack
    const undoStack = [];
    function saveState() {
      if (undoStack.length >= 25) undoStack.shift();
      undoStack.push({
        width: canvas.width,
        height: canvas.height,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height)
      });
    }
    saveState(); // Save initial baseline

    function undo() {
      if (undoStack.length <= 1) {
        showToast('Nothing left to undo');
        return;
      }
      undoStack.pop(); // discard current state
      const prev = undoStack[undoStack.length - 1];
      if (canvas.width !== prev.width || canvas.height !== prev.height) {
        canvas.width = prev.width;
        canvas.height = prev.height;
        dimPill.textContent = `${canvas.width} × ${canvas.height} px`;
      }
      ctx.putImageData(prev.data, 0, 0);
      showToast('Action undone ↩');
    }

    // Studio State
    let activeTool = 'pen';
    let activeColor = '#f4212e';
    let strokeWidth = 6;
    let currentZoom = 1.0;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let tempSnapshot = null;
    let activeStrokePoints = [];

    // Zoom Management
    function applyZoom(scale) {
      currentZoom = Math.max(0.15, Math.min(4.0, scale));
      const displayW = Math.round(canvas.width * currentZoom);
      const displayH = Math.round(canvas.height * currentZoom);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      canvasWrap.style.width = `${displayW}px`;
      canvasWrap.style.height = `${displayH}px`;
      zoomText.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    function fitToScreen() {
      const availW = canvasBody.clientWidth - 48;
      const availH = canvasBody.clientHeight - 48;
      const scaleX = availW / canvas.width;
      const scaleY = availH / canvas.height;
      // If canvas is very tall, fit to width so it's clearly readable from top to bottom
      const fitScale = (canvas.height > canvas.width * 1.8)
        ? Math.min(scaleX, 1.0)
        : Math.min(scaleX, scaleY, 1.0);
      applyZoom(fitScale);
      setTimeout(() => {
        canvasBody.scrollTop = 0;
        canvasBody.scrollLeft = 0;
      }, 10);
    }

    // Initial fit
    setTimeout(fitToScreen, 50);

    dialog.querySelector('#btn-zoom-in').addEventListener('click', () => applyZoom(currentZoom * 1.25));
    dialog.querySelector('#btn-zoom-out').addEventListener('click', () => applyZoom(currentZoom / 1.25));
    zoomText.addEventListener('click', fitToScreen);

    // Trackpad / Wheel Zoom
    canvasBody.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        applyZoom(currentZoom * factor);
      }
    }, { passive: false });

    // Tool Buttons
    const toolBtns = dialog.querySelectorAll('.twitvid-tool-btn[data-tool]');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.dataset.tool;

        if (tool === 'crop') {
          enterCropMode();
        } else {
          exitCropMode();
        }

        activeTool = tool;
        ctx.beginPath();
        activeStrokePoints = [];
        updateCanvasCursor();
      });
    });

    function updateCanvasCursor() {
      if (activeTool === 'pan') {
        canvas.style.cursor = 'grab';
      } else if (activeTool === 'text') {
        canvas.style.cursor = 'text';
      } else if (activeTool === 'crop') {
        canvas.style.cursor = 'default';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }
    updateCanvasCursor();

    // Color Swatches
    const colorDots = dialog.querySelectorAll('.twitvid-color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        activeColor = dot.dataset.color;
      });
    });

    // Stroke Buttons
    const strokeBtns = dialog.querySelectorAll('.twitvid-stroke-btn');
    strokeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        strokeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        strokeWidth = parseInt(btn.dataset.stroke, 10) || 6;
      });
    });

    // Undo Button
    dialog.querySelector('#btn-undo').addEventListener('click', undo);

    // Translate client coordinates to full-res canvas coordinates
    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    // --- CROP TOOL ENGINE ---
    const cropMask = dialog.querySelector('#twitvid-crop-mask');
    const cropBox = dialog.querySelector('#twitvid-crop-box');
    const btnApplyCrop = dialog.querySelector('#btn-apply-crop');
    const btnCancelCrop = dialog.querySelector('#btn-cancel-crop');

    let cropRect = { x: 0, y: 0, width: 0, height: 0 };
    let isCroppingActive = false;

    function enterCropMode() {
      isCroppingActive = true;
      cropMask.style.display = 'block';

      // Default crop box to 85% centered
      const w = Math.round(canvas.width * 0.85);
      const h = Math.round(canvas.height * 0.85);
      const x = Math.round((canvas.width - w) / 2);
      const y = Math.round((canvas.height - h) / 2);
      cropRect = { x, y, width: w, height: h };
      updateCropBoxStyles();
    }

    function exitCropMode() {
      isCroppingActive = false;
      cropMask.style.display = 'none';
      if (activeTool === 'crop') {
        activeTool = 'pen';
        toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === 'pen'));
        updateCanvasCursor();
      }
    }

    function updateCropBoxStyles() {
      const scaleX = canvas.clientWidth / canvas.width;
      const scaleY = canvas.clientHeight / canvas.height;
      cropBox.style.left = `${cropRect.x * scaleX}px`;
      cropBox.style.top = `${cropRect.y * scaleY}px`;
      cropBox.style.width = `${cropRect.width * scaleX}px`;
      cropBox.style.height = `${cropRect.height * scaleY}px`;
    }

    // Crop Drag & Resize
    let isDraggingCrop = false;
    let isResizingCrop = false;
    let resizeHandle = '';
    let dragStartX = 0;
    let dragStartY = 0;
    let cropStartRect = { ...cropRect };

    cropBox.addEventListener('mousedown', (e) => {
      if (e.target.dataset.dir) {
        isResizingCrop = true;
        resizeHandle = e.target.dataset.dir;
      } else if (e.target === cropBox) {
        isDraggingCrop = true;
      } else {
        return;
      }
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      cropStartRect = { ...cropRect };
      e.stopPropagation();
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isCroppingActive) return;
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const dx = (e.clientX - dragStartX) * scaleX;
      const dy = (e.clientY - dragStartY) * scaleY;

      if (isDraggingCrop) {
        cropRect.x = Math.max(0, Math.min(canvas.width - cropRect.width, cropStartRect.x + dx));
        cropRect.y = Math.max(0, Math.min(canvas.height - cropRect.height, cropStartRect.y + dy));
        updateCropBoxStyles();
      } else if (isResizingCrop) {
        let newX = cropStartRect.x;
        let newY = cropStartRect.y;
        let newW = cropStartRect.width;
        let newH = cropStartRect.height;

        if (resizeHandle.includes('e')) newW = Math.max(40, cropStartRect.width + dx);
        if (resizeHandle.includes('s')) newH = Math.max(40, cropStartRect.height + dy);
        if (resizeHandle.includes('w')) {
          const maxDx = cropStartRect.width - 40;
          const clampedDx = Math.min(maxDx, dx);
          newX = cropStartRect.x + clampedDx;
          newW = cropStartRect.width - clampedDx;
        }
        if (resizeHandle.includes('n')) {
          const maxDy = cropStartRect.height - 40;
          const clampedDy = Math.min(maxDy, dy);
          newY = cropStartRect.y + clampedDy;
          newH = cropStartRect.height - clampedDy;
        }

        cropRect = {
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: Math.min(canvas.width - Math.max(0, newX), newW),
          height: Math.min(canvas.height - Math.max(0, newY), newH)
        };
        updateCropBoxStyles();
      }
    });

    window.addEventListener('mouseup', () => {
      isDraggingCrop = false;
      isResizingCrop = false;
    });

    btnApplyCrop.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cropRect.width <= 20 || cropRect.height <= 20) return;

      saveState();
      const croppedData = ctx.getImageData(
        Math.round(cropRect.x),
        Math.round(cropRect.y),
        Math.round(cropRect.width),
        Math.round(cropRect.height)
      );

      canvas.width = Math.round(cropRect.width);
      canvas.height = Math.round(cropRect.height);
      ctx.putImageData(croppedData, 0, 0);

      dimPill.textContent = `${canvas.width} × ${canvas.height} px`;
      exitCropMode();
      fitToScreen();
      showToast('Image cropped! ✂️');
    });

    btnCancelCrop.addEventListener('click', (e) => {
      e.stopPropagation();
      exitCropMode();
    });

    // --- CANVAS DRAWING HANDLERS ---
    canvas.addEventListener('mousedown', (e) => {
      if (isCroppingActive || e.button !== 0) return;

      const coords = getCanvasCoords(e);
      startX = coords.x;
      startY = coords.y;

      if (activeTool === 'pan') {
        canvas.style.cursor = 'grabbing';
        let panStartX = e.clientX;
        let panStartY = e.clientY;
        const initScrollLeft = canvasBody.scrollLeft;
        const initScrollTop = canvasBody.scrollTop;

        const onPanMove = (me) => {
          canvasBody.scrollLeft = initScrollLeft - (me.clientX - panStartX);
          canvasBody.scrollTop = initScrollTop - (me.clientY - panStartY);
        };
        const onPanUp = () => {
          canvas.style.cursor = 'grab';
          window.removeEventListener('mousemove', onPanMove);
          window.removeEventListener('mouseup', onPanUp);
        };
        window.addEventListener('mousemove', onPanMove);
        window.addEventListener('mouseup', onPanUp);
        return;
      }

      if (activeTool === 'text') {
        const existingInput = canvasWrap.querySelector('.twitvid-inline-text-input');
        if (existingInput) existingInput.remove();

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'twitvid-inline-text-input';
        input.placeholder = 'Type text & Enter...';
        const scaleX = canvas.clientWidth / canvas.width;
        const scaleY = canvas.clientHeight / canvas.height;
        input.style.left = `${coords.x * scaleX}px`;
        input.style.top = `${coords.y * scaleY}px`;
        input.style.color = activeColor;
        canvasWrap.appendChild(input);
        setTimeout(() => input.focus(), 20);

        const commitText = () => {
          const val = input.value.trim();
          if (val) {
            saveState();
            const fontSize = Math.max(18, Math.round(strokeWidth * 4 * (canvas.width / 1000)));
            ctx.save();
            ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

            const metrics = ctx.measureText(val);
            const textW = metrics.width;
            const textH = fontSize * 1.2;

            // Draw contrast background box
            ctx.fillStyle = 'rgba(10, 16, 26, 0.85)';
            ctx.fillRect(coords.x - 6, coords.y - fontSize + 2, textW + 12, textH + 4);

            // Draw text
            ctx.fillStyle = activeColor;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(val, coords.x, coords.y);
            ctx.restore();
          }
          input.remove();
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') commitText();
          if (ke.key === 'Escape') input.remove();
        });
        input.addEventListener('blur', commitText);
        return;
      }

      // Drawing tools
      isDrawing = true;
      saveState();
      tempSnapshot = undoStack[undoStack.length - 1].data;
      activeStrokePoints = [{ x: startX, y: startY }];
      ctx.beginPath();
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const coords = getCanvasCoords(e);
      const computedWidth = Math.max(2, strokeWidth * (canvas.width / 1200));

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        activeStrokePoints.push({ x: coords.x, y: coords.y });
        ctx.putImageData(tempSnapshot, 0, 0);

        ctx.save();
        if (activeTool === 'highlighter') {
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = computedWidth * 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        } else {
          ctx.lineWidth = computedWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
        ctx.strokeStyle = activeColor;
        ctx.beginPath();
        ctx.moveTo(activeStrokePoints[0].x, activeStrokePoints[0].y);
        for (let i = 1; i < activeStrokePoints.length; i++) {
          ctx.lineTo(activeStrokePoints[i].x, activeStrokePoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === 'arrow') {
        ctx.putImageData(tempSnapshot, 0, 0);
        drawArrowOnCanvas(ctx, startX, startY, coords.x, coords.y, activeColor, computedWidth);
      } else if (activeTool === 'rect') {
        ctx.putImageData(tempSnapshot, 0, 0);
        ctx.save();
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = computedWidth;
        ctx.strokeRect(
          Math.min(startX, coords.x),
          Math.min(startY, coords.y),
          Math.abs(coords.x - startX),
          Math.abs(coords.y - startY)
        );
        ctx.restore();
      }
    });

    window.addEventListener('mouseup', () => {
      if (!isDrawing) return;
      isDrawing = false;
      tempSnapshot = null;
      activeStrokePoints = [];
      ctx.beginPath();
    });

    // Close Button & Backdrop
    const btnClose = dialog.querySelector('.twitvid-btn-close');
    btnClose.addEventListener('click', removeActiveOverlay);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) removeActiveOverlay();
    });

    // Copy to Clipboard (Flattened annotated canvas)
    const btnCopy = dialog.querySelector('.twitvid-btn-copy');
    btnCopy.addEventListener('click', () => {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('Copied screenshot to clipboard! 📋');
          btnCopy.innerHTML = `
            <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            btnCopy.innerHTML = `
              <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              <span>Copy to Clipboard</span>
            `;
          }, 2200);
        } catch (err) {
          console.error('[MediaCollect] Copy error:', err);
          showToast('Clipboard copy failed. Try Save Image instead.');
        }
      }, 'image/png');
    });

    // Save Image (Flattened annotated canvas download)
    const btnSave = dialog.querySelector('.twitvid-btn-save');
    btnSave.addEventListener('click', () => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const domain = location.hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `screenshot_${domain}_${timestamp}.png`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast('Screenshot saved! 💾');
      }, 'image/png');
    });

    // Open in Dedicated Tab (Pop out to full tab for multi-tab workflow)
    const openTabBtns = dialog.querySelectorAll('.twitvid-btn-open-tab');
    openTabBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const currentDataUrl = canvas.toDataURL('image/png');
          const captureId = 'capture_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          btn.style.opacity = '0.6';
          btn.disabled = true;

          await chrome.storage.local.set({
            [captureId]: {
              dataUrl: currentDataUrl,
              width: canvas.width,
              height: canvas.height,
              title: document.title || 'Screenshot',
              url: location.href,
              timestamp: Date.now()
            }
          });

          await chrome.runtime.sendMessage({
            type: 'OPEN_STUDIO_TAB',
            payload: { captureId }
          });

          showToast('Opened in dedicated tab! ↗️');
          removeActiveOverlay();
        } catch (err) {
          console.error('[MediaCollect] Open tab error:', err);
          showToast('Could not open tab: ' + (err.message || 'Error'));
          btn.style.opacity = '1';
          btn.disabled = false;
        }
      });
    });

    // Keyboard Shortcuts
    const onKey = (e) => {
      if (e.key === 'Escape') {
        removeActiveOverlay();
        document.removeEventListener('keydown', onKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', onKey);
  }

  /**
   * Mode 1: Capture Area Selection (Drag rectangle)
   */
  function startAreaSelection() {
    removeActiveOverlay();

    const root = document.createElement('div');
    root.id = 'twitvid-screenshot-root';

    const backdrop = document.createElement('div');
    backdrop.className = 'twitvid-area-backdrop';

    const banner = document.createElement('div');
    banner.className = 'twitvid-instructions-banner';
    banner.innerHTML = `
      <span>📐 Click and drag to select area</span>
      <span class="twitvid-kbd-key">ESC to cancel</span>
    `;

    const box = document.createElement('div');
    box.className = 'twitvid-selection-box';
    box.style.display = 'none';

    const tooltip = document.createElement('div');
    tooltip.className = 'twitvid-selection-tooltip';
    box.appendChild(tooltip);

    root.appendChild(backdrop);
    root.appendChild(banner);
    root.appendChild(box);
    document.body.appendChild(root);
    activeOverlay = root;

    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let currentRect = { x: 0, y: 0, width: 0, height: 0 };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
      currentRect = { x: startX, y: startY, width: 0, height: 0 };
      box.style.left = `${startX}px`;
      box.style.top = `${startY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      box.style.display = 'block';
    };

    const onMouseMove = (e) => {
      if (!isDrawing) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const width = Math.abs(e.clientX - startX);
      const height = Math.abs(e.clientY - startY);

      currentRect = { x, y, width, height };
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      tooltip.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
    };

    const onMouseUp = async () => {
      if (!isDrawing) return;
      isDrawing = false;

      cleanup();

      if (currentRect.width < 10 || currentRect.height < 10) {
        removeActiveOverlay();
        return;
      }

      // Hide overlay before capturing screen
      root.style.display = 'none';
      await waitForRepaint(50);

      // Capture visible tab
      try {
        const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
        if (!response || !response.dataUrl) {
          throw new Error('Capture failed');
        }

        const img = await loadImage(response.dataUrl);
        const dpr = window.devicePixelRatio || 1;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(currentRect.width * dpr);
        canvas.height = Math.round(currentRect.height * dpr);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(
          img,
          Math.round(currentRect.x * dpr),
          Math.round(currentRect.y * dpr),
          Math.round(currentRect.width * dpr),
          Math.round(currentRect.height * dpr),
          0,
          0,
          canvas.width,
          canvas.height
        );

        const croppedDataUrl = canvas.toDataURL('image/png');
        showScreenshotPreviewModal(croppedDataUrl, Math.round(currentRect.width), Math.round(currentRect.height));
      } catch (err) {
        console.error('[MediaCollect] Crop failed:', err);
        removeActiveOverlay();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        removeActiveOverlay();
      }
    };

    function cleanup() {
      backdrop.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    }

    backdrop.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }

  /**
   * Mode 2: Capture DOM Element (Hover inspector & click)
   */
  function startElementPicker() {
    removeActiveOverlay();

    const root = document.createElement('div');
    root.id = 'twitvid-screenshot-root';

    const highlight = document.createElement('div');
    highlight.className = 'twitvid-element-highlight';
    highlight.style.display = 'none';

    const badge = document.createElement('div');
    badge.className = 'twitvid-element-badge';
    highlight.appendChild(badge);

    const banner = document.createElement('div');
    banner.className = 'twitvid-instructions-banner';
    banner.innerHTML = `
      <span>🎯 Hover & Click any element to capture</span>
      <span class="twitvid-kbd-key">ESC to cancel</span>
    `;

    root.appendChild(highlight);
    root.appendChild(banner);
    document.body.appendChild(root);
    activeOverlay = root;

    let targetElement = null;

    const onMouseMove = (e) => {
      root.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      root.style.pointerEvents = 'auto';

      if (!el || el === document.documentElement || el === document.body || root.contains(el)) {
        highlight.style.display = 'none';
        targetElement = null;
        return;
      }

      targetElement = el;
      const rect = el.getBoundingClientRect();
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.display = 'block';

      const tagName = el.tagName.toLowerCase();
      const className = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
      badge.textContent = `<${tagName}${className.slice(0, 16)}> (${Math.round(rect.width)} × ${Math.round(rect.height)})`;
    };

    const onClick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!targetElement) return;

      cleanup();
      const rect = targetElement.getBoundingClientRect();
      root.style.display = 'none';
      await waitForRepaint(50);

      try {
        const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
        if (!response || !response.dataUrl) throw new Error('Capture failed');

        const img = await loadImage(response.dataUrl);
        const dpr = window.devicePixelRatio || 1;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(
          img,
          Math.round(rect.left * dpr),
          Math.round(rect.top * dpr),
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const croppedDataUrl = canvas.toDataURL('image/png');
        showScreenshotPreviewModal(croppedDataUrl, Math.round(rect.width), Math.round(rect.height));
      } catch (err) {
        console.error('[MediaCollect] Element capture failed:', err);
        removeActiveOverlay();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        removeActiveOverlay();
      }
    };

    function cleanup() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown);
  }

  /**
   * Mode 3: Capture Visible Viewport
   */
  async function captureVisibleViewport() {
    removeActiveOverlay();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
      if (response && response.dataUrl) {
        const img = await loadImage(response.dataUrl);
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(img.width / dpr);
        const height = Math.round(img.height / dpr);
        showScreenshotPreviewModal(response.dataUrl, width, height);
      }
    } catch (err) {
      console.error('[MediaCollect] Visible capture failed:', err);
    }
  }

  /**
   * Mode 4: Capture Entire Page (Bulletproof scrolling stitch)
   */
  async function captureEntirePage() {
    removeActiveOverlay();

    // 1. Temporarily disable smooth scroll and ALL transitions/animations so elements hide instantly with 0ms delay
    const noSmoothStyle = document.createElement('style');
    noSmoothStyle.id = 'twitvid-no-smooth';
    noSmoothStyle.textContent = `
      html, body, * {
        scroll-behavior: auto !important;
        transition: none !important;
        animation: none !important;
        -webkit-transition: none !important;
        -webkit-animation: none !important;
      }
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    `;
    document.head.appendChild(noSmoothStyle);

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // 2. Create floating progress indicator strictly positioned at top-right
    const root = document.createElement('div');
    root.id = 'twitvid-screenshot-root';
    root.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      left: auto !important;
      bottom: auto !important;
      width: auto !important;
      height: auto !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    `;

    const progressModal = document.createElement('div');
    progressModal.className = 'twitvid-progress-modal';
    progressModal.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      left: auto !important;
      bottom: auto !important;
      margin: 0 !important;
      transform: none !important;
      width: 250px !important;
      min-width: 250px !important;
      background: rgba(12, 19, 30, 0.96) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      border: 1px solid rgba(255, 255, 255, 0.22) !important;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.8) !important;
      border-radius: 12px !important;
      padding: 14px 18px !important;
      text-align: left !important;
      color: #ffffff !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    `;
    progressModal.innerHTML = `
      <div style="font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
        <span>📜 Capturing Entire Page</span>
      </div>
      <div style="font-size: 11px; color: #8899a6; margin-top: 2px;">Scrolling & stitching slices...</div>
      <div class="twitvid-progress-bar-wrap">
        <div class="twitvid-progress-bar-fill" id="twitvid-progress-fill"></div>
      </div>
      <div id="twitvid-progress-text" style="font-size: 11px; font-weight: 700; color: #1d9bf0;">Starting...</div>
    `;

    root.appendChild(progressModal);
    document.body.appendChild(root);
    activeOverlay = root;

    const progressFill = document.getElementById('twitvid-progress-fill');
    const progressText = document.getElementById('twitvid-progress-text');

    // Map to keep track of all suppressed sticky/fixed elements throughout capture
    const suppressedElementsMap = new Map();

    /**
     * Finds and hides all sticky & fixed elements without unhiding them between slices
     */
    function suppressStickyAndFixedElements() {
      const candidates = document.querySelectorAll(
        'header, nav, aside, [role="banner"], [role="navigation"], [class*="header" i], [class*="nav" i], [class*="sticky" i], [class*="fixed" i], [class*="menu" i], [class*="bar" i], [id*="header" i], [id*="nav" i], div, section'
      );

      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (el.id === 'twitvid-screenshot-root' || el.closest('#twitvid-screenshot-root')) continue;
        if (suppressedElementsMap.has(el)) continue;

        try {
          const style = window.getComputedStyle(el);
          const pos = style.position;
          if (pos === 'fixed' || pos === 'sticky' || pos === '-webkit-sticky') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
              suppressedElementsMap.set(el, {
                prevVis: el.style.getPropertyValue('visibility'),
                prevVisPri: el.style.getPropertyPriority('visibility'),
                prevOp: el.style.getPropertyValue('opacity'),
                prevOpPri: el.style.getPropertyPriority('opacity')
              });
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
            }
          }
        } catch (_) {}
      }
    }

    /**
     * Restores all suppressed elements only when capture is completely finished
     */
    function restoreAllSuppressedElements() {
      for (const [el, orig] of suppressedElementsMap.entries()) {
        try {
          if (orig.prevVis) {
            el.style.setProperty('visibility', orig.prevVis, orig.prevVisPri);
          } else {
            el.style.removeProperty('visibility');
          }
          if (orig.prevOp) {
            el.style.setProperty('opacity', orig.prevOp, orig.prevOpPri);
          } else {
            el.style.removeProperty('opacity');
          }
        } catch (_) {}
      }
      suppressedElementsMap.clear();
    }

    try {
      // Jump to the top first and let DOM settle
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      await new Promise(r => setTimeout(r, 260));

      const capturedSlices = [];
      let atBottom = false;
      let lastY = -1;
      let iteration = 0;
      const MAX_SLICES = 45;

      while (!atBottom && iteration < MAX_SLICES) {
        const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;

        // Hide progress indicator before capturing
        root.style.display = 'none';

        // Suppress repeating sticky & fixed elements permanently for all slices after the first
        if (iteration > 0) {
          suppressStickyAndFixedElements();
        }

        // Wait for browser compositor to flush repaint cleanly
        await waitForRepaint(80);

        // Capture with retry
        let response = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          response = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
          if (response && response.dataUrl) break;
          await new Promise(r => setTimeout(r, 550));
        }

        // Restore progress modal to show progress in corner
        root.style.display = 'block';

        if (response && response.dataUrl) {
          const sliceImg = await loadImage(response.dataUrl);
          capturedSlices.push({
            img: sliceImg,
            y: currentScrollY,
            width: sliceImg.naturalWidth || sliceImg.width,
            height: sliceImg.naturalHeight || sliceImg.height
          });
        }

        lastY = currentScrollY;

        // Scroll down by viewportHeight
        const nextY = currentScrollY + viewportHeight;
        window.scrollTo(0, nextY);
        document.documentElement.scrollTop = nextY;
        document.body.scrollTop = nextY;
        await new Promise(r => setTimeout(r, 180));

        const newScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        // If scroll position didn't change, we have reached the bottom!
        if (newScrollY <= currentScrollY || Math.abs(newScrollY - lastY) < 2) {
          atBottom = true;
        }

        iteration++;
        if (progressFill) progressFill.style.width = `${Math.min(95, iteration * 10)}%`;
        if (progressText) progressText.textContent = `Slice ${iteration}...`;
      }

      // Restore all suppressed sticky elements now that capture is complete
      restoreAllSuppressedElements();

      if (capturedSlices.length === 0) {
        throw new Error('No slices were captured');
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Stitching...';

      // 4. Compute true canvas dimensions from collected slices
      const canvasWidth = capturedSlices[0].width;
      const canvasHeight = Math.max(...capturedSlices.map(s => Math.round(s.y * dpr) + s.height));

      const masterCanvas = document.createElement('canvas');
      masterCanvas.width = canvasWidth;
      masterCanvas.height = canvasHeight;
      const ctx = masterCanvas.getContext('2d', { willReadFrequently: true });

      // Solid white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);

      // Draw all slices in sequence
      for (const slice of capturedSlices) {
        ctx.drawImage(
          slice.img,
          0,
          0,
          slice.width,
          slice.height,
          0,
          Math.round(slice.y * dpr),
          slice.width,
          slice.height
        );
      }

      // Restore scroll and cleanup temporary style
      noSmoothStyle.remove();
      window.scrollTo(originalScrollX, originalScrollY);

      const finalDataUrl = masterCanvas.toDataURL('image/png');
      const logicalWidth = Math.round(canvasWidth / dpr);
      const logicalHeight = Math.round(canvasHeight / dpr);
      showScreenshotPreviewModal(finalDataUrl, logicalWidth, logicalHeight);
    } catch (err) {
      console.error('[MediaCollect] Full page capture error:', err);
      restoreAllSuppressedElements();
      if (noSmoothStyle.parentElement) noSmoothStyle.remove();
      window.scrollTo(originalScrollX, originalScrollY);
      removeActiveOverlay();
    }
  }

  // Listen for trigger messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_AREA_SELECTION') {
      startAreaSelection();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'START_ELEMENT_PICKER') {
      startElementPicker();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'CAPTURE_VISIBLE_VIEWPORT') {
      captureVisibleViewport();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'CAPTURE_FULL_PAGE') {
      captureEntirePage();
      sendResponse({ success: true });
      return true;
    }

    return false;
  });

})();
