/**
 * projects.js — Multi-Project Management API
 *
 * All existing routes (/api/chart-layout, /api/trad-org-chart) are untouched.
 * This file adds ONLY new project-scoped routes.
 *
 * Routes:
 *   GET    /api/projects                        — list all projects
 *   POST   /api/projects                        — create project
 *   GET    /api/projects/:pid                   — get project metadata
 *   PUT    /api/projects/:pid                   — rename project
 *   DELETE /api/projects/:pid                   — delete project + all data
 *   POST   /api/projects/:pid/duplicate         — duplicate project
 *   PUT    /api/projects/:pid/archive           — archive/restore project
 *
 *   -- Manual chart (project-scoped) --
 *   GET    /api/projects/:pid/manual/canvas     — load canvas state
 *   PUT    /api/projects/:pid/manual/nodes      — save all nodes (positions + styles)
 *   PUT    /api/projects/:pid/manual/settings   — save settings
 *   PUT    /api/projects/:pid/manual/line-styles/:ck  — save connection line style
 *   DELETE /api/projects/:pid/manual/line-styles/:ck  — reset line style
 *   PUT    /api/projects/:pid/manual/collapsed/:nk    — set collapsed
 *   PUT    /api/projects/:pid/manual/routing-network  — save routing network
 *
 *   -- Traditional chart (project-scoped) --
 *   GET    /api/projects/:pid/trad/employees    — list employees
 *   POST   /api/projects/:pid/trad/employees    — add employee
 *   DELETE /api/projects/:pid/trad/employees/:id — delete employee
 *   GET    /api/projects/:pid/trad/hierarchy    — full tree
 *   GET    /api/projects/:pid/trad/state        — UI state
 *   PUT    /api/projects/:pid/trad/state        — save UI state
 *   GET    /api/projects/:pid/trad/title        — get title
 *   PUT    /api/projects/:pid/trad/title        — save title
 *   GET    /api/projects/:pid/trad/line-style   — get line style
 *   PUT    /api/projects/:pid/trad/line-style   — save line style
 *   GET    /api/projects/:pid/trad/node-colors  — get node colors
 *   PUT    /api/projects/:pid/trad/node-colors/:empId — save node color
 *   DELETE /api/projects/:pid/trad/node-colors/:empId — reset node color
 *   POST   /api/projects/:pid/trad/share        — share snapshot
 *   POST   /api/projects/:pid/trad/import       — import from excel
 */

import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sqlValue } from '../utils/sql.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateProjectId() {
  // Count existing projects to generate PRJ001, PRJ002, etc.
  const count = db.prepare('SELECT COUNT(*) as c FROM org_chart_projects').get().c;
  const num = String(count + 1).padStart(3, '0');
  let candidate = `PRJ${num}`;
  // Ensure uniqueness
  while (db.prepare('SELECT id FROM org_chart_projects WHERE project_id = ?').get(candidate)) {
    const n = parseInt(candidate.replace('PRJ', '')) + 1;
    candidate = `PRJ${String(n).padStart(3, '0')}`;
  }
  return candidate;
}

function touchProject(pid) {
  db.prepare(`
    UPDATE org_chart_projects SET updated_at = CURRENT_TIMESTAMP WHERE project_id = ?
  `).run(pid);
}

function requireProject(res, pid) {
  const proj = db.prepare('SELECT * FROM org_chart_projects WHERE project_id = ?').get(pid);
  if (!proj) { res.status(404).json({ error: 'Project not found' }); return null; }
  return proj;
}

function isActiveEmployeeStatus(status) {
  if (status === undefined || status === null) return true;
  const value = String(status).trim().toLowerCase();
  if (!value) return true;
  const inactive = ['exited','resigned','retired','terminated','inactive','notice completed','notice-completed','left','leaver','deceased','not active','not-active'];
  return !inactive.includes(value);
}

function filterActiveEmployees(rows) {
  return rows.filter((row) => isActiveEmployeeStatus(row.status));
}

