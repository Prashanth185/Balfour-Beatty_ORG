import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const EXPORT_PADDING    = 64;   // padding on all four sides of the exported image
const EXPORT_MIN_SCALE  = 2;
const EXPORT_MAX_SCALE  = 3;
const MAX_CANVAS_SIDE   = 16384;

// ── Node card enlargement for export ─────────────────────────────────────────
// Live card dimensions (must match CARD_W/CARD_H in TraditionalOrgChart.jsx
// and orgChartLayouts.jsx).
// These are DEFAULTS — at runtime, the export container may carry
// data-live-card-w / data-live-card-h attributes that override these values
// when the user has changed the node size.
const DEFAULT_LIVE_CARD_W = 180;
const DEFAULT_LIVE_CARD_H = 90;

// Export card dimensions — larger so all text fits without clipping.
// We scale relative to the live size so that the export is proportionally larger.
const EXP_CARD_W  = DEFAULT_LIVE_CARD_W;
const EXP_CARD_H  = DEFAULT_LIVE_CARD_H;
// EXP_SCALE is computed dynamically from the actual live size at call time.

// ─────────────────────────────────────────────────────────────────────────────

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function pxToPt(px) {
  return (px * 72) / 96;
}

function findExportArea(element) {
  if (!element) return null;
  if (element.id === 'org-chart-export-area') return element;
  return element.closest('#org-chart-export-area') || element;
}

/**
 * Polish a cloned DOM tree for export.
 * - Removes interactive controls.
 * - Removes transforms.
 * - Unlocks overflow on layout containers only.
 * - Re-locks overflow on rounded card wrappers and .truncate text.
 */
function polishCloneForExport(root) {
  root.querySelectorAll('[data-export-exclude], [data-export-hide-grid]').forEach((n) => n.remove());

  root.querySelectorAll('*').forEach((node) => {
    if (!node.style) return;
    if (node.style.transform && node.style.transform !== 'none') {
      node.style.transform = 'none';
    }
  });

  root.querySelectorAll('div, section, article, main, aside, nav, header, footer').forEach((node) => {
    if (node.style.overflow)  node.style.overflow  = 'visible';
    if (node.style.overflowX) node.style.overflowX = 'visible';
    if (node.style.overflowY) node.style.overflowY = 'visible';
  });

  // Re-lock card wrappers so accent strip clips at border-radius
  root.querySelectorAll('.rounded-lg').forEach((node) => {
    node.style.overflow = 'hidden';
  });

  // Keep single-line truncation on screen text
  root.querySelectorAll('.truncate').forEach((node) => {
    node.style.overflow     = 'hidden';
    node.style.textOverflow = 'ellipsis';
    node.style.whiteSpace   = 'nowrap';
  });
}

/**
 * Measure the true rendered extent of all positioned descendants.
 */
function measureAbsoluteExtent(element) {
  const base = element.getBoundingClientRect();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  element.querySelectorAll('*').forEach((node) => {
    const cs = window.getComputedStyle(node);
    if (cs.position === 'absolute' || cs.position === 'relative') {
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        minX = Math.min(minX, r.left - base.left);
        minY = Math.min(minY, r.top  - base.top);
        maxX = Math.max(maxX, r.right  - base.left);
        maxY = Math.max(maxY, r.bottom - base.top);
        found = true;
      }
    }
  });
  return found ? { minX, minY, maxX, maxY } : null;
}

/**
 * enlargeCardsInClone
 *
 * Called inside html2canvas's onclone callback.
 * Finds every node card in the cloned document and scales it up so that
 * all text is fully readable.  The live DOM is never touched.
 *
 * Detection strategy: look for elements whose inline width is exactly
 * liveW px — those are node cards positioned by the chart engine.
 * Also handle flow-layout cards from DesignationColumnCanvas which use
 * the same CARD_W constant but via inline style rather than className.
 *
 * @param {Document|Element} docRoot  - root to search within
 * @param {number} liveW              - actual live card width (from data attribute or default)
 * @param {number} liveH              - actual live card height (from data attribute or default)
 */
