/**
 * MediaCollect Screenshot Studio - Standalone Tab Application
 */
(async function () {
  'use strict';

  const canvas = document.getElementById('twitvid-studio-canvas');
  const canvasWrap = document.getElementById('twitvid-canvas-wrap');
  const canvasBody = document.getElementById('twitvid-canvas-body');
  const dimPill = document.getElementById('twitvid-studio-dim-pill');
  const sourceTitleEl = document.getElementById('studio-source-title');
  const zoomText = document.getElementById('zoom-level-text');
  const emptyZone = document.getElementById('studio-empty-zone');

  // Interactive Tools State
  let activeTool = 'pen';
  let strokeColor = '#f4212e';
  let strokeWidth = 6;
  let zoomLevel = 1.0;
  let isPanning = false;
  let panStartX = 0, panStartY = 0, scrollLeftInit = 0, scrollTopInit = 0;

  let isDrawing = false;
  let startX = 0, startY = 0;
  let activeStrokePoints = [];
  let tempSnapshot = null;
  const undoStack = [];

  // 1. Resolve Capture Data from URL query params or storage
  const urlParams = new URLSearchParams(window.location.search);
  const captureId = urlParams.get('id');

  let captureData = null;
  if (captureId && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(captureId);
      captureData = stored[captureId];
    } catch (err) {
      console.warn('[MediaCollect] Storage retrieval error:', err);
    }
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  let ctx = null;

  async function initializeWithImage(dataUrl, title) {
    try {
      const img = await loadImage(dataUrl);
      emptyZone.style.display = 'none';
      canvasWrap.style.display = 'block';

      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      dimPill.textContent = `${canvas.width} × ${canvas.height} px`;
      if (title) {
        sourceTitleEl.textContent = `• ${title}`;
        document.title = `Studio (${canvas.width}×${canvas.height}) - ${title}`;
      } else {
        document.title = `MediaCollect Studio (${canvas.width}×${canvas.height})`;
      }

      undoStack.length = 0;
      saveState();
      fitToScreen();
    } catch (err) {
      console.error('[MediaCollect] Failed to load capture image:', err);
      showToast('Error loading image buffer');
    }
  }

  if (captureData && captureData.dataUrl) {
    await initializeWithImage(captureData.dataUrl, captureData.title || '');
  } else {
    // Show empty zone & listen for direct paste
    dimPill.textContent = 'Ready for Paste';
    emptyZone.style.display = 'block';
    canvasWrap.style.display = 'none';
  }

  // 2. Undo State History
  function saveState() {
    if (!ctx) return;
    if (undoStack.length >= 25) undoStack.shift();
    undoStack.push({
      data: ctx.getImageData(0, 0, canvas.width, canvas.height),
      width: canvas.width,
      height: canvas.height
    });
    dimPill.textContent = `${canvas.width} × ${canvas.height} px`;
  }

  function undo() {
    if (undoStack.length <= 1 || !ctx) return;
    undoStack.pop();
    const prev = undoStack[undoStack.length - 1];
    canvas.width = prev.width;
    canvas.height = prev.height;
    ctx.putImageData(prev.data, 0, 0);
    dimPill.textContent = `${canvas.width} × ${canvas.height} px`;
  }

  // 3. Zooming & Pan Mechanics
  function setZoom(factor) {
    zoomLevel = Math.max(0.15, Math.min(4.0, factor));
    canvas.style.width = `${Math.round(canvas.width * zoomLevel)}px`;
    canvas.style.height = `${Math.round(canvas.height * zoomLevel)}px`;
    zoomText.textContent = `${Math.round(zoomLevel * 100)}%`;
  }

  function fitToScreen() {
    const availWidth = canvasBody.clientWidth - 80;
    const availHeight = canvasBody.clientHeight - 80;
    if (availWidth <= 0 || availHeight <= 0) return;
    const ratio = Math.min(availWidth / canvas.width, availHeight / canvas.height, 1.0);
    setZoom(ratio);
  }

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => setZoom(zoomLevel + 0.15));
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => setZoom(zoomLevel - 0.15));
  zoomText?.addEventListener('click', fitToScreen);

  // Wheel zoom / pinch
  canvasBody.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom(zoomLevel + delta);
    }
  }, { passive: false });

  // 4. Pan Tool
  canvasBody.addEventListener('mousedown', (e) => {
    if (activeTool === 'pan' || e.button === 1 || e.spaceKey) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      scrollLeftInit = canvasBody.scrollLeft;
      scrollTopInit = canvasBody.scrollTop;
      canvasBody.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      canvasBody.scrollLeft = scrollLeftInit - dx;
      canvasBody.scrollTop = scrollTopInit - dy;
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      canvasBody.style.cursor = activeTool === 'pan' ? 'grab' : 'default';
    }
  });

  // 5. Tool Selection
  const toolBtns = document.querySelectorAll('.twitvid-tool-btn[data-tool]');
  toolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      toolBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;

      if (activeTool === 'crop') {
        openCropBox();
      } else {
        closeCropBox();
      }

      if (activeTool === 'pan') {
        canvas.style.cursor = 'grab';
        canvasBody.style.cursor = 'grab';
      } else if (activeTool === 'text') {
        canvas.style.cursor = 'text';
        canvasBody.style.cursor = 'default';
      } else if (activeTool === 'crop') {
        canvas.style.cursor = 'crosshair';
        canvasBody.style.cursor = 'default';
      } else {
        canvas.style.cursor = 'crosshair';
        canvasBody.style.cursor = 'default';
      }
    });
  });

  // 6. Color Selection
  const colorDots = document.querySelectorAll('.twitvid-color-dot');
  colorDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      colorDots.forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');
      strokeColor = dot.dataset.color;
    });
  });

  // 7. Stroke Thickness Selection
  const strokeBtns = document.querySelectorAll('.twitvid-stroke-btn');
  strokeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      strokeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      strokeWidth = parseInt(btn.dataset.stroke, 10);
    });
  });

  // 8. Undo Button
  document.getElementById('btn-undo')?.addEventListener('click', undo);

  // 9. Coordinate Helper
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // 10. Canvas Drawing Pipeline
  canvas.addEventListener('mousedown', (e) => {
    if (!ctx || e.button !== 0 || activeTool === 'pan' || activeTool === 'crop') return;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;

    if (activeTool === 'text') {
      promptTextInput(e.clientX, e.clientY, startX, startY);
      return;
    }

    isDrawing = true;
    saveState();
    tempSnapshot = undoStack[undoStack.length - 1].data;
    activeStrokePoints = [{ x: startX, y: startY }];
    ctx.beginPath();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !ctx) return;
    const coords = getCanvasCoords(e);
    const computedWidth = Math.max(2, strokeWidth * (canvas.width / 1200));

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      ctx.restore();
      ctx.save();
      ctx.lineWidth = computedWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = computedWidth * 3.5;
      } else {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = strokeColor;
      }

      ctx.beginPath();
      const prev = activeStrokePoints[activeStrokePoints.length - 1];
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      activeStrokePoints.push(coords);
      return;
    }

    // Geometry Preview: Arrow / Box
    ctx.putImageData(tempSnapshot, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.lineWidth = computedWidth;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;

    if (activeTool === 'rect') {
      const rx = Math.min(startX, coords.x);
      const ry = Math.min(startY, coords.y);
      const rw = Math.abs(coords.x - startX);
      const rh = Math.abs(coords.y - startY);
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (activeTool === 'arrow') {
      drawArrow(ctx, startX, startY, coords.x, coords.y, computedWidth);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false;
      tempSnapshot = null;
      activeStrokePoints = [];
    }
  });

  function drawArrow(context, fromx, fromy, tox, toy, width) {
    const headlen = Math.max(14, width * 3.5);
    const angle = Math.atan2(toy - fromy, tox - fromx);

    context.beginPath();
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineWidth = width;
    context.lineCap = 'round';
    context.stroke();

    context.beginPath();
    context.moveTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  }

  function promptTextInput(clientX, clientY, cx, cy) {
    const existing = document.querySelector('.twitvid-inline-text-input');
    if (existing) existing.remove();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'twitvid-inline-text-input';
    input.placeholder = 'Type text... (Enter to finish)';
    input.style.left = `${clientX}px`;
    input.style.top = `${clientY}px`;
    document.body.appendChild(input);
    input.focus();

    const commitText = () => {
      const val = input.value.trim();
      input.remove();
      if (!val || !ctx) return;
      saveState();

      ctx.save();
      const fontSize = Math.max(18, Math.round(strokeWidth * 4.5 * (canvas.width / 1200)));
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      // Text background pill
      const metrics = ctx.measureText(val);
      const padding = fontSize * 0.3;
      ctx.fillStyle = 'rgba(25, 28, 35, 0.85)';
      ctx.fillRect(
        cx - padding,
        cy - fontSize,
        metrics.width + padding * 2,
        fontSize * 1.35
      );

      ctx.fillStyle = strokeColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(val, cx, cy - fontSize * 0.25);
      ctx.restore();
    };

    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') commitText();
      if (ke.key === 'Escape') input.remove();
    });
    input.addEventListener('blur', commitText);
  }

  // 11. Crop Mechanics
  const cropMask = document.getElementById('twitvid-crop-mask');
  const cropBox = document.getElementById('twitvid-crop-box');
  const btnApplyCrop = document.getElementById('btn-apply-crop');
  const btnCancelCrop = document.getElementById('btn-cancel-crop');

  let cropState = { x: 50, y: 50, w: 200, h: 150 };

  function openCropBox() {
    if (!ctx) return;
    cropMask.style.display = 'block';
    const cw = canvasWrap.clientWidth;
    const ch = canvasWrap.clientHeight;
    cropState = {
      x: Math.round(cw * 0.1),
      y: Math.round(ch * 0.1),
      w: Math.round(cw * 0.8),
      h: Math.round(ch * 0.8)
    };
    updateCropBoxDOM();
  }

  function closeCropBox() {
    cropMask.style.display = 'none';
  }

  function updateCropBoxDOM() {
    cropBox.style.left = `${cropState.x}px`;
    cropBox.style.top = `${cropState.y}px`;
    cropBox.style.width = `${cropState.w}px`;
    cropBox.style.height = `${cropState.h}px`;
  }

  btnCancelCrop?.addEventListener('click', () => {
    closeCropBox();
    const penBtn = document.querySelector('.twitvid-tool-btn[data-tool="pen"]');
    penBtn?.click();
  });

  btnApplyCrop?.addEventListener('click', () => {
    if (!ctx) return;
    const scaleX = canvas.width / canvasWrap.clientWidth;
    const scaleY = canvas.height / canvasWrap.clientHeight;

    const cropX = Math.round(cropState.x * scaleX);
    const cropY = Math.round(cropState.y * scaleY);
    const cropW = Math.max(10, Math.round(cropState.w * scaleX));
    const cropH = Math.max(10, Math.round(cropState.h * scaleY));

    const croppedData = ctx.getImageData(cropX, cropY, cropW, cropH);

    saveState();
    canvas.width = cropW;
    canvas.height = cropH;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(croppedData, 0, 0);

    closeCropBox();
    const penBtn = document.querySelector('.twitvid-tool-btn[data-tool="pen"]');
    penBtn?.click();
    fitToScreen();
    showToast('Image cropped! ✂️');
  });

  // 12. Copy to Clipboard
  const btnCopy = document.getElementById('btn-copy');
  btnCopy?.addEventListener('click', () => {
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast('Copied to clipboard! 📋');
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
        showToast('Clipboard copy failed');
      }
    }, 'image/png');
  });

  // 13. Save Image Download
  const btnSave = document.getElementById('btn-save');
  btnSave?.addEventListener('click', () => {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const domain = (captureData?.url ? new URL(captureData.url).hostname : 'mediacollect').replace(/^www\./, '').replace(/[^a-zA-Z0-9_-]/g, '_');
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

  // 14. Clipboard Paste Support (⌘V / Ctrl+V to paste multiple images)
  window.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target.result;
            await initializeWithImage(dataUrl, 'Pasted Image');
            showToast('Image pasted from clipboard! 📋');
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  });

  // 15. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  });

  // 16. Floating Toast Notifications
  function showToast(msg) {
    let toast = document.querySelector('.twitvid-toast-banner');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'twitvid-toast-banner';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'flex';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 2400);
  }

})();