function sanitizePoint(p) {
  const x = Number(p?.x); const y = Number(p?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function normalizeAnchor(a) {
  return ['top', 'right', 'bottom', 'left'].includes(a) ? a : null;
}

function normalizeDirection(d) {
  return ['up', 'down', 'left', 'right'].includes(d) ? d : null;
}

// ── PROJECT CRUD ───────────────────────────────────────────────────────────────

// GET /api/projects
router.get('/', authenticateToken, (req, res) => {
  const { q, status } = req.query;
  let sql = `
    SELECT
      p.*,
      COALESCE((SELECT COUNT(*) FROM proj_trad_employees te WHERE te.project_id = p.project_id), 0) AS employee_count,
      COALESCE((SELECT COUNT(DISTINCT te.department) FROM proj_trad_employees te WHERE te.project_id = p.project_id AND te.department IS NOT NULL AND te.department != ''), 0) AS department_count,
      COALESCE((SELECT COUNT(*) FROM proj_trad_employees te WHERE te.project_id = p.project_id AND te.manager_id IS NOT NULL), 0) AS manager_count,
      COALESCE((SELECT COUNT(*) FROM proj_trad_employees te WHERE te.project_id = p.project_id AND te.manager_id IS NOT NULL), 0) AS relationship_count
    FROM org_chart_projects p
    WHERE 1=1`;
  const params = [];
  if (status === 'archived') {
    sql += ' AND p.status = ?'; params.push('archived');
  } else if (!status || status === 'active') {
    sql += ' AND p.status = ?'; params.push('active');
  }
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.project_id LIKE ? OR p.organization_name LIKE ? OR p.business_unit LIKE ? OR p.location LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.updated_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// POST /api/projects
router.post('/', authenticateToken, (req, res) => {
  const { name, type, description, organization_name, business_unit, country, location, chart_type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });
  if (!['manual', 'traditional'].includes(type)) return res.status(400).json({ error: 'type must be manual or traditional' });

  const pid = generateProjectId();
  db.prepare(`
    INSERT INTO org_chart_projects (project_id, name, type, chart_type, description, organization_name, business_unit, country, location, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(pid, name.trim(), type, chart_type || 'traditional', sqlValue(description), sqlValue(organization_name), sqlValue(business_unit), sqlValue(country), sqlValue(location), req.user?.username || 'admin');

  // Initialize default title
  if (type === 'traditional') {
    db.prepare(`
      INSERT OR IGNORE INTO proj_trad_chart_title (project_id, title) VALUES (?, ?)
    `).run(pid, name.trim());
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO proj_chart_settings (project_id, key, value) VALUES (?, 'title', ?)
    `).run(pid, name.trim());
  }

  const proj = db.prepare('SELECT * FROM org_chart_projects WHERE project_id = ?').get(pid);
  res.status(201).json(proj);
});

// GET /api/projects/:pid
router.get('/:pid', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  res.json(proj);
});

// PUT /api/projects/:pid  (rename)
router.put('/:pid', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare(`
    UPDATE org_chart_projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ?
  `).run(name.trim(), req.params.pid);
  res.json(db.prepare('SELECT * FROM org_chart_projects WHERE project_id = ?').get(req.params.pid));
});

// PUT /api/projects/:pid/archive
router.put('/:pid/archive', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const newStatus = proj.status === 'archived' ? 'active' : 'archived';
  db.prepare(`
    UPDATE org_chart_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ?
  `).run(newStatus, req.params.pid);
  res.json({ ok: true, status: newStatus });
});

// DELETE /api/projects/:pid
router.delete('/:pid', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  // Cascade deletes handle all related data automatically via FK ON DELETE CASCADE
  db.prepare('DELETE FROM org_chart_projects WHERE project_id = ?').run(req.params.pid);
  res.json({ ok: true, message: 'Project deleted' });
});