function enlargeCardsInClone(docRoot, liveW = DEFAULT_LIVE_CARD_W, liveH = DEFAULT_LIVE_CARD_H) {
  // Export card size is proportionally larger than the live size
  const scaleRatio = EXP_CARD_W / DEFAULT_LIVE_CARD_W; // keep ~1.59× ratio
  const expW  = Math.round(liveW * scaleRatio);
  const expH  = Math.round(liveH * scaleRatio);
  const scale = expW / liveW;

  // ── 1. Enlarge absolutely-positioned card wrappers ────────────────────────
  // These are the outer <div style="position:absolute; left:X; top:Y; width:liveW; height:liveH">
  docRoot.querySelectorAll('div[style]').forEach((el) => {
    const w = parseInt(el.style.width,  10);
    const h = parseInt(el.style.height, 10);
    if (w === liveW && h === liveH) {
      // This is a card wrapper — enlarge it
      el.style.width  = `${expW}px`;
      el.style.height = `${expH}px`;
      // Shift its absolute position to account for the wider card so
      // cards that were centred on a point stay centred.
      if (el.style.left) {
        const origLeft = parseFloat(el.style.left);
        el.style.left = `${origLeft - (expW - liveW) / 2}px`;
      }
      // Scale up font sizes inside this card
      scaleCardText(el, scale, expW);
    }
  });

  // ── 2. Enlarge flow-layout cards (DesignationColumnCanvas, etc.) ──────────
  // These have width:liveW in inline style but no height (or height:liveH).
  docRoot.querySelectorAll('div[style]').forEach((el) => {
    const w = parseInt(el.style.width, 10);
    if (w === liveW && !el.style.height) {
      el.style.width = `${expW}px`;
      scaleCardText(el, scale, expW);
    }
  });

  // ── 3. Enlarge the inner card body divs (rounded-lg wrappers) ────────────
  // These have width:CARD_W and height:CARD_H set by the flex layout.
  // We also need to enlarge the actual card body inside each wrapper.
  docRoot.querySelectorAll('.rounded-lg[style], div.rounded-lg').forEach((el) => {
    // Only touch cards that are the direct inner card of a node wrapper
    if (parseInt(el.style.width, 10) === liveW || el.offsetWidth === liveW) {
      el.style.width  = `${expW}px`;
      el.style.height = `${expH}px`;
    }
  });
}

/**
 * Scale all text elements inside a card node and unlock text so it wraps
 * to show full content instead of truncating.
 * @param {Element} cardEl - card element
 * @param {number}  scale  - scale factor
 * @param {number}  expW   - export card width (used to constrain text max-width)
 */
