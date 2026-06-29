/**
 * nodeVisibility.js
 *
 * Shared defaults and helpers for the Node Display Controls feature.
 * This file is additive — it does NOT modify any existing file.
 *
 * Each visibility setting is a boolean. Default = true (all fields visible).
 * Settings are stored per-project in proj_trad_chart_state (key: 'nodeVisibility')
 * and in trad_chart_state for the global traditional chart.
 */

export const DEFAULT_NODE_VISIBILITY = {
  showName:        true,
  showDesignation: true,
  showDepartment:  true,
  showEmployeeId:  true,
  showPhoto:       true,
};

/**
 * Merge saved visibility settings with defaults.
 * Any missing key falls back to true (visible).
 */
export function mergeVisibility(saved) {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_NODE_VISIBILITY };
  return {
    showName:        saved.showName        !== false,
    showDesignation: saved.showDesignation !== false,
    showDepartment:  saved.showDepartment  !== false,
    showEmployeeId:  saved.showEmployeeId  !== false,
    showPhoto:       saved.showPhoto       !== false,
  };
}

/**
 * Generate initials avatar text from a name string.
 * "Ramesh Dorali" → "RD"
 * "Prabhu"        → "P"
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Deterministic background color for an initials avatar, based on the name.
 */
const AVATAR_BG_COLORS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#c026d3', '#65a30d',
  '#0d9488', '#9333ea', '#d946ef', '#f59e0b',
];

export function avatarBgColor(name) {
  if (!name) return AVATAR_BG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}