// POST /api/projects/:pid/duplicate
router.post('/:pid/duplicate', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;

  const newPid = generateProjectId();
  const newName = `${proj.name} - Copy`;

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO org_chart_projects (project_id, name, type, status)
      VALUES (?, ?, ?, 'active')
    `).run(newPid, newName, proj.type);

    if (proj.type === 'manual') {
      // Duplicate nodes
      db.prepare(`
        INSERT INTO proj_chart_nodes (project_id, node_key, label, pos_x, pos_y,
          bg_color_top, bg_color_bottom, name_color, title_color, dept_color,
          name_font_size, title_font_size, name_font_weight, name, designation, department, photo_url)
        SELECT ?, node_key, label, pos_x, pos_y,
          bg_color_top, bg_color_bottom, name_color, title_color, dept_color,
          name_font_size, title_font_size, name_font_weight, name, designation, department, photo_url
        FROM proj_chart_nodes WHERE project_id = ?
      `).run(newPid, proj.project_id);

      // Duplicate settings
      db.prepare(`
        INSERT INTO proj_chart_settings (project_id, key, value)
        SELECT ?, key, value FROM proj_chart_settings WHERE project_id = ?
      `).run(newPid, proj.project_id);

      // Override title
      db.prepare(`
        INSERT INTO proj_chart_settings (project_id, key, value) VALUES (?, 'title', ?)
        ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value
      `).run(newPid, newName);

      // Duplicate line styles
      db.prepare(`
        INSERT INTO proj_chart_line_styles (project_id, connection_key, color, width, line_type, waypoints)
        SELECT ?, connection_key, color, width, line_type, waypoints
        FROM proj_chart_line_styles WHERE project_id = ?
      `).run(newPid, proj.project_id);

      // Duplicate collapsed states
      db.prepare(`
        INSERT INTO proj_chart_collapsed (project_id, node_key, collapsed)
        SELECT ?, node_key, collapsed FROM proj_chart_collapsed WHERE project_id = ?
      `).run(newPid, proj.project_id);

      // Duplicate breakpoints and segments (map old IDs → new IDs)
      const bps = db.prepare('SELECT * FROM proj_chart_breakpoints WHERE project_id = ?').all(proj.project_id);
      const bpIdMap = {};
      for (const bp of bps) {
        const r = db.prepare(`
          INSERT INTO proj_chart_breakpoints (project_id, pos_x, pos_y, kind)
          VALUES (?, ?, ?, ?)
        `).run(newPid, bp.pos_x, bp.pos_y, bp.kind);
        bpIdMap[bp.id] = r.lastInsertRowid;
      }
      // Update parent_breakpoint_id
      for (const bp of bps) {
        if (bp.parent_breakpoint_id && bpIdMap[bp.parent_breakpoint_id]) {
          db.prepare(`
            UPDATE proj_chart_breakpoints SET parent_breakpoint_id = ? WHERE id = ?
          `).run(bpIdMap[bp.parent_breakpoint_id], bpIdMap[bp.id]);
        }
      }
      const segs = db.prepare('SELECT * FROM proj_chart_segments WHERE project_id = ?').all(proj.project_id);
      for (const seg of segs) {
        db.prepare(`
          INSERT INTO proj_chart_segments (
            project_id, from_breakpoint_id, from_node_key, from_anchor, from_x, from_y,
            to_breakpoint_id, parent_breakpoint_id, direction, color, width
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newPid,
          seg.from_breakpoint_id ? (bpIdMap[seg.from_breakpoint_id] || null) : null,
          seg.from_node_key,
          seg.from_anchor,
          seg.from_x,
          seg.from_y,
          bpIdMap[seg.to_breakpoint_id] || null,
          seg.parent_breakpoint_id ? (bpIdMap[seg.parent_breakpoint_id] || null) : null,
          seg.direction,
          seg.color,
          seg.width,
        );
      }
    } else {
      // Duplicate traditional employees (map old IDs → new IDs)
      const emps = db.prepare('SELECT * FROM proj_trad_employees WHERE project_id = ? ORDER BY id ASC').all(proj.project_id);
      const empIdMap = {};
      for (const emp of emps) {
        const r = db.prepare(`
          INSERT INTO proj_trad_employees (project_id, employee_id, name, designation, department, photo_url, manager_id)
          VALUES (?, ?, ?, ?, ?, ?, NULL)
        `).run(newPid, emp.employee_id, emp.name, emp.designation, emp.department, emp.photo_url || null);
        empIdMap[emp.id] = r.lastInsertRowid;
      }
      for (const emp of emps) {
        if (emp.manager_id && empIdMap[emp.manager_id]) {
          db.prepare(`UPDATE proj_trad_employees SET manager_id = ? WHERE id = ?`)
            .run(empIdMap[emp.manager_id], empIdMap[emp.id]);
        }
      }

      // Duplicate trad settings
      const titleRow = db.prepare('SELECT title FROM proj_trad_chart_title WHERE project_id = ?').get(proj.project_id);
      db.prepare(`INSERT OR IGNORE INTO proj_trad_chart_title (project_id, title) VALUES (?, ?)`)
        .run(newPid, newName);

      const lsRow = db.prepare('SELECT * FROM proj_trad_line_styles WHERE project_id = ?').get(proj.project_id);
      if (lsRow) {
        db.prepare(`INSERT OR IGNORE INTO proj_trad_line_styles (project_id, color, thickness) VALUES (?, ?, ?)`)
          .run(newPid, lsRow.color, lsRow.thickness);
      }

      // Duplicate node colors
      const colors = db.prepare('SELECT * FROM proj_trad_node_colors WHERE project_id = ?').all(proj.project_id);
      for (const c of colors) {
        if (empIdMap[c.employee_db_id]) {
          db.prepare(`
            INSERT OR IGNORE INTO proj_trad_node_colors (project_id, employee_db_id, color)
            VALUES (?, ?, ?)
          `).run(newPid, empIdMap[c.employee_db_id], c.color);
        }
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.status(201).json(db.prepare('SELECT * FROM org_chart_projects WHERE project_id = ?').get(newPid));
});