function scaleCardText(cardEl, scale, expW) {
  cardEl.querySelectorAll('p, span, div').forEach((el) => {
    const cs = window.getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (fs > 0) {
      el.style.fontSize   = `${Math.round(fs * scale)}px`;
      el.style.lineHeight = '1.4';
    }
    // Unlock text overflow so full name/designation renders
    if (
      el.style.overflow     === 'hidden' ||
      el.style.textOverflow === 'ellipsis' ||
      el.style.whiteSpace   === 'nowrap'
    ) {
      el.style.overflow     = 'visible';
      el.style.textOverflow = 'clip';
      el.style.whiteSpace   = 'normal';
      el.style.wordBreak    = 'break-word';
      el.style.maxWidth     = `${(expW || EXP_CARD_W) - 16}px`; // keep text inside card
    }
  });

  // Also fix Tailwind .truncate class descendants
  cardEl.querySelectorAll('.truncate').forEach((el) => {
    el.style.overflow     = 'visible';
    el.style.textOverflow = 'clip';
    el.style.whiteSpace   = 'normal';
    el.style.wordBreak    = 'break-word';
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function buildFreeformExportTree(element) {
  const exportArea = findExportArea(element);
  const chartRoot  = (exportArea || element).querySelector('[data-chart-export-root]');
  if (!chartRoot) return null;

  const canvasWidth = Number(chartRoot.getAttribute('data-canvas-width'))
    || chartRoot.scrollWidth || chartRoot.offsetWidth;
  const canvasHeight = Number(chartRoot.getAttribute('data-canvas-height'))
    || chartRoot.scrollHeight || chartRoot.offsetHeight;

  if (!canvasWidth || !canvasHeight) {
    throw new Error('Chart dimensions are not ready. Wait for the chart to finish loading.');
  }

  // Read live card size from export container data attributes (set by the chart page)
  const liveW   = Number((exportArea || element).getAttribute('data-live-card-w')) || DEFAULT_LIVE_CARD_W;
  const liveH   = Number((exportArea || element).getAttribute('data-live-card-h')) || DEFAULT_LIVE_CARD_H;
  const expScale = EXP_CARD_W / DEFAULT_LIVE_CARD_W; // ~1.59 ratio kept constant

  // Scale up the canvas to account for enlarged cards
  const scaledW = Math.ceil(canvasWidth  * expScale);
  const scaledH = Math.ceil(canvasHeight * expScale);

  const doc = document.createElement('div');
  doc.style.background   = '#ffffff';
  doc.style.padding      = `${EXPORT_PADDING}px`;
  doc.style.boxSizing    = 'border-box';
  doc.style.width        = `${scaledW + EXPORT_PADDING * 2}px`;
  doc.style.position     = 'relative';
  doc.style.overflow     = 'visible';

  const titleEl = exportArea?.querySelector('h2');
  if (titleEl) {
    const tc = titleEl.cloneNode(true);
    tc.style.cssText = 'display:block;margin:0 0 24px 0;padding:0 0 12px 0;line-height:1.2;color:#1e3a5f;font-size:22px;font-weight:700;';
    doc.appendChild(tc);
  }

  const chartClone = chartRoot.cloneNode(true);
  chartClone.style.transform       = 'none';
  chartClone.style.transformOrigin = 'top left';
  chartClone.style.width           = `${scaledW}px`;
  chartClone.style.height          = `${scaledH}px`;
  chartClone.style.minWidth        = `${scaledW}px`;
  chartClone.style.minHeight       = `${scaledH}px`;
  chartClone.style.position        = 'relative';
  chartClone.style.overflow        = 'visible';
  chartClone.style.background      = '#ffffff';

  polishCloneForExport(chartClone);
  doc.appendChild(chartClone);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;top:0;z-index:-1;pointer-events:none;background:#ffffff;overflow:visible;';
  wrapper.appendChild(doc);
  document.body.appendChild(wrapper);

  const width  = Math.ceil(doc.scrollWidth  || doc.offsetWidth);
  const height = Math.ceil(doc.scrollHeight || doc.offsetHeight);
  doc.style.width    = `${width}px`;
  doc.style.height   = `${height}px`;
  wrapper.style.width  = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.left   = `${-(width + 200)}px`;

  return { wrapper, captureNode: doc, width, height, liveW, liveH };
}

function buildLegacyExportTree(element) {
  const innerCanvas = element.querySelector('[class*="relative"]') || element;

  const rawW = Math.max(
    innerCanvas.scrollWidth, innerCanvas.offsetWidth,
    element.scrollWidth,     element.offsetWidth,
    1,
  );
  const rawH = Math.max(
    innerCanvas.scrollHeight, innerCanvas.offsetHeight,
    element.scrollHeight,     element.offsetHeight,
    1,
  );

  const extent  = measureAbsoluteExtent(element);
  const extentW = extent ? Math.ceil(extent.maxX - Math.min(0, extent.minX)) : 0;
  const extentH = extent ? Math.ceil(extent.maxY - Math.min(0, extent.minY)) : 0;

  // Read live card size from export container data attributes
  const liveW    = Number(element.getAttribute('data-live-card-w')) || DEFAULT_LIVE_CARD_W;
  const liveH    = Number(element.getAttribute('data-live-card-h')) || DEFAULT_LIVE_CARD_H;
  const expScale = EXP_CARD_W / DEFAULT_LIVE_CARD_W; // ~1.59 constant ratio

  // Scale up by expScale to accommodate enlarged cards
  const contentW = Math.ceil(Math.max(rawW, extentW) * expScale);
  const contentH = Math.ceil(Math.max(rawH, extentH) * expScale);

  const totalW = contentW + EXPORT_PADDING * 2;
  const totalH = contentH + EXPORT_PADDING * 2;

  const clone = element.cloneNode(true);
  polishCloneForExport(clone);

  clone.style.position  = 'relative';
  clone.style.transform = 'none';
  clone.style.overflow  = 'visible';
  clone.style.background = '#ffffff';
  clone.style.width     = `${contentW}px`;
  clone.style.height    = `${contentH}px`;

  if (extent && extent.minX < 0) clone.style.marginLeft = `${-extent.minX * expScale}px`;
  if (extent && extent.minY < 0) clone.style.marginTop  = `${-extent.minY * expScale}px`;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'top:0',
    `left:${-(totalW + 200)}px`,
    'z-index:-1',
    'pointer-events:none',
    'background:#ffffff',
    'overflow:visible',
    `width:${totalW}px`,
    `height:${totalH}px`,
    `padding:${EXPORT_PADDING}px`,
    'box-sizing:border-box',
  ].join(';');
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return { wrapper, captureNode: wrapper, width: totalW, height: totalH, liveW, liveH };
}

function prepareExportCapture(element) {
  if (!element) throw new Error('Chart area not found');
  return buildFreeformExportTree(element) || buildLegacyExportTree(element);
}

function computeExportScale(width, height) {
  const longestSide = Math.max(width, height, 1);
  return Math.max(EXPORT_MIN_SCALE, Math.min(EXPORT_MAX_SCALE, MAX_CANVAS_SIDE / longestSide));
}

function triggerDownload(link) {
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  link.remove();
}

export async function captureChartElement(element) {
  const { wrapper, captureNode, width, height, liveW, liveH } = prepareExportCapture(element);
  await waitForPaint();

  const scale = computeExportScale(width, height);

  try {
    const canvas = await html2canvas(captureNode, {
      backgroundColor: '#ffffff',
      width,
      height,
      scale,
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 30000,
      foreignObjectRendering: false,
      onclone: (doc) => {
        // Remove interactive controls
        doc.querySelectorAll('[data-export-exclude], [data-export-hide-grid]').forEach((n) => n.remove());

        // Fix duplicate SVG marker IDs
        doc.querySelectorAll('svg marker[id]').forEach((marker, i) => {
          marker.id = `${marker.id}-export-${i}`;
        });

        // ── Enlarge node cards and unlock text ────────────────────────────
        // Pass the live card size so cards at non-default sizes are correctly matched
        enlargeCardsInClone(doc, liveW || DEFAULT_LIVE_CARD_W, liveH || DEFAULT_LIVE_CARD_H);
      },
    });

    if (!canvas.width || !canvas.height) {
      throw new Error('Export produced an empty image. Ensure the chart is fully loaded.');
    }

    return canvas;
  } finally {
    wrapper.remove();
  }
}

export async function exportChartAsImage(element, filename = 'org-chart.png') {
  const canvas = await captureChartElement(element);
  const link   = document.createElement('a');
  link.download = filename;
  link.href     = canvas.toDataURL('image/png', 1.0);
  triggerDownload(link);
}

export async function exportChartAsPdf(element, filename = 'org-chart.pdf') {
  const canvas = await captureChartElement(element);
  const imgData = canvas.toDataURL('image/png', 1.0);

  const pageWidthPt  = pxToPt(canvas.width);
  const pageHeightPt = pxToPt(canvas.height);

  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidthPt, pageHeightPt],
    compress: true,
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'FAST');
  pdf.save(filename);
}
