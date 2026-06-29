/**
 * NodeDisplayControls.jsx
 *
 * NEW COMPONENT — additive only. Does NOT modify any existing file.
 *
 * Renders a compact "Node Display Controls" panel with checkboxes
 * to toggle which fields are visible inside every node card:
 *   ☑ Show Employee Name
 *   ☑ Show Designation
 *   ☑ Show Department
 *   ☑ Show Employee ID
 *   ☑ Show Employee Photo
 *
 * Props:
 *   visibility: object  — current visibility settings (from nodeVisibility.js)
 *   onChange:   fn      — called with the updated visibility object when a checkbox changes
 */

import { Eye, EyeOff } from 'lucide-react';
import { DEFAULT_NODE_VISIBILITY } from '../utils/nodeVisibility';

const FIELDS = [
  { key: 'showName',        label: 'Employee Name' },
  { key: 'showDesignation', label: 'Designation'   },
  { key: 'showDepartment',  label: 'Department'    },
  { key: 'showEmployeeId',  label: 'Employee ID'   },
  { key: 'showPhoto',       label: 'Employee Photo' },
];

export default function NodeDisplayControls({ visibility, onChange }) {
  const vis = visibility || DEFAULT_NODE_VISIBILITY;

  const toggle = (key) => {
    onChange({ ...vis, [key]: !vis[key] });
  };

  const allVisible = FIELDS.every((f) => vis[f.key]);
  const noneVisible = FIELDS.every((f) => !vis[f.key]);

  return (
    <div
      className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mb-4"
      data-export-exclude
    >
      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 shrink-0">
        <Eye className="w-3.5 h-3.5" /> Node Display:
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {FIELDS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={!!vis[key]}
              onChange={() => toggle(key)}
              className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
            />
            {label}
          </label>
        ))}
      </div>

      {/* Quick toggle: Show All / Hide All */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={() => {
            const all = {};
            FIELDS.forEach((f) => { all[f.key] = true; });
            onChange(all);
          }}
          disabled={allVisible}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Show all fields"
        >
          Show All
        </button>
        <button
          type="button"
          onClick={() => {
            // Keep Name always visible — it's the minimal identifier
            const none = {};
            FIELDS.forEach((f) => { none[f.key] = f.key === 'showName'; });
            onChange(none);
          }}
          disabled={noneVisible || (FIELDS.filter((f) => f.key !== 'showName').every((f) => !vis[f.key]))}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Hide all optional fields (keep name)"
        >
          <EyeOff className="w-3 h-3 inline mr-1" />
          Hide Fields
        </button>
      </div>
    </div>
  );
}