// ══════════════════════════════════════════════════════════════════════════════
// MANUAL CHART — project-scoped routes
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/projects/:pid/manual/canvas
router.get('/:pid/manual/canvas', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  if (proj.type !== 'manual') return res.status(400).json({ error: 'Not a manual project' });

  const pid = req.params.pid;

  const nodes = db.prepare('SELECT * FROM proj_chart_nodes WHERE project_id = ?').all(pid);
  const nodesMap = {};
  for (const n of nodes) nodesMap[n.node_key] = n;

  const settings = db.prepare('SELECT key, value FROM proj_chart_settings WHERE project_id = ?').all(pid);
  const settingsMap = { title: '', theme: 'professional', orthogonalLines: true, routingType: 'orthogonal' };
  for (const s of settings) {
    if (s.key === 'orthogonalLines') settingsMap.orthogonalLines = s.value === 'true';
    else settingsMap[s.key] = s.value;
  }

  const lineStyles = db.prepare('SELECT * FROM proj_chart_line_styles WHERE project_id = ?').all(pid);
  const lineStyleMap = {};
  for (const l of lineStyles) {
    lineStyleMap[l.connection_key] = {
      ...l,
      waypoints: l.waypoints ? (() => { try { return JSON.parse(l.waypoints); } catch { return null; } })() : null,
    };
  }

  const collapsed = db.prepare('SELECT node_key FROM proj_chart_collapsed WHERE project_id = ? AND collapsed = 1').all(pid);

  const breakpoints = db.prepare(`
    SELECT id, pos_x as x, pos_y as y, parent_breakpoint_id, kind
    FROM proj_chart_breakpoints WHERE project_id = ? ORDER BY id
  `).all(pid);

  const segments = db.prepare(`
    SELECT id, from_breakpoint_id, from_node_key, from_anchor, from_x, from_y,
      to_breakpoint_id, parent_breakpoint_id, direction, color, width
    FROM proj_chart_segments WHERE project_id = ? ORDER BY id
  `).all(pid);

  res.json({
    nodes: nodesMap,
    settings: settingsMap,
    lineStyles: lineStyleMap,
    collapsed: collapsed.map(c => c.node_key),
    routingNetwork: { breakpoints, segments },
  });
});

