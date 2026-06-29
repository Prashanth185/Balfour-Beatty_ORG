/**
 * orgChartLayouts.js
 *
 * NEW FILE — additive only. Does NOT modify any existing file.
 *
 * Provides two additional layout rendering engines for the Traditional Org Chart:
 *
 *   1. GridLayout        — groups all employees under each root into balanced columns
 *   2. VerticalTreeLayout — renders the full hierarchy as a strict top-down vertical tree
 *
 * The existing "Hierarchical Tree" layout (OrgTreeCanvas in TraditionalOrgChart.jsx)
 * is untouched and remains the default.
 *
 * Both engines accept the same props as the existing OrgTreeCanvas:
 *   { roots, expandedSet, onToggle, onDelete, onColorChange,
 *     nodeColors, lineColor, lineThickness, selectedToolbarColor, isViewer }
 *
 * "isViewer" = true suppresses the delete & palette buttons (used in SharedOrgChart).
 *
 * Layout constants are kept identical to TraditionalOrgChart.jsx so cards look the same.
 */

import React from 'react';
import {
  ChevronDown, ChevronRight, Trash2, Palette, Check, Crosshair,
} from 'lucide-react';
import { DEFAULT_NODE_VISIBILITY, getInitials, avatarBgColor } from './nodeVisibility';

// ─── Default constants (fallback when no cardW/cardH prop is passed) ──────────
export const CARD_W = 180;
export const CARD_H = 90;

const DEPT_COLORS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#c026d3', '#65a30d',
];

function deptColor(dept) {
  if (!dept) return DEPT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = (hash * 31 + dept.charCodeAt(i)) | 0;
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

// Determine readable text on a coloured background
function textColorFor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? '#1e293b' : '#ffffff';
  } catch { return '#ffffff'; }
}

// ─── Sorting helpers (designation-based; shared by all layouts) ───────────────
function normalizeDesignation(d) {
  return String(d || '').trim().toLowerCase();
}
function sortChildrenByDesignation(children, sortType, designationOrder) {
  if (!Array.isArray(children) || children.length === 0) return [];
  if (!sortType || sortType === 'default') return children;

  const orderIdx = new Map();
  if (sortType === 'designation_custom' && Array.isArray(designationOrder)) {
    designationOrder.forEach((d, i) => {
      const k = normalizeDesignation(d);
      if (k && !orderIdx.has(k)) orderIdx.set(k, i);
    });
  }

  const arr = [...children];
  arr.sort((a, b) => {
    const da = normalizeDesignation(a?.designation);
    const db = normalizeDesignation(b?.designation);
    const aNone = !da, bNone = !db;
    if (aNone && !bNone) return 1;
    if (!aNone && bNone) return -1;

    if (sortType === 'designation_custom') {
      const ia = orderIdx.has(da) ? orderIdx.get(da) : Number.POSITIVE_INFINITY;
      const ib = orderIdx.has(db) ? orderIdx.get(db) : Number.POSITIVE_INFINITY;
      if (ia !== ib) return ia - ib;
    }

    if (da !== db) return da.localeCompare(db);
    return (a?.name || '').localeCompare(b?.name || '');
  });
  return arr;
}

