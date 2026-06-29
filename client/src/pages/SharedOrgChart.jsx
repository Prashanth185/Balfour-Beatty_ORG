/**
 * SharedOrgChart.jsx
 *
 * PUBLIC read-only interactive viewer for a shared Traditional Org Chart.
 * No login required. No editing. No deleting. View-only.
 *
 * Features:
 *  - Expand / collapse nodes (single-level, same rule as editor)
 *  - Zoom in / out
 *  - Pan (drag canvas or use pan button)
 *  - Search employees (highlights match)
 *  - Fit to screen
 *  - Full screen
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronDown, ChevronRight, Search, X,
  GitBranch, Move, MousePointer2,
} from 'lucide-react';
import { GridLayoutCanvas, TemplateBranchCanvas, VerticalTreeCanvas, DesignationColumnCanvas, measureTemplateCanvas } from '../utils/orgChartLayouts.jsx';
import { DEFAULT_NODE_VISIBILITY, mergeVisibility, getInitials, avatarBgColor } from '../utils/nodeVisibility';

// ─── Constants (must match TraditionalOrgChart.jsx exactly) ──────────────────
const CARD_W    = 180;
const CARD_H    = 90;
const H_GAP     = 36;
const V_GAP     = 60;
const DEFAULT_LINE_COLOR     = '#94a3b8';
const DEFAULT_LINE_THICKNESS = 2;

const DEPT_COLORS = [
  '#2563eb','#059669','#d97706','#7c3aed',
  '#dc2626','#0891b2','#c026d3','#65a30d',
];
function deptColor(dept) {
  if (!dept) return DEPT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = (hash * 31 + dept.charCodeAt(i)) | 0;
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length];
}

// Determine readable text color against a background
function textColorFor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#1e293b' : '#ffffff';
  } catch { return '#ffffff'; }
}

// ─── Sorting helpers (designation-based) ─────────────────────────────────────
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

// ─── Layout helpers (same pure functions as TraditionalOrgChart) ──────────────
function subtreeWidth(node, expandedSet, cardW = CARD_W) {
  if (!expandedSet.has(node.id) || !node.children || node.children.length === 0) return cardW;
  const cw = node.children.map((c) => subtreeWidth(c, expandedSet, cardW));
  return Math.max(cardW, cw.reduce((s, w) => s + w, 0) + H_GAP * (node.children.length - 1));
}

function measureCanvas(roots, expandedSet, cardW = CARD_W, cardH = CARD_H) {
  if (roots.length === 0) return { width: 0, height: 0 };
  const rw  = roots.map((r) => subtreeWidth(r, expandedSet, cardW));
  const totalW = rw.reduce((s, w) => s + w, 0) + H_GAP * (roots.length - 1);
  function h(node) {
    if (!expandedSet.has(node.id) || !node.children || !node.children.length) return cardH;
    return cardH + V_GAP + Math.max(...node.children.map(h));
  }
  return { width: Math.max(totalW, 400), height: Math.max(Math.max(...roots.map(h)) + 60, 300) };
}

function renderTree(node, x, y, expandedSet, searchId, onToggle, nodeColors, cards, lines, sortType, designationOrder, cardW = CARD_W, cardH = CARD_H, nodeVisibility = null) {
  const isExpanded  = expandedSet.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isMatch     = searchId && node.id === searchId;

  cards.push(
    <ViewerCard
      key={node.id}
      node={node}
      x={x - cardW / 2}
      y={y}
      isExpanded={isExpanded}
      hasChildren={hasChildren}
      isMatch={isMatch}
      onToggle={onToggle}
      nodeColor={nodeColors ? (nodeColors[node.id] || node.node_color || null) : null}
      cardW={cardW}
      cardH={cardH}
      nodeVisibility={nodeVisibility}
    />,
  );

  if (!isExpanded || !hasChildren) return;

  const children = sortChildrenByDesignation(node.children || [], sortType, designationOrder);
  const cw   = children.map((c) => subtreeWidth(c, expandedSet, cardW));
  const tot  = cw.reduce((s, w) => s + w, 0) + H_GAP * (children.length - 1);
  const cy   = y + cardH + V_GAP;
  const cx   = [];
  let rx = x - tot / 2;
  for (let i = 0; i < children.length; i++) { cx.push(rx + cw[i] / 2); rx += cw[i] + H_GAP; }

  const pbx = x, pby = y + cardH;
  if (children.length === 1) {
    lines.push({ key: `v-${node.id}-0`, x1: pbx, y1: pby, x2: pbx, y2: cy });
  } else {
    const ey = pby + V_GAP / 2;
    lines.push({ key: `stub-${node.id}`, x1: pbx, y1: pby, x2: pbx, y2: ey });
    lines.push({ key: `hbar-${node.id}`, x1: cx[0], y1: ey, x2: cx[cx.length - 1], y2: ey });
    for (let i = 0; i < cx.length; i++) lines.push({ key: `drop-${node.id}-${i}`, x1: cx[i], y1: ey, x2: cx[i], y2: cy });
  }
  for (let i = 0; i < children.length; i++) {
    renderTree(children[i], cx[i], cy, expandedSet, searchId, onToggle, nodeColors, cards, lines, sortType, designationOrder, cardW, cardH, nodeVisibility);
  }
}

// ─── Single-level toggle helpers ─────────────────────────────────────────────
function findNode(id, list) {
  for (const n of list) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(id, n.children); if (f) return f; }
  }
  return null;
}
function allDescendants(node) {
  const ids = [];
  function c(n) { for (const ch of (n.children||[])) { ids.push(ch.id); c(ch); } }
  c(node);
  return ids;
}
function buildDefaultExpanded(roots) {
  const s = new Set(); for (const r of roots) s.add(r.id); return s;
}

// ─── Viewer card (no delete button, no edit; F1: custom node color) ──────────
function ViewerCard({ node, x, y, isExpanded, hasChildren, isMatch, onToggle, nodeColor, cardW = CARD_W, cardH = CARD_H, nodeVisibility = null }) {
  const vis = nodeVisibility || DEFAULT_NODE_VISIBILITY;
  const isColorized = !!nodeColor;
  const bgColor     = nodeColor || '#ffffff';
  const accent      = isColorized ? nodeColor : deptColor(node.department);
  const textColor   = isColorized ? textColorFor(bgColor) : '#1e3a5f';
  const subColor    = isColorized ? textColorFor(bgColor) + 'cc' : '#475569';
  const deptClr     = isColorized ? textColorFor(bgColor) + 'dd' : accent;
  const showPhoto   = vis.showPhoto;
  const photoUrl    = node.photo_url;
  const initials    = getInitials(node.name);
  const avatarColor = avatarBgColor(node.name);

  return (
    <div className="absolute" style={{ left: x, top: y, width: cardW, height: cardH, zIndex: 10 }}>
      <div
        className="w-full h-full rounded-lg overflow-hidden flex"
        style={{
          border: isMatch ? '2px solid #f59e0b' : '1px solid #e2e8f0',
          background: isMatch ? '#fffbeb' : bgColor,
          position: 'relative',
          boxShadow: isMatch
            ? '0 0 0 3px rgba(245,158,11,0.3), 0 4px 6px -1px rgba(0,0,0,0.1)'
            : '0 4px 6px -1px rgba(0,0,0,0.08)',
        }}
      >
        {!isColorized && <div style={{ width: 5, flexShrink: 0, background: accent }} />}
        <div className="flex-1 px-2.5 py-2 min-w-0" style={{ paddingRight: showPhoto ? 38 : undefined, paddingBottom: hasChildren ? 18 : undefined }}>
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
            <p className="text-xs truncate mt-0.5" style={{ color: isColorized ? textColorFor(bgColor) + '99' : '#94a3b8' }}>
              {node.employee_id}
            </p>
          )}
        </div>
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 px-2 min-w-6 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow hover:bg-blue-700 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand one level'}
          >
            {node.children?.length ?? 0}
          </button>
        )}
        {showPhoto && (
          <div style={{ position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 5 }}>
            {photoUrl ? (
              <img src={photoUrl} alt={node.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>
                {initials}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main viewer canvas (F1+F2: nodeColors, lineColor, lineThickness) ────────
function ViewerCanvas({ roots, expandedSet, searchId, onToggle, zoom, pan, onPanStart, isPanMode, nodeColors, lineColor, lineThickness, sortType, designationOrder, cardW = CARD_W, cardH = CARD_H, nodeVisibility = null }) {
  const cards = [], lines = [];
  const lc = lineColor || DEFAULT_LINE_COLOR;
  const lt = lineThickness || DEFAULT_LINE_THICKNESS;

  if (roots.length > 0) {
    const rw = roots.map((r) => subtreeWidth(r, expandedSet, cardW));
    const tot = rw.reduce((s, w) => s + w, 0) + H_GAP * (roots.length - 1);
    let rx = -tot / 2;
    for (let i = 0; i < roots.length; i++) {
      renderTree(roots[i], rx + rw[i] / 2, 0, expandedSet, searchId, onToggle, nodeColors, cards, lines, sortType, designationOrder, cardW, cardH, nodeVisibility);
      rx += rw[i] + H_GAP;
    }
  }
  const { width: cw, height: ch } = measureCanvas(roots, expandedSet, cardW, cardH);
  const pad = 60;
  const totalW = cw + pad * 2, totalH = ch + pad * 2;

  return (
    <div
      className={`absolute top-0 left-0 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{
        width: Math.max(totalW * zoom, 100),
        height: Math.max(totalH * zoom, 100),
        transform: `translate(${pan.x}px, ${pan.y}px)`,
      }}
      onMouseDown={onPanStart}
    >
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: totalW, height: totalH, position: 'relative' }}>
        <svg className="absolute top-0 left-0 pointer-events-none" width={totalW} height={totalH} style={{ zIndex: 1 }}>
          {lines.map((l) => (
            <line key={l.key}
              x1={l.x1 + cw / 2 + pad} y1={l.y1 + pad}
              x2={l.x2 + cw / 2 + pad} y2={l.y2 + pad}
              stroke={lc} strokeWidth={lt} strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute" style={{ left: cw / 2 + pad, top: pad, width: 0, height: 0 }}>
          {cards}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SharedOrgChart() {
  const { id } = useParams();
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [zoom,        setZoom]        = useState(1);
  const [pan,         setPan]         = useState({ x: 0, y: 0 });
  const [isPanMode,   setIsPanMode]   = useState(false);
  const [isFullscreen,setIsFullscreen]= useState(false);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [searchId,    setSearchId]    = useState(null);
  const [showSearch,  setShowSearch]  = useState(false);

  const containerRef = useRef(null);
  const panRef       = useRef(null);

  // ── Load shared chart (public, no auth) ──
  useEffect(() => {
    fetch(`/api/trad-org-chart/share/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Chart not found or link has expired.');
        return r.json();
      })
      .then((d) => {
        setData(d);
        setExpandedSet(buildDefaultExpanded(d.roots || []));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Single-level toggle (same logic as editor) ──
  const handleToggle = useCallback((nodeId) => {
    if (!data) return;
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
        const node = findNode(nodeId, data.roots || []);
        if (node) for (const d of allDescendants(node)) next.delete(d);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, [data]);

  // ── Zoom ──
  const zoomIn  = () => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)));

  // ── Fit to screen ──
  const fitToScreen = useCallback(() => {
    if (!data || !containerRef.current) return;
    const cardW = Number(data.cardW) || CARD_W;
    const cardH = Number(data.cardH) || CARD_H;
    const canvas = data.layoutType === 'template'
      ? measureTemplateCanvas(data.roots || [], expandedSet, cardW, cardH)
      : measureCanvas(data.roots || [], expandedSet, cardW, cardH);
    const { width: cw, height: ch } = canvas;
    const pad = 60;
    const el  = containerRef.current;
    const fz  = Math.min(0.99, (el.clientWidth - 40) / (cw + pad * 2), (el.clientHeight - 40) / (ch + pad * 2));
    setZoom(Math.max(0.3, fz));
    setPan({ x: 0, y: 0 });
  }, [data, expandedSet]);

  // ── Pan ──
  const handlePanStart = useCallback((e) => {
    if (!isPanMode) return;
    e.preventDefault();
    panRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    const onMove = (ev) => {
      if (!panRef.current) return;
      setPan({ x: ev.clientX - panRef.current.x, y: ev.clientY - panRef.current.y });
    };
    const onUp = () => { panRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [isPanMode, pan]);

  // ── Wheel zoom ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => Math.max(0.3, Math.min(2.5, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Fullscreen ──
  const toggleFullscreen = () => {
    const el = containerRef.current?.closest('[data-viewer-root]');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Search ──
  const allEmployees = data
    ? (() => { const r = []; function c(n) { r.push(n); (n.children||[]).forEach(c); } (data.roots||[]).forEach(c); return r; })()
    : [];

  const filteredSearch = searchTerm.trim()
    ? allEmployees.filter((e) =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.designation||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.department||'').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleSearchSelect = (emp) => {
    setSearchId(emp.id);
    setSearchTerm(emp.name);
    setShowSearch(false);
    // Expand path to make the node visible
    if (!data) return;
    function pathTo(id, list, path = []) {
      for (const n of list) {
        if (n.id === id) return [...path, n.id];
        const found = pathTo(id, n.children || [], [...path, n.id]);
        if (found) return found;
      }
      return null;
    }
    const path = pathTo(emp.id, data.roots || []);
    if (path) {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        // Add only each node in path one at a time (single-level rule: we expand
        // each ancestor so the target becomes visible)
        for (const pid of path.slice(0, -1)) next.add(pid);
        return next;
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <p className="text-gray-500 text-sm">Loading chart…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-8">
      <GitBranch className="w-16 h-16 text-gray-300" />
      <h1 className="text-2xl font-bold text-gray-700">Chart not found</h1>
      <p className="text-gray-400 text-center max-w-sm">{error}</p>
    </div>
  );

  const {
    roots = [],
    title = 'Org Chart',
    employeeCount = 0,
    nodeColors = {},
    lineColor = DEFAULT_LINE_COLOR,
    lineThickness = DEFAULT_LINE_THICKNESS,
    layoutType = 'hierarchical',
    nodeVisibility: savedNodeVisibility = DEFAULT_NODE_VISIBILITY,
    sortType = 'default',
    designationOrder = null,
    cardW: savedCardW = CARD_W,
    cardH: savedCardH = CARD_H,
  } = data;
  const cardW = Number(savedCardW) || CARD_W;
  const cardH = Number(savedCardH) || CARD_H;
  const nodeVisibility = mergeVisibility(savedNodeVisibility);

  return (
    <div data-viewer-root className="min-h-screen bg-gray-100 flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 z-20 shadow-sm">
        <GitBranch className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-base leading-tight truncate">{title}</h1>
          <p className="text-xs text-gray-400">{employeeCount} employees · Read-only view</p>
        </div>

        {/* Search */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowSearch((v) => !v); setSearchTerm(''); setSearchId(null); }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="Search employee"
          >
            <Search className="w-4 h-4" />
          </button>
          {showSearch && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30">
              <div className="relative p-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, designation…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {filteredSearch.length > 0 && (
                <ul className="max-h-48 overflow-y-auto border-t border-gray-100 divide-y divide-gray-50">
                  {filteredSearch.map((emp) => (
                    <li key={emp.id}>
                      <button
                        type="button"
                        onClick={() => handleSearchSelect(emp)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-medium text-gray-800">{emp.name}</span>
                        {emp.designation && <span className="text-gray-400 ml-1 text-xs">— {emp.designation}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchTerm && filteredSearch.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2">No results</p>
              )}
            </div>
          )}
        </div>

        {/* Zoom */}
        <button type="button" onClick={zoomOut} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs text-gray-500 w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>

        {/* Fit */}
        <button type="button" onClick={fitToScreen} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Fit to screen">
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Pan toggle */}
        <button
          type="button"
          onClick={() => setIsPanMode((v) => !v)}
          className={`p-2 rounded-lg transition-colors ${isPanMode ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
          title={isPanMode ? 'Pan mode ON — click to switch to select' : 'Pan mode OFF — click to enable pan'}
        >
          {isPanMode ? <Move className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </header>

      {/* ── Chart area ── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-50"
        style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        {roots.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
            <GitBranch className="w-16 h-16 opacity-20" />
            <p className="text-base">This chart has no employees yet.</p>
          </div>
        ) : layoutType === 'grid' ? (
          <div
            className={`absolute top-0 left-0 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            onMouseDown={handlePanStart}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <GridLayoutCanvas
                roots={roots}
                expandedSet={expandedSet}
                onToggle={handleToggle}
                onDelete={() => {}}
                onColorChange={() => {}}
                nodeColors={nodeColors}
                lineColor={lineColor}
                lineThickness={lineThickness}
                sortType={sortType}
                designationOrder={designationOrder}
                isViewer
                cardW={cardW}
                cardH={cardH}
                nodeVisibility={nodeVisibility}
              />
            </div>
          </div>
        ) : layoutType === 'vertical' ? (
          <div
            className={`absolute top-0 left-0 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            onMouseDown={handlePanStart}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <VerticalTreeCanvas
                roots={roots}
                expandedSet={expandedSet}
                onToggle={handleToggle}
                onDelete={() => {}}
                onColorChange={() => {}}
                nodeColors={nodeColors}
                lineColor={lineColor}
                lineThickness={lineThickness}
                sortType={sortType}
                designationOrder={designationOrder}
                isViewer
                cardW={cardW}
                cardH={cardH}
                nodeVisibility={nodeVisibility}
              />
            </div>
          </div>
        ) : layoutType === 'template' ? (
          <div
            className={`absolute top-0 left-0 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            onMouseDown={handlePanStart}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <TemplateBranchCanvas
                roots={roots}
                expandedSet={expandedSet}
                onToggle={handleToggle}
                onDelete={() => {}}
                onColorChange={() => {}}
                nodeColors={nodeColors}
                lineColor={lineColor}
                lineThickness={lineThickness}
                sortType={sortType}
                designationOrder={designationOrder}
                isViewer
                cardW={cardW}
                cardH={cardH}
                nodeVisibility={nodeVisibility}
              />
            </div>
          </div>
        ) : layoutType === 'designation' ? (
          <div
            className={`absolute top-0 left-0 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            onMouseDown={handlePanStart}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <DesignationColumnCanvas
                roots={roots}
                expandedSet={expandedSet}
                onToggle={handleToggle}
                onDelete={() => {}}
                onColorChange={() => {}}
                nodeColors={nodeColors}
                lineColor={lineColor}
                lineThickness={lineThickness}
                isViewer
                cardW={cardW}
                cardH={cardH}
                nodeVisibility={nodeVisibility}
                designationOrder={designationOrder}
              />
            </div>
          </div>
        ) : (
          <ViewerCanvas
            roots={roots}
            expandedSet={expandedSet}
            searchId={searchId}
            onToggle={handleToggle}
            zoom={zoom}
            pan={pan}
            onPanStart={handlePanStart}
            isPanMode={isPanMode}
            nodeColors={nodeColors}
            lineColor={lineColor}
            lineThickness={lineThickness}
            sortType={sortType}
            designationOrder={designationOrder}
            cardW={cardW}
            cardH={cardH}
            nodeVisibility={nodeVisibility}
          />
        )}

        {/* Hint bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-gray-500 shadow border border-gray-200 pointer-events-none select-none">
          Click ▶ to expand · ▾ to collapse · Ctrl+scroll to zoom · Drag in Pan mode
        </div>
      </div>
    </div>
  );
}