// PUT /api/projects/:pid/manual/nodes  — save all nodes
router.put('/:pid/manual/nodes', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  if (proj.type !== 'manual') return res.status(400).json({ error: 'Not a manual project' });

  const { nodes } = req.body;
  if (!nodes || typeof nodes !== 'object') return res.status(400).json({ error: 'nodes object required' });

  const pid = req.params.pid;

  const upsert = db.prepare(`
    INSERT INTO proj_chart_nodes (
      project_id, node_key, label, pos_x, pos_y,
      bg_color_top, bg_color_bottom, name_color, title_color, dept_color,
      name_font_size, title_font_size, name_font_weight, name, designation, department, photo_url,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, node_key) DO UPDATE SET
      label = excluded.label,
      pos_x = excluded.pos_x,
      pos_y = excluded.pos_y,
      bg_color_top = excluded.bg_color_top,
      bg_color_bottom = excluded.bg_color_bottom,
      name_color = excluded.name_color,
      title_color = excluded.title_color,
      dept_color = excluded.dept_color,
      name_font_size = excluded.name_font_size,
      title_font_size = excluded.title_font_size,
      name_font_weight = excluded.name_font_weight,
      name = excluded.name,
      designation = excluded.designation,
      department = excluded.department,
      photo_url = excluded.photo_url,
      updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction(() => {
    for (const [nodeKey, n] of Object.entries(nodes)) {
      upsert.run(
        pid, nodeKey,
        n.label || n.name || nodeKey,
        Number(n.pos_x ?? n.x ?? 0),
        Number(n.pos_y ?? n.y ?? 0),
        n.bg_color_top || '#5a6578',
        n.bg_color_bottom || '#2a3140',
        n.name_color || '#facc15',
        n.title_color || '#ffffff',
        n.dept_color || '#f87171',
        Number(n.name_font_size ?? 14),
        Number(n.title_font_size ?? 12),
        n.name_font_weight || 'bold',
        n.name || '',
        n.designation || '',
        n.department || '',
        n.photo_url || null,
      );
    }
  });
  tx();
  touchProject(pid);
  res.json({ ok: true, count: Object.keys(nodes).length });
});

// DELETE /api/projects/:pid/manual/nodes/:nodeKey
router.delete('/:pid/manual/nodes/:nodeKey', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  db.prepare('DELETE FROM proj_chart_nodes WHERE project_id = ? AND node_key = ?')
    .run(req.params.pid, req.params.nodeKey);
  touchProject(req.params.pid);
  res.json({ ok: true });
});

// PUT /api/projects/:pid/manual/settings
router.put('/:pid/manual/settings', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { title, theme, orthogonalLines, routingType } = req.body;
  const pid = req.params.pid;
  const upsert = db.prepare(`
    INSERT INTO proj_chart_settings (project_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value
  `);
  if (title !== undefined) upsert.run(pid, 'title', String(title));
  if (theme !== undefined) upsert.run(pid, 'theme', String(theme));
  if (orthogonalLines !== undefined) upsert.run(pid, 'orthogonalLines', orthogonalLines ? 'true' : 'false');
  if (routingType !== undefined) upsert.run(pid, 'routingType', String(routingType));
  touchProject(pid);
  res.json({ ok: true });
});

// PUT /api/projects/:pid/manual/line-styles/:ck
router.put('/:pid/manual/line-styles/:ck', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { color, width, line_type, waypoints } = req.body;
  const pid = req.params.pid;
  const ck = req.params.ck;
  const waypointsJson = Array.isArray(waypoints) ? JSON.stringify(waypoints) : null;
  db.prepare(`
    INSERT INTO proj_chart_line_styles (project_id, connection_key, color, width, line_type, waypoints)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, connection_key) DO UPDATE SET
      color = COALESCE(excluded.color, proj_chart_line_styles.color),
      width = COALESCE(excluded.width, proj_chart_line_styles.width),
      line_type = COALESCE(excluded.line_type, proj_chart_line_styles.line_type),
      waypoints = COALESCE(excluded.waypoints, proj_chart_line_styles.waypoints),
      updated_at = CURRENT_TIMESTAMP
  `).run(pid, ck, sqlValue(color), width != null ? Number(width) : null, sqlValue(line_type), waypointsJson);
  touchProject(pid);
  res.json({ ok: true });
});

// DELETE /api/projects/:pid/manual/line-styles/:ck
router.delete('/:pid/manual/line-styles/:ck', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM proj_chart_line_styles WHERE project_id = ? AND connection_key = ?')
    .run(req.params.pid, req.params.ck);
  touchProject(req.params.pid);
  res.json({ ok: true });
});

// PUT /api/projects/:pid/manual/collapsed/:nk
router.put('/:pid/manual/collapsed/:nk', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { collapsed } = req.body;
  db.prepare(`
    INSERT INTO proj_chart_collapsed (project_id, node_key, collapsed) VALUES (?, ?, ?)
    ON CONFLICT(project_id, node_key) DO UPDATE SET collapsed = excluded.collapsed
  `).run(req.params.pid, req.params.nk, collapsed ? 1 : 0);
  touchProject(req.params.pid);
  res.json({ ok: true });
});

// PUT /api/projects/:pid/manual/routing-network
router.put('/:pid/manual/routing-network', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const pid = req.params.pid;
  const breakpoints = Array.isArray(req.body?.breakpoints) ? req.body.breakpoints : [];
  const segments = Array.isArray(req.body?.segments) ? req.body.segments : [];

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM proj_chart_segments WHERE project_id = ?').run(pid);
    db.prepare('DELETE FROM proj_chart_breakpoints WHERE project_id = ?').run(pid);

    const insertBp = db.prepare(`
      INSERT INTO proj_chart_breakpoints (id, project_id, pos_x, pos_y, parent_breakpoint_id, kind)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const bp of breakpoints) {
      const id = Number(bp.id);
      if (!Number.isFinite(id)) continue;
      insertBp.run(id, pid, Number(bp.x) || 0, Number(bp.y) || 0,
        bp.parent_breakpoint_id != null ? Number(bp.parent_breakpoint_id) : null,
        bp.kind || 'breakpoint');
    }

    const insertSeg = db.prepare(`
      INSERT INTO proj_chart_segments (
        id, project_id, from_breakpoint_id, from_node_key, from_anchor, from_x, from_y,
        to_breakpoint_id, parent_breakpoint_id, direction, color, width
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const seg of segments) {
      const id = Number(seg.id);
      if (!Number.isFinite(id)) continue;
      insertSeg.run(
        id, pid,
        seg.from_breakpoint_id != null ? Number(seg.from_breakpoint_id) : null,
        seg.from_node_key || null,
        normalizeAnchor(seg.from_anchor),
        seg.from_x != null ? Number(seg.from_x) : null,
        seg.from_y != null ? Number(seg.from_y) : null,
        Number(seg.to_breakpoint_id),
        seg.parent_breakpoint_id != null ? Number(seg.parent_breakpoint_id) : null,
        normalizeDirection(seg.direction),
        sqlValue(seg.color),
        seg.width != null ? Number(seg.width) : null,
      );
    }
  });
  tx();
  touchProject(pid);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRADITIONAL CHART — project-scoped routes
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/projects/:pid/trad/employees
router.get('/:pid/trad/employees', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const rows = db.prepare(`
    SELECT te.id, te.employee_id, te.name, te.designation, te.department, te.photo_url, te.manager_id, te.status,
      mgr.name AS manager_name
    FROM proj_trad_employees te
    LEFT JOIN proj_trad_employees mgr ON mgr.id = te.manager_id
    WHERE te.project_id = ?
    ORDER BY te.created_at ASC
  `).all(req.params.pid);
  res.json(filterActiveEmployees(rows));
});

// POST /api/projects/:pid/trad/employees
router.post('/:pid/trad/employees', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const pid = req.params.pid;
  const { employee_id, name, designation, department, manager_id, photo_url, status } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const empId = employee_id?.trim() || `TRAD-${Date.now()}`;
  const result = db.prepare(`
    INSERT INTO proj_trad_employees (project_id, employee_id, name, designation, department, photo_url, manager_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pid, empId, name.trim(), sqlValue(designation), sqlValue(department), sqlValue(photo_url),
    manager_id ? Number(manager_id) : null, sqlValue(status) || 'Active');

  touchProject(pid);
  const newEmp = db.prepare(`
    SELECT te.id, te.employee_id, te.name, te.designation, te.department, te.photo_url, te.manager_id,
      mgr.name AS manager_name
    FROM proj_trad_employees te
    LEFT JOIN proj_trad_employees mgr ON mgr.id = te.manager_id
    WHERE te.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(newEmp);
});

// DELETE /api/projects/:pid/trad/employees/:id
// ?mode=reparent (default) — re-parents children to manager
// ?mode=cascade            — deletes employee + all descendants
router.delete('/:pid/trad/employees/:id', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const pid  = req.params.pid;
  const id   = Number(req.params.id);
  const mode = req.query.mode || 'reparent';
  const emp  = db.prepare('SELECT * FROM proj_trad_employees WHERE id = ? AND project_id = ?').get(id, pid);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  if (mode === 'cascade') {
    const toDelete = [];
    function collectDesc(parentId) {
      toDelete.push(parentId);
      const ch = db.prepare('SELECT id FROM proj_trad_employees WHERE manager_id = ? AND project_id = ?').all(parentId, pid);
      for (const c of ch) collectDesc(c.id);
    }
    collectDesc(id);
    const del = db.prepare('DELETE FROM proj_trad_employees WHERE id = ?');
    for (const did of toDelete) del.run(did);
  } else {
    db.prepare('UPDATE proj_trad_employees SET manager_id = ? WHERE manager_id = ? AND project_id = ?')
      .run(emp.manager_id ?? null, emp.id, pid);
    db.prepare('DELETE FROM proj_trad_employees WHERE id = ?').run(emp.id);
  }

  touchProject(pid);
  res.json({ ok: true });
});

// PUT /api/projects/:pid/trad/employees/:id
router.put('/:pid/trad/employees/:id', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const pid = req.params.pid;
  const id  = Number(req.params.id);
  const emp = db.prepare('SELECT * FROM proj_trad_employees WHERE id = ? AND project_id = ?').get(id, pid);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { name, employee_id, designation, department, manager_id, status } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (manager_id !== undefined && Number(manager_id) === id) {
    return res.status(400).json({ error: 'Employee cannot report to themselves' });
  }

  db.prepare(`
    UPDATE proj_trad_employees SET
      name        = COALESCE(?, name),
      employee_id = COALESCE(?, employee_id),
      designation = ?,
      department  = ?,
      manager_id  = ?,
      status      = ?
    WHERE id = ? AND project_id = ?
  `).run(
    name        !== undefined ? String(name).trim() : null,
    employee_id !== undefined ? String(employee_id).trim() || null : null,
    designation !== undefined ? sqlValue(designation) : emp.designation,
    department  !== undefined ? sqlValue(department)  : emp.department,
    manager_id  !== undefined ? (manager_id ? Number(manager_id) : null) : emp.manager_id,
    status !== undefined ? (sqlValue(status) || 'Active') : emp.status,
    id, pid,
  );

  touchProject(pid);
  const updated = db.prepare(`
    SELECT te.id, te.employee_id, te.name, te.designation, te.department, te.photo_url, te.manager_id,
      mgr.name AS manager_name
    FROM proj_trad_employees te
    LEFT JOIN proj_trad_employees mgr ON mgr.id = te.manager_id
    WHERE te.id = ?
  `).get(id);
  res.json(updated);
});

// GET /api/projects/:pid/trad/hierarchy
router.get('/:pid/trad/hierarchy', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const pid = req.params.pid;

  const all = filterActiveEmployees(db.prepare(`
    SELECT te.id, te.employee_id, te.name, te.designation, te.department, te.photo_url, te.manager_id, te.status,
      mgr.name AS manager_name, tnc.color AS node_color
    FROM proj_trad_employees te
    LEFT JOIN proj_trad_employees mgr ON mgr.id = te.manager_id
    LEFT JOIN proj_trad_node_colors tnc ON tnc.employee_db_id = te.id AND tnc.project_id = te.project_id
    WHERE te.project_id = ?
    ORDER BY te.created_at ASC
  `).all(pid));

  const map = {}; const roots = [];
  for (const e of all) map[e.id] = { ...e, children: [] };
  for (const e of all) {
    if (e.manager_id && map[e.manager_id]) map[e.manager_id].children.push(map[e.id]);
    else roots.push(map[e.id]);
  }
  res.json({ roots, total: all.length });
});

// GET /api/projects/:pid/trad/state
router.get('/:pid/trad/state', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const row = db.prepare(`SELECT value FROM proj_trad_chart_state WHERE project_id = ? AND key = 'ui_state'`)
    .get(req.params.pid);
  if (!row) return res.json({ expandedIds: null });
  try { res.json(JSON.parse(row.value)); } catch { res.json({ expandedIds: null }); }
});

// PUT /api/projects/:pid/trad/state
router.put('/:pid/trad/state', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const pid = req.params.pid;
  db.prepare(`
    INSERT INTO proj_trad_chart_state (project_id, key, value, updated_at)
    VALUES (?, 'ui_state', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(pid, JSON.stringify(req.body));
  touchProject(pid);
  res.json({ ok: true });
});

// GET /api/projects/:pid/trad/title
router.get('/:pid/trad/title', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const row = db.prepare('SELECT title FROM proj_trad_chart_title WHERE project_id = ?').get(req.params.pid);
  res.json({ title: row ? row.title : proj.name });
});

// PUT /api/projects/:pid/trad/title
router.put('/:pid/trad/title', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  db.prepare(`
    INSERT INTO proj_trad_chart_title (project_id, title, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.pid, title.trim());
  touchProject(req.params.pid);
  res.json({ ok: true, title: title.trim() });
});

// GET /api/projects/:pid/trad/line-style
router.get('/:pid/trad/line-style', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const row = db.prepare('SELECT color, thickness FROM proj_trad_line_styles WHERE project_id = ?').get(req.params.pid);
  res.json({ color: row?.color || '#94a3b8', thickness: row?.thickness || 2 });
});

// PUT /api/projects/:pid/trad/line-style
router.put('/:pid/trad/line-style', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { color, thickness } = req.body;
  const c = color?.trim() || '#94a3b8';
  const t = Math.max(1, Math.min(10, Number(thickness) || 2));
  db.prepare(`
    INSERT INTO proj_trad_line_styles (project_id, color, thickness, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET color = excluded.color, thickness = excluded.thickness, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.pid, c, t);
  touchProject(req.params.pid);
  res.json({ ok: true, color: c, thickness: t });
});

// GET /api/projects/:pid/trad/node-colors
router.get('/:pid/trad/node-colors', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const rows = db.prepare('SELECT employee_db_id, color FROM proj_trad_node_colors WHERE project_id = ?').all(req.params.pid);
  const map = {};
  for (const r of rows) map[r.employee_db_id] = r.color;
  res.json(map);
});