// ─── Shared NodeCard (same visual as TraditionalOrgChart.jsx) ─────────────────
function LayoutNodeCard({
  node, x, y,
  isExpanded, hasChildren,
  onToggle, onDelete, onColorChange,
  nodeColor, selectedToolbarColor,
  isViewer = false,
  onFocus = null,
  cardW = CARD_W,
  cardH = CARD_H,
  nodeVisibility = null,
  onNodeClick = null,
}) {
  const vis = nodeVisibility || DEFAULT_NODE_VISIBILITY;
  const isColorized = !!nodeColor;
  const accent      = isColorized ? nodeColor : deptColor(node.department);
  const textColor   = '#1e3a5f';
  const subColor    = '#475569';
  const deptClr     = accent;

  // Photo / initials
  const showPhoto   = vis.showPhoto;
  const photoUrl    = node.photo_url;
  const initials    = getInitials(node.name);
  const avatarColor = avatarBgColor(node.name);

  // Determine right margin for card body when photo is shown (to avoid overlap)
  const rightReserved = showPhoto ? 36 : 0;

  return (
    <div className="absolute" style={{ left: x, top: y, width: cardW, height: cardH, zIndex: 10 }}>
      {/* Card body */}
      <div
        className="w-full h-full rounded-lg overflow-hidden flex shadow-md"
        style={{ border: '1px solid #e2e8f0', background: '#ffffff', cursor: onNodeClick && !isViewer ? 'pointer' : 'default' }}
        onClick={onNodeClick && !isViewer ? (e) => { e.stopPropagation(); onNodeClick(node, e); } : undefined}
        onDoubleClick={onFocus && !isViewer ? (e) => { e.stopPropagation(); onFocus(node); } : undefined}
        title={onNodeClick && !isViewer ? 'Click for options' : undefined}
      >
        <div style={{ width: 5, flexShrink: 0, background: accent }} />
        <div
          className="flex-1 px-2.5 py-2 min-w-0 relative"
          style={{
            paddingRight: rightReserved > 0 ? rightReserved + 4 : undefined,
            paddingBottom: hasChildren ? 18 : undefined,
          }}
        >
          {vis.showName && (
            <p className="font-bold text-sm leading-tight truncate" style={{ color: textColor }} title={node.name}>
              {node.name}
            </p>
          )}
          {vis.showDesignation && node.designation && (
            <p className="text-xs truncate mt-0.5" style={{ color: subColor }} title={node.designation}>
              {node.designation}
            </p>
          )}
          {vis.showDepartment && node.department && (
            <p className="text-xs truncate mt-0.5" style={{ color: deptClr, fontWeight: 500 }} title={node.department}>
              {node.department}
            </p>
          )}
          {vis.showEmployeeId && (
            <p className="text-xs truncate mt-0.5" style={{ color: '#94a3b8' }}>
              {node.employee_id}
            </p>
          )}

          {hasChildren && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); (onFocus && !isViewer ? onFocus(node) : onToggle(node.id)); }}
              className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 px-2 min-w-6 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow hover:bg-blue-700 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand one level'}
              data-export-exclude
            >
              {node.children?.length ?? 0}
            </button>
          )}

          {!isViewer && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onColorChange(node.id, selectedToolbarColor || null); }}
                className="absolute top-1 right-6 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
                title={selectedToolbarColor ? `Apply ${selectedToolbarColor}` : 'Select a color first'}
                style={{ color: '#94a3b8' }}
                data-export-exclude
              >
                <Palette className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-red-100"
                title="Delete employee"
                style={{ color: '#ef4444' }}
                data-export-exclude
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}

        </div>

        {/* Photo — top-right corner, inside the card */}
        {showPhoto && (
          <div style={{
            position: 'absolute',
            top: 5,
            right: isViewer ? 5 : 22,
            width: 28,
            height: 28,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            flexShrink: 0,
            zIndex: 5,
          }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={node.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                background: avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}>
                {initials}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT 1 — GRID LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Grid Layout — hierarchically correct, overlap-free layout.
 *
 * For every expanded node, ONLY its direct children (node.children) are shown
 * in a balanced grid.  Grandchildren appear only when their own manager is
 * expanded.
 *
 * Overlap prevention:
 *   Each row's height = max(gridBlockHeight(child)) across all children in
 *   that row.  Row Y positions are cumulative sums of those heights so that
 *   an expanded child in row 0 pushes row 1 downward by exactly the right
 *   amount.  The canvas size is computed from the same data, so it is always
 *   tall / wide enough to contain all content.
 */

const GRID_COL_GAP       = 20;   // horizontal gap between columns
const GRID_ROW_GAP       = 60;   // vertical gap: parent card bottom → child grid top
const GRID_INNER_ROW_GAP = 20;   // vertical gap between rows inside a grid

/** Auto-calculate column count: roughly square, 1–12. */
function computeGridCols(count) {
  if (count <= 0) return 1;
  return Math.min(12, Math.max(1, Math.ceil(Math.sqrt(count))));
}

/** Pixel width of a grid that holds childCount children. */
function childGridWidth(childCount, cardW) {
  if (childCount === 0) return cardW;
  const cols = computeGridCols(childCount);
  return cols * cardW + (cols - 1) * GRID_COL_GAP;
}

/**
 * Total pixel width of the visual block rooted at `node`.
 */
function gridBlockWidth(node, expandedSet, cardW, sortType, designationOrder) {
  if (!expandedSet.has(node.id) || !node.children || node.children.length === 0) return cardW;
  const children = sortChildrenByDesignation(node.children, sortType, designationOrder);
  const cols = computeGridCols(children.length);
  let totalW = 0;
  for (let ci = 0; ci < cols; ci++) {
    let colW = cardW;
    for (let ri = 0; ci + ri * cols < children.length; ri++) {
      const child = children[ci + ri * cols];
      colW = Math.max(colW, gridBlockWidth(child, expandedSet, cardW, sortType, designationOrder));
    }
    totalW += colW;
  }
  totalW += (cols - 1) * GRID_COL_GAP;
  return Math.max(cardW, totalW);
}

/**
 * Build the per-row height array for a node's direct children grid.
 */
function buildRowHeights(children, expandedSet, cols, cardH, sortType, designationOrder) {
  const rows = Math.ceil(children.length / cols);
  const rowHeights = [];
  for (let ri = 0; ri < rows; ri++) {
    let h = cardH;
    for (let ci = 0; ci < cols; ci++) {
      const idx = ri * cols + ci;
      if (idx < children.length) {
        h = Math.max(h, gridBlockHeight(children[idx], expandedSet, cardH, sortType, designationOrder));
      }
    }
    rowHeights.push(h);
  }
  return rowHeights;
}

/**
 * Total pixel height of the visual block rooted at `node`.
 */
function gridBlockHeight(node, expandedSet, cardH, sortType, designationOrder) {
  if (!expandedSet.has(node.id) || !node.children || node.children.length === 0) return cardH;
  const children = sortChildrenByDesignation(node.children, sortType, designationOrder);
  const cols = computeGridCols(children.length);
  const rowHeights = buildRowHeights(children, expandedSet, cols, cardH, sortType, designationOrder);
  const totalRowsH = rowHeights.reduce((sum, h) => sum + h, 0)
    + (rowHeights.length - 1) * GRID_INNER_ROW_GAP;
  return cardH + GRID_ROW_GAP + totalRowsH;
}

/**
 * Core recursive grid renderer — overlap-free.
 *
 * Places the node card, then if expanded:
 *   1. Computes per-column widths and per-row heights.
 *   2. Derives cumulative row Y offsets from those heights.
 *   3. Places each direct child at its exact (cellX, cellY).
 *   4. Recurses into expanded children (they render their own sub-grid below).
 */
function renderGridNode(
  node, x, y, expandedSet,
  onToggle, onDelete, onColorChange,
  nodeColors, selectedToolbarColor, isViewer,
  lc, lt, onFocus,
  cards, lines,
  cardW, cardH,
  nodeVisibility,
  sortType,
  designationOrder,
  onNodeClick = null,
) {
  const isExpanded  = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const blockW      = gridBlockWidth(node, expandedSet, cardW, sortType, designationOrder);

  // Centre the parent card within the block width
  const cardX  = x + (blockW - cardW) / 2;
  const cardCX = cardX + cardW / 2;

  cards.push(
    <LayoutNodeCard
      key={node.id}
      node={node}
      x={cardX}
      y={y}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      onToggle={onToggle}
      onDelete={onDelete}
      onColorChange={onColorChange}
      nodeColor={nodeColors[node.id] || node.node_color || null}
      selectedToolbarColor={selectedToolbarColor}
      isViewer={isViewer}
      onFocus={onFocus}
      cardW={cardW}
      cardH={cardH}
      nodeVisibility={nodeVisibility}
      onNodeClick={onNodeClick}
    />,
  );

  if (!isExpanded || !hasChildren) return;

  // ── Direct children only (NEVER grandchildren) ────────────────────────────
  const children = sortChildrenByDesignation(node.children || [], sortType, designationOrder);
  const cols     = computeGridCols(children.length);
  const rows     = Math.ceil(children.length / cols);

  // Per-column widths (each column as wide as its widest child block)
  const colWidths = Array.from({ length: cols }, (_, ci) => {
    let w = cardW;
    for (let ri = 0; ri < rows; ri++) {
      const idx = ri * cols + ci;
      if (idx < children.length) {
        w = Math.max(w, gridBlockWidth(children[idx], expandedSet, cardW, sortType, designationOrder));
      }
    }
    return w;
  });

  // Per-row heights (each row as tall as its tallest child block)
  const rowHeights = buildRowHeights(children, expandedSet, cols, cardH, sortType, designationOrder);

  // Total grid width = sum of column widths + gaps
  const gridW = colWidths.reduce((s, w) => s + w, 0) + (cols - 1) * GRID_COL_GAP;

  // Centre the grid under the parent card
  const gridLeft = cardCX - gridW / 2;
  const gridTopY = y + cardH + GRID_ROW_GAP;

  // Cumulative column X offsets
  const colX = [];
  let cx = gridLeft;
  for (let ci = 0; ci < cols; ci++) {
    colX.push(cx);
    cx += colWidths[ci] + GRID_COL_GAP;
  }

  // Cumulative row Y offsets
  const rowY = [];
  let ry = gridTopY;
  for (let ri = 0; ri < rows; ri++) {
    rowY.push(ry);
    ry += rowHeights[ri] + GRID_INNER_ROW_GAP;
  }

  // Column centre-x values (for connector lines) — use card centre within each column
  const colCXs = colX.map((cx2, ci) => cx2 + colWidths[ci] / 2);

  // Connector: parent card bottom → elbow → drops to each column
  const elbowY = y + cardH + GRID_ROW_GAP / 2;
  lines.push({ key: `gs-${node.id}`, x1: cardCX, y1: y + cardH, x2: cardCX, y2: elbowY });
  if (cols === 1) {
    lines.push({ key: `gd-${node.id}-0`, x1: colCXs[0], y1: elbowY, x2: colCXs[0], y2: gridTopY });
  } else {
    lines.push({ key: `gh-${node.id}`, x1: colCXs[0], y1: elbowY, x2: colCXs[cols - 1], y2: elbowY });
    for (let ci = 0; ci < cols; ci++) {
      lines.push({ key: `gd-${node.id}-${ci}`, x1: colCXs[ci], y1: elbowY, x2: colCXs[ci], y2: gridTopY });
    }
  }

  // ── Render each direct child in its computed cell position ────────────────
  for (let i = 0; i < children.length; i++) {
    const col   = i % cols;
    const row   = Math.floor(i / cols);
    // Centre the child card within its column width
    const cellX = colX[col] + (colWidths[col] - cardW) / 2;
    const cellY = rowY[row];

    const child            = children[i];
    const childExpanded    = expandedSet.has(child.id);
    const childHasChildren = child.children && child.children.length > 0;

    if (childExpanded && childHasChildren) {
      renderGridNode(
        child, colX[col], cellY, expandedSet,
        onToggle, onDelete, onColorChange,
        nodeColors, selectedToolbarColor, isViewer,
        lc, lt, onFocus,
        cards, lines,
        cardW, cardH,
        nodeVisibility,
        sortType,
        designationOrder,
        onNodeClick,
      );
    } else {
      // Leaf or collapsed — just place the card
      cards.push(
        <LayoutNodeCard
          key={child.id}
          node={child}
          x={cellX}
          y={cellY}
          isExpanded={false}
          hasChildren={childHasChildren}
          onToggle={onToggle}
          onDelete={onDelete}
          onColorChange={onColorChange}
          nodeColor={nodeColors[child.id] || child.node_color || null}
          selectedToolbarColor={selectedToolbarColor}
          isViewer={isViewer}
          onFocus={onFocus}
          cardW={cardW}
          cardH={cardH}
          nodeVisibility={nodeVisibility}
          onNodeClick={onNodeClick}
        />,
      );
    }
  }
}

/** Measure total canvas dimensions for all root blocks. */
function measureGridCanvas(roots, expandedSet, padding, cardW, cardH, sortType, designationOrder) {
  let totalW = padding;
  let maxH   = 0;
  for (const root of roots) {
    totalW += gridBlockWidth(root, expandedSet, cardW, sortType, designationOrder) + padding;
    maxH = Math.max(maxH, gridBlockHeight(root, expandedSet, cardH, sortType, designationOrder));
  }
  return {
    width:  Math.max(totalW, 400),
    height: Math.max(maxH + padding * 2, 300),
  };
}

export function GridLayoutCanvas({
  roots, expandedSet, onToggle, onDelete, onColorChange,
  nodeColors = {}, lineColor = '#94a3b8', lineThickness = 2,
  selectedToolbarColor = null, isViewer = false, onFocus = null,
  sortType = 'default',
  designationOrder = null,
  cardW = CARD_W, cardH = CARD_H, nodeVisibility = null,
  onNodeClick = null,
}) {
  const cards   = [];
  const lines   = [];
  const padding = 48;
  const lc      = lineColor;
  const lt      = lineThickness;

  let currentX = padding;
  for (const root of roots) {
    const bw = gridBlockWidth(root, expandedSet, cardW, sortType, designationOrder);
    renderGridNode(
      root, currentX, padding, expandedSet,
      onToggle, onDelete, onColorChange,
      nodeColors, selectedToolbarColor, isViewer,
      lc, lt, onFocus,
      cards, lines,
      cardW, cardH,
      nodeVisibility,
      sortType,
      designationOrder,
      onNodeClick,
    );
    currentX += bw + padding;
  }

  const { width: totalW, height: totalH } = measureGridCanvas(roots, expandedSet, padding, cardW, cardH, sortType, designationOrder);

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={totalW}
        height={totalH}
        style={{ zIndex: 1 }}
      >
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={lc} strokeWidth={lt} strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute" style={{ left: 0, top: 0, width: 0, height: 0 }}>
        {cards}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT 2 — TEMPLATE BRANCH LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * TemplateBranchCanvas
 *
 * Visual style inspired by the hand-drawn template:
 *   - Root card at the top
 *   - Shared horizontal connector under the root
 *   - Each direct report gets its own vertical branch column
 *   - Deeper levels render as stacked branch cards with elbows
 *
 * This keeps the existing data, expand/collapse, color, export and share flows
 * untouched while adding a second "template" way to represent the same chart.
 */

const TB_ROOT_COL_GAP   = 56;
const TB_ROOT_ROW_GAP   = 72;
const TB_BRANCH_INDENT  = 34;
const TB_BRANCH_GAP_Y   = 24;
const TB_CARD_STUB      = 22;
const TB_PADDING        = 48;
const TB_ROOT_STUB_Y    = 28;
const TB_BUS_TO_COL_Y   = 40;
const TB_COL_ROW_GAP    = 28;
const TB_MAX_COLS       = 4;

function computeTemplateCols(count) {
  if (count <= 0) return 1;
  return Math.min(TB_MAX_COLS, Math.max(1, Math.ceil(Math.sqrt(count))));
}

function templateRootLayout(node, expandedSet, cardW, cardH, sortType, designationOrder) {
  const children = sortChildrenByDesignation(node.children || [], sortType, designationOrder);
  const cols = computeTemplateCols(children.length);
  const colNodes = Array.from({ length: cols }, () => []);
  const colHeightsNow = Array.from({ length: cols }, () => 0);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const size = templateBranchSize(child, expandedSet, cardW, cardH, sortType, designationOrder);
    let best = 0;
    for (let c = 1; c < cols; c++) {
      if (colHeightsNow[c] < colHeightsNow[best]) best = c;
    }
    colNodes[best].push(child);
    colHeightsNow[best] += size.height + (colNodes[best].length > 1 ? TB_COL_ROW_GAP : 0);
  }

  const colWidths = colNodes.map((list) => {
    if (list.length === 0) return TB_CARD_STUB + cardW;
    return Math.max(...list.map((c) => templateBranchSize(c, expandedSet, cardW, cardH, sortType, designationOrder).width));
  });
  const colHeights = colNodes.map((list) => {
    if (list.length === 0) return 0;
    const sizes = list.map((c) => templateBranchSize(c, expandedSet, cardW, cardH, sortType, designationOrder));
    return sizes.reduce((sum, s) => sum + s.height, 0) + TB_COL_ROW_GAP * Math.max(0, sizes.length - 1);
  });
  const gridW = colWidths.reduce((sum, w) => sum + w, 0) + TB_ROOT_COL_GAP * Math.max(0, cols - 1);

  return { cols, colNodes, colWidths, colHeights, gridW };
}

function templateBranchSize(node, expandedSet, cardW, cardH, sortType, designationOrder) {
  const isExpanded = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const baseWidth = TB_CARD_STUB + cardW;

  if (!isExpanded || !hasChildren) {
    return { width: baseWidth, height: cardH };
  }

  const children = sortChildrenByDesignation(node.children || [], sortType, designationOrder);
  const childSizes = children.map((child) => templateBranchSize(child, expandedSet, cardW, cardH, sortType, designationOrder));
  const childrenHeight =
    childSizes.reduce((sum, size) => sum + size.height, 0) +
    TB_BRANCH_GAP_Y * Math.max(0, childSizes.length - 1);
  const childrenWidth = Math.max(...childSizes.map((size) => size.width));

  return {
    width: Math.max(baseWidth, TB_BRANCH_INDENT + childrenWidth),
    height: cardH + TB_BRANCH_GAP_Y + childrenHeight,
  };
}

function templateRootSize(node, expandedSet, cardW, cardH, sortType, designationOrder) {
  const isExpanded = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  if (!isExpanded || !hasChildren) {
    return { width: cardW, height: cardH };
  }

  const layout = templateRootLayout(node, expandedSet, cardW, cardH, sortType, designationOrder);

  return {
    width: Math.max(cardW, layout.gridW),
    height: cardH + TB_ROOT_STUB_Y + TB_BUS_TO_COL_Y + Math.max(...layout.colHeights, 0),
  };
}

export function measureTemplateCanvas(roots, expandedSet, cardW = CARD_W, cardH = CARD_H, sortType = 'default', designationOrder = null) {
  if (!roots.length) return { width: 0, height: 0 };

  const rootSizes = roots.map((root) => templateRootSize(root, expandedSet, cardW, cardH, sortType, designationOrder));
  const width =
    rootSizes.reduce((sum, size) => sum + size.width, 0) +
    TB_PADDING * (roots.length + 1);
  const height = Math.max(...rootSizes.map((size) => size.height)) + TB_PADDING * 2;

  return {
    width: Math.max(width, 400),
    height: Math.max(height, 300),
  };
}

function renderTemplateBranch(
  node, x, y, expandedSet,
  onToggle, onDelete, onColorChange,
  nodeColors, selectedToolbarColor, isViewer,
  onFocus,
  cards, lines,
  cardW, cardH,
  nodeVisibility,
  sortType,
  designationOrder,
  onNodeClick = null,
) {
  const isExpanded = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  const cardX = x + TB_CARD_STUB;
  const cardY = y;
  const cardMidY = cardY + cardH / 2;
  const trunkX = x;

  cards.push(
    <LayoutNodeCard
      key={node.id}
      node={node}
      x={cardX}
      y={cardY}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      onToggle={onToggle}
      onDelete={onDelete}
      onColorChange={onColorChange}
      nodeColor={nodeColors[node.id] || node.node_color || null}
      selectedToolbarColor={selectedToolbarColor}
      isViewer={isViewer}
      onFocus={onFocus}
      cardW={cardW}
      cardH={cardH}
      nodeVisibility={nodeVisibility}
      onNodeClick={onNodeClick}
    />,
  );

  lines.push({
    key: `tb-stub-${node.id}`,
    x1: trunkX,
    y1: cardMidY,
    x2: cardX,
    y2: cardMidY,
  });

  if (!isExpanded || !hasChildren) return;

  const childX = x + TB_BRANCH_INDENT;
  const children = sortChildrenByDesignation(node.children || [], sortType, designationOrder);
  const childSizes = children.map((child) => templateBranchSize(child, expandedSet, cardW, cardH, sortType, designationOrder));
  const childStartY = y + cardH + TB_BRANCH_GAP_Y;
  const childMidYs = [];
  let currentY = childStartY;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    childMidYs.push(currentY + cardH / 2);
    renderTemplateBranch(
      child, childX, currentY, expandedSet,
      onToggle, onDelete, onColorChange,
      nodeColors, selectedToolbarColor, isViewer,
      onFocus,
      cards, lines,
      cardW, cardH,
      nodeVisibility,
      sortType,
      designationOrder,
      onNodeClick,
    );
    currentY += childSizes[i].height + TB_BRANCH_GAP_Y;
  }

  lines.push({
    key: `tb-vertical-${node.id}`,
    x1: trunkX,
    y1: cardMidY,
    x2: trunkX,
    y2: childMidYs[childMidYs.length - 1],
  });

  for (let i = 0; i < node.children.length; i++) {
    lines.push({
      key: `tb-child-${node.id}-${i}`,
      x1: trunkX,
      y1: childMidYs[i],
      x2: childX,
      y2: childMidYs[i],
    });
  }
}

function renderTemplateRoot(
  node, x, y, expandedSet,
  onToggle, onDelete, onColorChange,
  nodeColors, selectedToolbarColor, isViewer,
  onFocus,
  cards, lines,
  cardW, cardH,
  nodeVisibility,
  sortType,
  designationOrder,
  onNodeClick = null,
) {
  const isExpanded = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const rootSize = templateRootSize(node, expandedSet, cardW, cardH);
  const rootCardX = x + (rootSize.width - cardW) / 2;
  const rootCenterX = rootCardX + cardW / 2;

  cards.push(
    <LayoutNodeCard
      key={node.id}
      node={node}
      x={rootCardX}
      y={y}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      onToggle={onToggle}
      onDelete={onDelete}
      onColorChange={onColorChange}
      nodeColor={nodeColors[node.id] || node.node_color || null}
      selectedToolbarColor={selectedToolbarColor}
      isViewer={isViewer}
      onFocus={onFocus}
      cardW={cardW}
      cardH={cardH}
      nodeVisibility={nodeVisibility}
      onNodeClick={onNodeClick}
    />,
  );

  if (!isExpanded || !hasChildren) return;

  const layout = templateRootLayout(node, expandedSet, cardW, cardH, sortType, designationOrder);
  const colStartX = x + (rootSize.width - layout.gridW) / 2;
  const busY = y + cardH + TB_ROOT_STUB_Y;
  const firstRowY = busY + TB_BUS_TO_COL_Y;

  const trunkXs = [];
  let tx = colStartX;
  for (let ci = 0; ci < layout.cols; ci++) {
    trunkXs.push(tx);
    tx += layout.colWidths[ci] + TB_ROOT_COL_GAP;
  }

  lines.push({
    key: `tb-root-stub-${node.id}`,
    x1: rootCenterX,
    y1: y + cardH,
    x2: rootCenterX,
    y2: busY,
  });

  const busMinX = Math.min(...trunkXs);
  const busMaxX = Math.max(...trunkXs);
  lines.push({
    key: `tb-root-bus-${node.id}`,
    x1: Math.min(rootCenterX, busMinX),
    y1: busY,
    x2: Math.max(rootCenterX, busMaxX),
    y2: busY,
  });

  for (let ci = 0; ci < layout.cols; ci++) {
    const trunkX = trunkXs[ci];
    const colNodes = layout.colNodes[ci];
    if (colNodes.length === 0) continue;

    const sizes = colNodes.map((c) => templateBranchSize(c, expandedSet, cardW, cardH));
    const childMidYs = [];
    let currentY = firstRowY;
    for (let ri = 0; ri < colNodes.length; ri++) {
      childMidYs.push(currentY + cardH / 2);
      currentY += sizes[ri].height + TB_COL_ROW_GAP;
    }
    const firstMidY = childMidYs[0];
    const lastMidY = childMidYs[childMidYs.length - 1];

    lines.push({
      key: `tb-root-drop-${node.id}-${ci}`,
      x1: trunkX,
      y1: busY,
      x2: trunkX,
      y2: firstMidY,
    });

    lines.push({
      key: `tb-col-trunk-${node.id}-${ci}`,
      x1: trunkX,
      y1: firstMidY,
      x2: trunkX,
      y2: lastMidY,
    });

    let childY = firstRowY;
    for (let ri = 0; ri < colNodes.length; ri++) {
      const child = colNodes[ri];
      renderTemplateBranch(
        child, trunkX, childY, expandedSet,
        onToggle, onDelete, onColorChange,
        nodeColors, selectedToolbarColor, isViewer,
        onFocus,
        cards, lines,
        cardW, cardH,
        nodeVisibility,
        sortType,
        designationOrder,
        onNodeClick,
      );
      childY += sizes[ri].height + TB_COL_ROW_GAP;
    }
  }
}

export function TemplateBranchCanvas({
  roots, expandedSet, onToggle, onDelete, onColorChange,
  nodeColors = {}, lineColor = '#94a3b8', lineThickness = 2,
  selectedToolbarColor = null, isViewer = false, onFocus = null,
  sortType = 'default',
  designationOrder = null,
  cardW = CARD_W, cardH = CARD_H, nodeVisibility = null,
  onNodeClick = null,
}) {
  const cards = [];
  const lines = [];
  const { width: canvasW, height: canvasH } = measureTemplateCanvas(roots, expandedSet, cardW, cardH, sortType, designationOrder);
  const rootSizes = roots.map((root) => templateRootSize(root, expandedSet, cardW, cardH, sortType, designationOrder));

  let currentX = TB_PADDING;
  for (let i = 0; i < roots.length; i++) {
    renderTemplateRoot(
      roots[i], currentX, TB_PADDING, expandedSet,
      onToggle, onDelete, onColorChange,
      nodeColors, selectedToolbarColor, isViewer,
      onFocus,
      cards, lines,
      cardW, cardH,
      nodeVisibility,
      sortType,
      designationOrder,
      onNodeClick,
    );
    currentX += rootSizes[i].width + TB_PADDING;
  }

  return (
    <div className="relative" style={{ width: canvasW, height: canvasH }}>
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={canvasW}
        height={canvasH}
        style={{ zIndex: 1 }}
      >
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={lineColor}
            strokeWidth={lineThickness}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute" style={{ left: 0, top: 0, width: 0, height: 0 }}>
        {cards}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT 3 — VERTICAL HIERARCHICAL TREE
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Vertical Hierarchical Tree:
 *   - Same hierarchy as the existing Hierarchical Tree.
 *   - Children are centered directly below their parent.
 *   - Uses the SAME subtreeWidth / measureCanvas / elbow connector algorithm
 *     as the existing layout — it IS the existing layout.
 *
 * The only visual difference from the standard "Hierarchical Tree":
 *   - Uses a slightly larger V_GAP (80px vs 60px) to make vertical chains clearer.
 *   - Children are always stacked downward.
 *   - The algorithm is literally the same as the existing one — this layout
 *     is offered as a distinct selection for users who want more vertical breathing room
 *     and a "strictly top-down" feel for presentations.
 *
 * Implementation: Re-implements subtreeWidth+renderTree with the adjusted V_GAP
 * so the existing OrgTreeCanvas is completely untouched.
 */

const VT_H_GAP = 40;   // slightly wider horizontal gap than default (36)
const VT_V_GAP = 80;   // taller vertical gap than default (60) for "vertical" feel

function vtSubtreeWidth(node, expandedSet, cardW) {
  if (!expandedSet.has(node.id) || !node.children || node.children.length === 0) return cardW;
  const cw = node.children.map((c) => vtSubtreeWidth(c, expandedSet, cardW));
  return Math.max(cardW, cw.reduce((s, w) => s + w, 0) + VT_H_GAP * (node.children.length - 1));
}

function vtMeasureCanvas(roots, expandedSet, cardW, cardH) {
  if (roots.length === 0) return { width: 0, height: 0 };
  const rw  = roots.map((r) => vtSubtreeWidth(r, expandedSet, cardW));
  const totalW = rw.reduce((s, w) => s + w, 0) + VT_H_GAP * (roots.length - 1);
  function h(node) {
    if (!expandedSet.has(node.id) || !node.children || !node.children.length) return cardH;
    return cardH + VT_V_GAP + Math.max(...node.children.map(h));
  }
  return {
    width:  Math.max(totalW, 400),
    height: Math.max(Math.max(...roots.map(h)) + 60, 300),
  };
}

function vtRenderTree(
  node, x, y, expandedSet,
  onToggle, onDelete, onColorChange,
  nodeColors, selectedToolbarColor, isViewer,
  onFocus,
  cards, lines,
  sortType,
  designationOrder,
  cardW, cardH,
  nodeVisibility,
  onNodeClick = null,
) {
  const isExpanded  = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  cards.push(
    <LayoutNodeCard
      key={node.id}
      node={node}
      x={x - cardW / 2}
      y={y}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      onToggle={onToggle}
      onDelete={onDelete}
      onColorChange={onColorChange}
      nodeColor={nodeColors[node.id] || node.node_color || null}
      selectedToolbarColor={selectedToolbarColor}
      isViewer={isViewer}
      onFocus={onFocus}
      cardW={cardW}
      cardH={cardH}
      nodeVisibility={nodeVisibility}
      onNodeClick={onNodeClick}
    />,
  );

  if (!isExpanded || !hasChildren) return;

  const children = sortChildrenByDesignation(node.children || [], sortType, designationOrder);
  const cw  = children.map((c) => vtSubtreeWidth(c, expandedSet, cardW));
  const tot = cw.reduce((s, w) => s + w, 0) + VT_H_GAP * (children.length - 1);
  const cy  = y + cardH + VT_V_GAP;
  const cx  = [];
  let rx = x - tot / 2;
  for (let i = 0; i < children.length; i++) {
    cx.push(rx + cw[i] / 2);
    rx += cw[i] + VT_H_GAP;
  }

  const pbx = x;
  const pby = y + cardH;

  if (children.length === 1) {
    lines.push({ key: `vt-v-${node.id}-0`, x1: pbx, y1: pby, x2: pbx, y2: cy });
  } else {
    const ey = pby + VT_V_GAP / 2;
    lines.push({ key: `vt-stub-${node.id}`, x1: pbx,    y1: pby, x2: pbx,              y2: ey });
    lines.push({ key: `vt-hbar-${node.id}`, x1: cx[0],  y1: ey,  x2: cx[cx.length - 1], y2: ey });
    for (let i = 0; i < cx.length; i++) {
      lines.push({ key: `vt-drop-${node.id}-${i}`, x1: cx[i], y1: ey, x2: cx[i], y2: cy });
    }
  }

  for (let i = 0; i < children.length; i++) {
    vtRenderTree(
      children[i], cx[i], cy, expandedSet,
      onToggle, onDelete, onColorChange,
      nodeColors, selectedToolbarColor, isViewer,
      onFocus,
      cards, lines,
      sortType,
      designationOrder,
      cardW, cardH,
      nodeVisibility,
      onNodeClick,
    );
  }
}

export function VerticalTreeCanvas({
  roots, expandedSet, onToggle, onDelete, onColorChange,
  nodeColors = {}, lineColor = '#94a3b8', lineThickness = 2,
  selectedToolbarColor = null, isViewer = false, onFocus = null,
  sortType = 'default',
  designationOrder = null,
  cardW = CARD_W, cardH = CARD_H, nodeVisibility = null,
  onNodeClick = null,
}) {
  const cards = [];
  const lines = [];
  const lc = lineColor;
  const lt = lineThickness;

  if (roots.length > 0) {
    const rw    = roots.map((r) => vtSubtreeWidth(r, expandedSet, cardW));
    const totalW = rw.reduce((s, w) => s + w, 0) + VT_H_GAP * (roots.length - 1);
    let rx = -totalW / 2;
    for (let i = 0; i < roots.length; i++) {
      vtRenderTree(
        roots[i], rx + rw[i] / 2, 0, expandedSet,
        onToggle, onDelete, onColorChange,
        nodeColors, selectedToolbarColor, isViewer,
        onFocus,
        cards, lines,
        sortType,
        designationOrder,
        cardW, cardH,
        nodeVisibility,
        onNodeClick,
      );
      rx += rw[i] + VT_H_GAP;
    }
  }

  const { width: canvasW, height: canvasH } = vtMeasureCanvas(roots, expandedSet, cardW, cardH);
  const padding = 48;

  return (
    <div className="relative" style={{ width: canvasW + padding * 2, height: canvasH + padding * 2 }}>
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={canvasW + padding * 2}
        height={canvasH + padding * 2}
        style={{ zIndex: 1 }}
      >
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1 + canvasW / 2 + padding} y1={l.y1 + padding}
            x2={l.x2 + canvasW / 2 + padding} y2={l.y2 + padding}
            stroke={lc} strokeWidth={lt} strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute" style={{ left: canvasW / 2 + padding, top: padding, width: 0, height: 0 }}>
        {cards}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT 4 — DESIGNATION COLUMN LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * DesignationColumnCanvas  (redesigned — no designation header boxes)
 *
 * Visual model:
 *   - Manager card sits at the top, exactly like every other layout.
 *   - A single horizontal line fans out below the manager to each column.
 *   - One column per unique designation among direct reports.
 *   - Only employee cards are visible — NO designation header boxes, containers
 *     or group panels. The designation text already lives inside each card.
 *   - Employees with no designation share an implicit last column.
 *   - Columns are sorted A→Z by designation label; the no-designation column
 *     is always last.
 *   - Within each column employees are sorted A→Z by name.
 *   - Sub-managers (direct reports who themselves have children) get their own
 *     DesigManagerBlock rendered below the columns row, indented one level.
 *   - All existing props (nodeColors, onToggle, onDelete, onColorChange,
 *     onFocus, isViewer, selectedToolbarColor) pass through unchanged.
 *   - Pure HTML/CSS — no absolute canvas maths — so Export PNG/PDF captures
 *     exactly what is visible on screen.
 */

// ── Column-grouping helpers ───────────────────────────────────────────────────

/** Returns unique designation labels from a node list, sorted A→Z by default.
 *  If `customOrder` is provided, designations found in that list are placed first
 *  (in the exact order given). Remaining designations follow A→Z.
 *  Nodes with no designation map to the label '' which is always last. */
function collectDesignations(nodes, customOrder = null) {
  // Map normalized -> original label (first seen wins)
  const normToLabel = new Map();
  let hasNone = false;
  for (const n of nodes) {
    const raw = (n.designation || '').trim();
    if (!raw) { hasNone = true; continue; }
    const norm = raw.toLowerCase();
    if (!normToLabel.has(norm)) normToLabel.set(norm, raw);
  }

  const remainingNorms = new Set(normToLabel.keys());
  const ordered = [];

  if (Array.isArray(customOrder) && customOrder.length > 0) {
    for (const item of customOrder) {
      const norm = String(item || '').trim().toLowerCase();
      if (!norm) continue;
      if (remainingNorms.has(norm)) {
        ordered.push(normToLabel.get(norm));
        remainingNorms.delete(norm);
      }
    }
  }

  const rest = Array.from(remainingNorms)
    .map((n) => normToLabel.get(n))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const out = ordered.concat(rest);
  if (hasNone) out.push(''); // no-designation column last
  return out;
}

// ── Inline employee card — no absolute positioning, flow layout ──────────────
// Identical visual to LayoutNodeCard (same accent, colours, icons) but uses
// inline-block / flex so it stacks cleanly inside a CSS column.
function DesigNodeCard({
  node, onToggle, onDelete, onColorChange,
  nodeColors, selectedToolbarColor, isViewer, onFocus, expandedSet,
  cardW = CARD_W, cardH = CARD_H, nodeVisibility = null,
  onNodeClick = null,
}) {
  const vis         = nodeVisibility || DEFAULT_NODE_VISIBILITY;
  const nodeColor   = nodeColors[node.id] || node.node_color || null;
  const isColorized = !!nodeColor;
  const accent      = isColorized ? nodeColor : deptColor(node.department);
  const textClr     = '#1e3a5f';
  const subClr      = '#475569';
  const deptClr2    = accent;
  const hasChildren = !!(node.children && node.children.length > 0);
  const isExpanded  = expandedSet.has(node.id);

  const showPhoto   = vis.showPhoto;
  const photoUrl    = node.photo_url;
  const initials    = getInitials(node.name);
  const avatarColor = avatarBgColor(node.name);

  return (
    /* wrapper: gives room below for the expand button without overlapping the
       next card; position:relative lets the button sit on the boundary */
    <div style={{ position: 'relative', width: cardW, flexShrink: 0, marginBottom: hasChildren ? 14 : 0 }}>
      <div style={{
        width: cardW, height: cardH,
        borderRadius: 8, overflow: 'hidden', display: 'flex',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'relative',
        cursor: onNodeClick && !isViewer ? 'pointer' : 'default',
      }}
        onClick={onNodeClick && !isViewer ? (e) => { e.stopPropagation(); onNodeClick(node, e); } : undefined}
        onDoubleClick={onFocus && !isViewer ? (e) => { e.stopPropagation(); onFocus(node); } : undefined}
        title={onNodeClick && !isViewer ? 'Click for options' : undefined}
      >
        <div style={{ width: 5, flexShrink: 0, background: accent }} />
        <div style={{ flex: 1, padding: '7px 9px', minWidth: 0, position: 'relative', paddingRight: showPhoto ? 32 : 9, paddingBottom: hasChildren ? 18 : 7 }}>
          {vis.showName && (
            <p style={{ fontWeight: 700, fontSize: 12, color: textClr, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>
              {node.name}
            </p>
          )}
          {vis.showDesignation && node.designation && (
            <p style={{ fontSize: 11, color: subClr, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.designation}</p>
          )}
          {vis.showDepartment && node.department && (
            <p style={{ fontSize: 11, color: deptClr2, fontWeight: 500, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.department}</p>
          )}
          {vis.showEmployeeId && (
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{node.employee_id}</p>
          )}

          {hasChildren && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); (onFocus && !isViewer ? onFocus(node) : onToggle(node.id)); }}
              style={{
                position: 'absolute',
                bottom: 3,
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: 22,
                height: 18,
                padding: '0 6px',
                borderRadius: 9999,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
                zIndex: 20,
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
              data-export-exclude
            >
              {node.children?.length ?? 0}
            </button>
          )}

          {!isViewer && (
            <>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onColorChange(node.id, selectedToolbarColor || null); }}
                style={{ position: 'absolute', top: 3, right: 22, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={selectedToolbarColor ? `Apply ${selectedToolbarColor}` : 'Select a color first'}
                data-export-exclude>
                <Palette style={{ width: 11, height: 11 }} />
              </button>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}
                style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Delete employee"
                data-export-exclude>
                <Trash2 style={{ width: 11, height: 11 }} />
              </button>
            </>
          )}
        </div>

        {/* Photo — top-right inside card */}
        {showPhoto && (
          <div style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 24,
            height: 24,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            zIndex: 5,
          }}>
            {photoUrl ? (
              <img src={photoUrl} alt={node.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 8, fontWeight: 700,
              }}>
                {initials}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SVG connector: manager-bottom → horizontal bar → drop-line to each col ───
const DC_COL_GAP  = 16;  // px gap between columns
const DC_ROW_GAP  = 56;  // px gap: manager card bottom → first row of employee cards
const DC_STUB     = 20;  // px: vertical stub below manager before horizontal bar

/**
 * DesigConnectorSvg
 *
 * All coordinates are relative to the containing block whose left edge = 0.
 * The SVG is absolutely positioned at top:0 left:0 of that block and sized
 * to cover the full block width, so it always spans every column.
 *
 * @param blockW      — total width of the DesigManagerBlock div
 * @param managerOffX — left-offset of the manager card within the block
 *                      (= (blockW - CARD_W) / 2 when columns > card width)
 * @param colsOffX    — left-offset of the first column within the block
 *                      (= Math.max(0, colsStartX) — same value used for marginLeft)
 * @param colCentresRel — column centre positions relative to the columns row origin
 * @param managerBottom — Y of the bottom of the manager card
 */
function DesigConnectorSvg({ blockW, managerOffX, colsOffX, colCentresRel, managerBottom, cardW = CARD_W }) {
  if (colCentresRel.length === 0) return null;

  // Absolute column centres within the block
  const cCXs  = colCentresRel.map((cx) => colsOffX + cx);
  const minCX = Math.min(...cCXs);
  const maxCX = Math.max(...cCXs);
  // Manager card centre within the block
  const mCX   = managerOffX + cardW / 2;

  const stubY   = managerBottom + DC_STUB;
  const dropToY = managerBottom + DC_ROW_GAP;

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: blockW, height: dropToY + 2,
        pointerEvents: 'none', overflow: 'visible',
      }}
      width={blockW}
      height={dropToY + 2}
    >
      {/* vertical stub from manager bottom down to elbow */}
      <line x1={mCX} y1={managerBottom} x2={mCX} y2={stubY}
        stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />

      {cCXs.length === 1 ? (
        /* single column — straight line from stub to column centre */
        <line x1={mCX} y1={stubY} x2={cCXs[0]} y2={dropToY}
          stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
      ) : (
        <>
          {/* horizontal bar spanning ALL column centres */}
          <line x1={minCX} y1={stubY} x2={maxCX} y2={stubY}
            stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
          {/* drop from each column centre down to the card row */}
          {cCXs.map((cx, i) => (
            <line key={i} x1={cx} y1={stubY} x2={cx} y2={dropToY}
              stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
          ))}
        </>
      )}
    </svg>
  );
}

/**
 * Recursive block for one manager node in Designation Column Layout.
 *
 * Structure:
 *   [Manager card]            ← top, same card style as all other layouts
 *        │  (SVG elbow lines)
 *   [col1]  [col2]  [col3]   ← employee cards only, no designation headers
 *   [EmpA]  [EmpB]  [EmpC]
 *   [EmpD]          [EmpE]
 *
 *   If any direct report is itself a manager, it appears in its designation
 *   column AND a sub-section "Managers in this team" renders below with each
 *   sub-manager's own DesigManagerBlock (recursive, indented).
 */
function DesigManagerBlock({
  node, expandedSet, onToggle,
  onDelete, onColorChange, nodeColors, selectedToolbarColor,
  isViewer, onFocus, depth,
  cardW = CARD_W, cardH = CARD_H, nodeVisibility = null,
  designationOrder = null,
  onNodeClick = null,
}) {
  const vis         = nodeVisibility || DEFAULT_NODE_VISIBILITY;
  const isExpanded  = expandedSet.has(node.id);
  const hasChildren = !!(node.children && node.children.length > 0);
  const allReports  = isExpanded && hasChildren ? (node.children || []) : [];

  // ── Build designation columns ──────────────────────────────────────────────
  const designations = collectDesignations(allReports, designationOrder);
  const byDesig      = new Map();
  for (const d of designations) byDesig.set(d, []);
  for (const emp of allReports) {
    const key = (emp.designation || '').trim();
    byDesig.get(key).push(emp);
  }
  for (const members of byDesig.values()) {
    members.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  const subManagers = allReports.filter((c) => c.children && c.children.length > 0);

  // ── Manager card styling ───────────────────────────────────────────────────
  const nodeColor   = nodeColors[node.id] || node.node_color || null;
  const isColorized = !!nodeColor;
  const accent      = isColorized ? nodeColor : deptColor(node.department);
  const textClr     = '#1e3a5f';
  const subClr      = '#475569';
  const deptClr2    = accent;

  // Photo
  const showPhoto   = vis.showPhoto;
  const photoUrl    = node.photo_url;
  const initials    = getInitials(node.name);
  const avatarColor = avatarBgColor(node.name);

  // For connector geometry: manager card centre-x (relative to this block's left=0)
  const managerCX     = cardW / 2;
  const numCols       = designations.length;
  const totalColsW    = numCols * cardW + Math.max(0, numCols - 1) * DC_COL_GAP;
  // Centre columns under manager
  const colsStartX    = managerCX - totalColsW / 2;
  const colCentres    = designations.map((_, i) => colsStartX + i * (cardW + DC_COL_GAP) + cardW / 2);
  // The overall block needs to be wide enough to hold columns
  const blockW        = Math.max(cardW, totalColsW);

  return (
    <div style={{
      position: 'relative',
      // width of block = max(managerCard, all columns side by side)
      width: blockW,
      marginLeft: depth > 0 ? 20 : 0,
      marginTop:  depth > 0 ? 20 : 0,
    }}>
      {/* ── Manager card — centred in the block ───────────────────────────── */}
      <div style={{ position: 'relative', width: cardW, marginLeft: (blockW - cardW) / 2 }}>
        <div style={{
          width: cardW, height: cardH,
          borderRadius: 8, overflow: 'hidden', display: 'flex',
          border: `2px solid ${accent}`,
          background: '#ffffff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
          position: 'relative',
          cursor: onNodeClick && !isViewer ? 'pointer' : 'default',
        }}
          onClick={onNodeClick && !isViewer ? (e) => { e.stopPropagation(); onNodeClick(node, e); } : undefined}
          onDoubleClick={onFocus && !isViewer ? (e) => { e.stopPropagation(); onFocus(node); } : undefined}
          title={onNodeClick && !isViewer ? 'Click for options' : undefined}
        >
          <div style={{ width: 5, flexShrink: 0, background: accent }} />
          <div style={{ flex: 1, padding: '7px 9px', minWidth: 0, position: 'relative', paddingRight: showPhoto ? 32 : 9, paddingBottom: hasChildren ? 18 : 7 }}>
            {vis.showName && (
              <p style={{ fontWeight: 700, fontSize: 12, color: textClr, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>{node.name}</p>
            )}
            {vis.showDesignation && node.designation && (
              <p style={{ fontSize: 11, color: subClr, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.designation}</p>
            )}
            {vis.showDepartment && node.department && (
              <p style={{ fontSize: 11, color: deptClr2, fontWeight: 500, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.department}</p>
            )}
            {vis.showEmployeeId && (
              <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{node.employee_id}</p>
            )}

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); (onFocus && !isViewer ? onFocus(node) : onToggle(node.id)); }}
                style={{
                  position: 'absolute',
                  bottom: 3,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  minWidth: 22,
                  height: 18,
                  padding: '0 6px',
                  borderRadius: 9999,
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
                  zIndex: 20,
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
                data-export-exclude
              >
                {node.children?.length ?? 0}
              </button>
            )}

            {!isViewer && (
              <>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onColorChange(node.id, selectedToolbarColor || null); }}
                  style={{ position: 'absolute', top: 3, right: 22, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={selectedToolbarColor ? `Apply ${selectedToolbarColor}` : 'Select a color first'}
                  data-export-exclude>
                  <Palette style={{ width: 11, height: 11 }} />
                </button>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}
                  style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Delete employee"
                  data-export-exclude>
                  <Trash2 style={{ width: 11, height: 11 }} />
                </button>
              </>
            )}
          </div>

          {/* Photo */}
          {showPhoto && (
            <div style={{
              position: 'absolute', top: 4, right: 4,
              width: 24, height: 24,
              borderRadius: '50%', overflow: 'hidden',
              border: '1px solid #e2e8f0', zIndex: 5,
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt={node.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%', background: avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 8, fontWeight: 700,
                }}>
                  {initials}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SVG elbow connectors (only when expanded) ─────────────────────── */}
      {isExpanded && numCols > 0 && (
        <DesigConnectorSvg
          blockW={blockW}
          managerOffX={(blockW - cardW) / 2}
          colsOffX={Math.max(0, colsStartX)}
          colCentresRel={designations.map((_, i) => i * (cardW + DC_COL_GAP) + cardW / 2)}
          managerBottom={cardH}
          cardW={cardW}
        />
      )}

      {/* ── Employee columns — NO designation headers, only cards ─────────── */}
      {isExpanded && numCols > 0 && (
        <div style={{
          position: 'relative',
          marginTop: DC_ROW_GAP,
          overflowX: 'auto',
          paddingBottom: 4,
        }}>
          <div style={{
            display: 'flex',
            gap: DC_COL_GAP,
            alignItems: 'flex-start',
            minWidth: 'max-content',
            // When columns are wider than manager card, colsStartX is the correct
            // left offset (it's ≥ 0 in that case because blockW = totalColsW).
            // When manager card is wider, colsStartX centres the columns under it.
            marginLeft: Math.max(0, colsStartX),
          }}>
            {designations.map((desig) => {
              const members = byDesig.get(desig) || [];
              return (
                /* one column = just stacked DesigNodeCards, gap between them */
                <div key={desig || '__none__'} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  width: cardW,
                  flexShrink: 0,
                }}>
                  {members.map((m) => (
                    <DesigNodeCard
                      key={m.id}
                      node={m}
                      onToggle={onToggle}
                      onDelete={onDelete}
                      onColorChange={onColorChange}
                      nodeColors={nodeColors}
                      selectedToolbarColor={selectedToolbarColor}
                      isViewer={isViewer}
                      onFocus={onFocus}
                      expandedSet={expandedSet}
                      cardW={cardW}
                      cardH={cardH}
                      nodeVisibility={nodeVisibility}
                      onNodeClick={onNodeClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sub-manager blocks — recursive, shown below the columns row ────── */}
      {isExpanded && subManagers.length > 0 && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Managers in this team
          </div>
          {subManagers.map((mgr) => (
            <DesigManagerBlock
              key={mgr.id}
              node={mgr}
              expandedSet={expandedSet}
              onToggle={onToggle}
              onDelete={onDelete}
              onColorChange={onColorChange}
              nodeColors={nodeColors}
              selectedToolbarColor={selectedToolbarColor}
              isViewer={isViewer}
              onFocus={onFocus}
              depth={depth + 1}
              cardW={cardW}
              cardH={cardH}
              nodeVisibility={nodeVisibility}
              designationOrder={designationOrder}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DesignationColumnCanvas — exported top-level component.
 * Identical prop signature to GridLayoutCanvas / VerticalTreeCanvas.
 */
export function DesignationColumnCanvas({
  roots, expandedSet, onToggle, onDelete, onColorChange,
  nodeColors = {}, lineColor = '#94a3b8', lineThickness = 2,
  selectedToolbarColor = null, isViewer = false, onFocus = null,
  cardW = CARD_W, cardH = CARD_H, nodeVisibility = null,
  designationOrder = null,
  onNodeClick = null,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: 40, minWidth: 300, overflowX: 'auto' }}>
      {roots.map((root) => (
        <DesigManagerBlock
          key={root.id}
          node={root}
          expandedSet={expandedSet}
          onToggle={onToggle}
          onDelete={onDelete}
          onColorChange={onColorChange}
          nodeColors={nodeColors}
          selectedToolbarColor={selectedToolbarColor}
          isViewer={isViewer}
          onFocus={onFocus}
          depth={0}
          cardW={cardW}
          cardH={cardH}
          nodeVisibility={nodeVisibility}
          designationOrder={designationOrder}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT SELECTOR UI
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * LayoutSelector
 *
 * Renders a compact button group:
 *   [ Grid Layout ]  [ Hierarchical Tree ]  [ Vertical Hierarchical Tree ]  [ Designation Column ]
 *
 * Props:
 *   value    — current layout: 'grid' | 'hierarchical' | 'vertical' | 'designation'
 *   onChange — (newValue: string) => void
 */

const LAYOUTS = [
  { id: 'grid',         label: 'Grid Layout',               icon: '⊞' },
  { id: 'hierarchical', label: 'Hierarchical Tree',          icon: '⊢' },
  { id: 'template',     label: 'Template Branch',            icon: '├' },
  { id: 'vertical',     label: 'Vertical Tree',              icon: '↓' },
  { id: 'designation',  label: 'Designation Columns',        icon: '▦' },
];

export function LayoutSelector({ value, onChange, labelOverrides = {} }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 mb-4">
      <span className="text-xs font-semibold text-gray-600 shrink-0 mr-1">Layout:</span>
      <div className="flex flex-wrap gap-1">
        {LAYOUTS.map((l) => {
          const label = labelOverrides[l.id] || l.label;
          return (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(l.id)}
            title={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              value === l.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
            }`}
          >
            <span className="text-sm leading-none">{l.icon}</span>
            {label}
          </button>
        );
        })}
      </div>
    </div>
  );
}