// PUT /api/projects/:pid/trad/node-colors/:empId
router.put('/:pid/trad/node-colors/:empId', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { color } = req.body;
  if (!color?.trim()) return res.status(400).json({ error: 'Color required' });
  const empId = Number(req.params.empId);
  db.prepare(`
    INSERT INTO proj_trad_node_colors (project_id, employee_db_id, color, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, employee_db_id) DO UPDATE SET color = excluded.color, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.pid, empId, color.trim());
  touchProject(req.params.pid);
  res.json({ ok: true });
});

// DELETE /api/projects/:pid/trad/node-colors/:empId
router.delete('/:pid/trad/node-colors/:empId', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM proj_trad_node_colors WHERE project_id = ? AND employee_db_id = ?')
    .run(req.params.pid, Number(req.params.empId));
  res.json({ ok: true });
});

// GET /api/projects/:pid/trad/node-size
router.get('/:pid/trad/node-size', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const row = db.prepare('SELECT card_w, card_h FROM proj_trad_node_size WHERE project_id = ?').get(req.params.pid);
  res.json({ cardW: row?.card_w || 180, cardH: row?.card_h || 90 });
});

// PUT /api/projects/:pid/trad/node-size
router.put('/:pid/trad/node-size', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { cardW, cardH } = req.body;
  const w = Math.max(100, Math.min(500, Number(cardW) || 180));
  const h = Math.max(60,  Math.min(300, Number(cardH) || 90));
  db.prepare(`
    INSERT INTO proj_trad_node_size (project_id, card_w, card_h, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET card_w = excluded.card_w, card_h = excluded.card_h, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.pid, w, h);
  touchProject(req.params.pid);
  res.json({ ok: true, cardW: w, cardH: h });
});

// POST /api/projects/:pid/trad/share
router.post('/:pid/trad/share', authenticateToken, (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  const { chartData } = req.body;
  if (!chartData) return res.status(400).json({ error: 'chartData required' });
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const value = typeof chartData === 'string' ? chartData : JSON.stringify(chartData);
  db.prepare(`INSERT INTO proj_trad_shared_charts (id, project_id, chart_data) VALUES (?, ?, ?)`)
    .run(id, req.params.pid, value);
  res.status(201).json({ id, ok: true });
});

// POST /api/projects/:pid/trad/import/validate
router.post('/:pid/trad/import/validate', authenticateToken, upload.single('file'), (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const normalise = (items) => items.map((row) => {
    const r = {};
    for (const [k, v] of Object.entries(row)) r[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
    return r;
  });
  const data = normalise(rows);
  const col = (row, ...aliases) => {
    for (const a of aliases) if (row[a] !== undefined) return row[a];
    return '';
  };

  const parsed = data.map((row) => ({
    empId: col(row, 'employee_id', 'emp_id', 'id', 'employeeid'),
    name: col(row, 'employee_name', 'name', 'full_name', 'employeename'),
    desig: col(row, 'designation', 'title', 'job_title'),
    dept: col(row, 'department', 'dept'),
    reportsTo: col(row, 'reports_to_employee_id', 'reports_to', 'manager_id', 'reportsto', 'manager'),
    status: col(row, 'status', 'employment_status', 'employee_status'),
  })).filter((p) => p.empId && p.name);

  const rootCount = parsed.filter((p) => !p.reportsTo || p.reportsTo === '').length;
  const relCount = parsed.filter((p) => p.reportsTo && p.reportsTo !== '').length;
  return res.json({
    ok: true,
    total: parsed.length,
    rootCount,
    relationshipCount: relCount,
    duplicateIds: parsed.filter((p, idx) => parsed.findIndex((item) => item.empId === p.empId) !== idx).map((p) => p.empId),
    preview: parsed.slice(0, 6).map((p) => ({ empId: p.empId, name: p.name, designation: p.desig, department: p.dept, reportsTo: p.reportsTo, status: p.status })),
  });
});

// POST /api/projects/:pid/trad/import
router.post('/:pid/trad/import', authenticateToken, upload.single('file'), (req, res) => {
  const proj = requireProject(res, req.params.pid);
  if (!proj) return;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const pid = req.params.pid;
  const mode = req.body.mode || 'replace';

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  function normalise(rows) {
    return rows.map((row) => {
      const r = {};
      for (const [k, v] of Object.entries(row)) r[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
      return r;
    });
  }
  const data = normalise(rows);
  function col(row, ...aliases) { for (const a of aliases) if (row[a] !== undefined) return row[a]; return ''; }

  const parsed = data.map((row) => ({
    empId:     col(row, 'employee_id', 'emp_id', 'id', 'employeeid'),
    name:      col(row, 'employee_name', 'name', 'full_name', 'employeename'),
    desig:     col(row, 'designation', 'title', 'job_title'),
    dept:      col(row, 'department', 'dept'),
    reportsTo: col(row, 'reports_to_employee_id', 'reports_to', 'manager_id', 'reportsto', 'manager'),
    status:    col(row, 'status', 'employment_status', 'employee_status'),
  })).filter((p) => p.empId && p.name);

  db.exec('BEGIN');
  try {
    if (mode === 'replace') {
      db.prepare('DELETE FROM proj_trad_employees WHERE project_id = ?').run(pid);
      db.prepare(`DELETE FROM proj_trad_chart_state WHERE project_id = ? AND key = 'ui_state'`).run(pid);
    }

    const insertStmt = db.prepare(`
      INSERT INTO proj_trad_employees (project_id, employee_id, name, designation, department, manager_id, status)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
      ON CONFLICT(project_id, employee_id) DO NOTHING
    `);
    for (const p of parsed) {
      insertStmt.run(pid, p.empId, p.name, sqlValue(p.desig), sqlValue(p.dept), sqlValue(p.status) || 'Active');
    }

    const allInserted = db.prepare('SELECT id, employee_id FROM proj_trad_employees WHERE project_id = ?').all(pid);
    const empIdToDbId = {};
    for (const r of allInserted) empIdToDbId[r.employee_id] = r.id;

    const updateStmt = db.prepare('UPDATE proj_trad_employees SET manager_id = ? WHERE id = ?');
    for (const p of parsed) {
      if (p.reportsTo && empIdToDbId[p.reportsTo] && empIdToDbId[p.empId]) {
        updateStmt.run(empIdToDbId[p.reportsTo], empIdToDbId[p.empId]);
      }
    }

    const rootCount = parsed.filter((p) => !p.reportsTo || p.reportsTo === '').length;
    const relCount  = parsed.filter((p) =>  p.reportsTo && p.reportsTo !== '').length;
    db.prepare(`
      INSERT INTO proj_trad_import_history (project_id, file_name, imported_by, total_employees, root_count, relationship_count, error_count, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'success')
    `).run(pid, req.file.originalname, req.user?.username || 'unknown', parsed.length, rootCount, relCount);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  touchProject(pid);
  res.json({ ok: true, imported: parsed.length });
});

export default router;
