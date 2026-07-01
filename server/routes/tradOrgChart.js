import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sqlValue } from '../utils/sql.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
// multer: memory storage so we don't write temp files to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function resolveDepartmentId(department) {
  if (!department?.trim()) return null;
  const name = department.trim();
  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO departments (name) VALUES (?)').run(name).lastInsertRowid;
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

function getStoredProjectLink() {
  const row = db.prepare("SELECT value FROM trad_chart_state WHERE key = 'project_link'").get();
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value);
    return parsed?.projectId || parsed || null;
  } catch {
    return row.value;
  }
}

function setStoredProjectLink(projectId) {
  db.prepare(`
    INSERT INTO trad_chart_state (key, value, updated_at)
    VALUES ('project_link', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(projectId));
}

function generateProjectId() {
  const count = db.prepare('SELECT COUNT(*) as c FROM org_chart_projects').get().c;
  const num = String(count + 1).padStart(3, '0');
  let candidate = `PRJ${num}`;
  while (db.prepare('SELECT id FROM org_chart_projects WHERE project_id = ?').get(candidate)) {
    const n = parseInt(candidate.replace('PRJ', ''), 10) + 1;
    candidate = `PRJ${String(n).padStart(3, '0')}`;
  }
  return candidate;
}

// ── GET /api/trad-org-chart/employees ──────────────────────────────────────
// Returns all employees in the traditional org chart (isolated table)
// Add ?full=1 to get all columns (used by dashboard drill-down modals)
router.get('/employees', authenticateToken, (req, res) => {
  if (req.query.full === '1') {
    const rows = db.prepare(`
      SELECT
        te.*,
        mgr.name AS manager_name,
        mgr.employee_id AS manager_employee_id
      FROM trad_employees te
      LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
      ORDER BY te.name ASC
    `).all();
    return res.json(filterActiveEmployees(rows));
  }
  const rows = db.prepare(`
    SELECT
      te.id,
      te.employee_id,
      te.name,
      te.designation,
      te.department,
      te.photo_url,
      te.manager_id,
      te.status,
      mgr.name AS manager_name
    FROM trad_employees te
    LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
    ORDER BY te.created_at ASC
  `).all();
  res.json(filterActiveEmployees(rows));
});

// ── POST /api/trad-org-chart/employees ─────────────────────────────────────
// Creates a new employee in the traditional org chart
router.post('/employees', authenticateToken, (req, res) => {
  try {
    const { employee_id, name, designation, department, manager_id, photo_url, status } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const empId = employee_id?.trim() || `TRAD-${Date.now()}`;

    const result = db.prepare(`
      INSERT INTO trad_employees (employee_id, name, designation, department, photo_url, manager_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      empId,
      name.trim(),
      sqlValue(designation),
      sqlValue(department),
      sqlValue(photo_url),
      manager_id ? Number(manager_id) : null,
      sqlValue(status) || 'Active',
    );

    const newEmp = db.prepare(`
      SELECT
        te.id,
        te.employee_id,
        te.name,
        te.designation,
        te.department,
        te.photo_url,
        te.manager_id,
        mgr.name AS manager_name
      FROM trad_employees te
      LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
      WHERE te.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newEmp);
  } catch (err) {
    console.error('Create trad employee error:', err);
    res.status(500).json({ error: err.message || 'Failed to create employee' });
  }
});

// ── PUT /api/trad-org-chart/employees/:id ─────────────────────────────────
// Updates an existing employee's fields
router.put('/employees/:id', authenticateToken, (req, res) => {
  try {
    const id = Number(req.params.id);
    const emp = db.prepare('SELECT * FROM trad_employees WHERE id = ?').get(id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const {
      name,
      employee_id,
      designation,
      department,
      manager_id,
      status,
    } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    // Guard: prevent self-reporting
    if (manager_id !== undefined && Number(manager_id) === id) {
      return res.status(400).json({ error: 'Employee cannot report to themselves' });
    }

    db.prepare(`
      UPDATE trad_employees SET
        name        = COALESCE(?, name),
        employee_id = COALESCE(?, employee_id),
        designation = ?,
        department  = ?,
        manager_id  = ?,
        status      = ?
      WHERE id = ?
    `).run(
      name        !== undefined ? String(name).trim() : null,
      employee_id !== undefined ? String(employee_id).trim() || null : null,
      designation !== undefined ? (sqlValue(designation)) : emp.designation,
      department  !== undefined ? (sqlValue(department))  : emp.department,
      manager_id  !== undefined ? (manager_id ? Number(manager_id) : null) : emp.manager_id,
      status !== undefined ? (sqlValue(status) || 'Active') : emp.status,
      id,
    );

    const updated = db.prepare(`
      SELECT te.id, te.employee_id, te.name, te.designation, te.department, te.photo_url,
             te.manager_id, mgr.name AS manager_name
      FROM trad_employees te
      LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
      WHERE te.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('Update trad employee error:', err);
    res.status(500).json({ error: err.message || 'Failed to update employee' });
  }
});

// ── DELETE /api/trad-org-chart/employees/:id ───────────────────────────────
// Deletes an employee.
// ?mode=reparent (default) — re-parents children to the deleted employee's manager
// ?mode=cascade            — deletes the employee AND all descendants
router.delete('/employees/:id', authenticateToken, (req, res) => {
  try {
    const id  = Number(req.params.id);
    const mode = req.query.mode || 'reparent';
    const emp = db.prepare('SELECT * FROM trad_employees WHERE id = ?').get(id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    if (mode === 'cascade') {
      // Delete employee + entire subtree (depth-first using a recursive CTE)
      const toDelete = [];
      function collectDescendants(parentId) {
        toDelete.push(parentId);
        const children = db.prepare('SELECT id FROM trad_employees WHERE manager_id = ?').all(parentId);
        for (const c of children) collectDescendants(c.id);
      }
      collectDescendants(id);
      const del = db.prepare('DELETE FROM trad_employees WHERE id = ?');
      for (const did of toDelete) del.run(did);
    } else {
      // Reparent: move children up to deleted employee's manager
      db.prepare('UPDATE trad_employees SET manager_id = ? WHERE manager_id = ?')
        .run(emp.manager_id ?? null, id);
      db.prepare('DELETE FROM trad_employees WHERE id = ?').run(id);
    }

    res.json({ message: 'Employee deleted' });
  } catch (err) {
    console.error('Delete trad employee error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete employee' });
  }
});

// ── GET /api/trad-org-chart/hierarchy ──────────────────────────────────────
// Returns the full tree as a nested structure for rendering (includes node colors)
router.get('/hierarchy', authenticateToken, (_req, res) => {
  const all = filterActiveEmployees(db.prepare(`
    SELECT
      te.id,
      te.employee_id,
      te.name,
      te.designation,
      te.department,
      te.photo_url,
      te.manager_id,
      te.status,
      mgr.name AS manager_name,
      tnc.color AS node_color
    FROM trad_employees te
    LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
    LEFT JOIN trad_node_colors tnc ON tnc.employee_id = te.id
    ORDER BY te.created_at ASC
  `).all());

  // Build a nested tree
  const map = {};
  const roots = [];

  for (const emp of all) {
    map[emp.id] = { ...emp, children: [] };
  }

  for (const emp of all) {
    if (emp.manager_id && map[emp.manager_id]) {
      map[emp.manager_id].children.push(map[emp.id]);
    } else {
      roots.push(map[emp.id]);
    }
  }

  res.json({ roots, total: all.length });
});

// ── GET /api/trad-org-chart/state ──────────────────────────────────────────
// Returns the saved chart UI state (expanded nodes, etc.)
router.get('/state', authenticateToken, (_req, res) => {
  const row = db.prepare(`SELECT value FROM trad_chart_state WHERE key = 'ui_state'`).get();
  if (!row) return res.json({ expandedIds: null });
  try {
    res.json(JSON.parse(row.value));
  } catch {
    res.json({ expandedIds: null });
  }
});

// ── PUT /api/trad-org-chart/state ──────────────────────────────────────────
// Saves the chart UI state (expanded nodes, etc.)
router.put('/state', authenticateToken, (req, res) => {
  try {
    const value = JSON.stringify(req.body);
    db.prepare(`
      INSERT INTO trad_chart_state (key, value, updated_at)
      VALUES ('ui_state', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(value);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save trad state error:', err);
    res.status(500).json({ error: err.message || 'Failed to save state' });
  }
});

// ── GET /api/trad-org-chart/project-link ──────────────────────────────────
router.get('/project-link', authenticateToken, (_req, res) => {
  res.json({ projectId: getStoredProjectLink() });
});

// ── PUT /api/trad-org-chart/project-link ──────────────────────────────────
router.put('/project-link', authenticateToken, (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId?.trim()) return res.status(400).json({ error: 'projectId is required' });
  setStoredProjectLink(projectId.trim());
  res.json({ ok: true, projectId: projectId.trim() });
});

// ── POST /api/trad-org-chart/project-sync ─────────────────────────────────
router.post('/project-sync', authenticateToken, (req, res) => {
  try {
    const {
      createNew = false,
      projectId: requestedProjectId,
      name,
      title,
      description,
      state,
      lineColor,
      lineThickness,
      nodeColors,
      nodeSize,
    } = req.body || {};

    const linkedProjectId = !createNew ? (requestedProjectId || getStoredProjectLink()) : null;
    const pid = linkedProjectId || generateProjectId();
    const projectName = String(name || title || 'Traditional Org Chart').trim() || 'Traditional Org Chart';
    const chartTitle = String(title || projectName).trim() || 'Traditional Org Chart';

    db.exec('BEGIN');
    try {
      const existing = db.prepare('SELECT project_id FROM org_chart_projects WHERE project_id = ?').get(pid);
      if (existing) {
        db.prepare(`
          UPDATE org_chart_projects
          SET name = ?, type = 'traditional', chart_type = 'traditional', description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE project_id = ?
        `).run(projectName, sqlValue(description), pid);
      } else {
        db.prepare(`
          INSERT INTO org_chart_projects (project_id, name, type, chart_type, description, created_by, status)
          VALUES (?, ?, 'traditional', 'traditional', ?, ?, 'active')
        `).run(pid, projectName, sqlValue(description), req.user?.username || 'admin');
      }

      db.prepare('DELETE FROM proj_trad_employees WHERE project_id = ?').run(pid);
      db.prepare('DELETE FROM proj_trad_chart_state WHERE project_id = ?').run(pid);
      db.prepare('DELETE FROM proj_trad_node_colors WHERE project_id = ?').run(pid);
      db.prepare('DELETE FROM proj_trad_line_styles WHERE project_id = ?').run(pid);
      db.prepare('DELETE FROM proj_trad_chart_title WHERE project_id = ?').run(pid);
      db.prepare('DELETE FROM proj_trad_node_size WHERE project_id = ?').run(pid);

      const employees = db.prepare(`
        SELECT id, employee_id, name, designation, department, photo_url, manager_id, status
        FROM trad_employees
        ORDER BY created_at ASC
      `).all();

      const insertStmt = db.prepare(`
        INSERT INTO proj_trad_employees (project_id, employee_id, name, designation, department, photo_url, manager_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const projectEmployeeIds = {};
      for (const emp of employees) {
        const result = insertStmt.run(
          pid,
          emp.employee_id,
          emp.name,
          sqlValue(emp.designation),
          sqlValue(emp.department),
          sqlValue(emp.photo_url),
          null,
          sqlValue(emp.status) || 'Active',
        );
        projectEmployeeIds[emp.id] = result.lastInsertRowid;
      }

      const updateManagerStmt = db.prepare('UPDATE proj_trad_employees SET manager_id = ? WHERE id = ?');
      for (const emp of employees) {
        if (emp.manager_id && projectEmployeeIds[emp.manager_id] && projectEmployeeIds[emp.id]) {
          updateManagerStmt.run(projectEmployeeIds[emp.manager_id], projectEmployeeIds[emp.id]);
        }
      }

      db.prepare(`
        INSERT INTO proj_trad_chart_title (project_id, title, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP
      `).run(pid, chartTitle);

      db.prepare(`
        INSERT INTO proj_trad_line_styles (project_id, color, thickness, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id) DO UPDATE SET color = excluded.color, thickness = excluded.thickness, updated_at = CURRENT_TIMESTAMP
      `).run(pid, (lineColor || '#94a3b8').trim(), Math.max(1, Math.min(10, Number(lineThickness) || 2)));

      const colorEntries = Object.entries(nodeColors || {});
      const insertColorStmt = db.prepare(`
        INSERT INTO proj_trad_node_colors (project_id, employee_db_id, color, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id, employee_db_id) DO UPDATE SET color = excluded.color, updated_at = CURRENT_TIMESTAMP
      `);
      for (const [sourceEmployeeId, color] of colorEntries) {
        const projectEmployeeId = projectEmployeeIds[Number(sourceEmployeeId)];
        if (projectEmployeeId) {
          insertColorStmt.run(pid, projectEmployeeId, color);
        }
      }

      const cardW = Math.max(100, Math.min(500, Number(nodeSize?.cardW) || 180));
      const cardH = Math.max(60, Math.min(300, Number(nodeSize?.cardH) || 90));
      db.prepare(`
        INSERT INTO proj_trad_node_size (project_id, card_w, card_h, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id) DO UPDATE SET card_w = excluded.card_w, card_h = excluded.card_h, updated_at = CURRENT_TIMESTAMP
      `).run(pid, cardW, cardH);

      db.prepare(`
        INSERT INTO proj_trad_chart_state (project_id, key, value, updated_at)
        VALUES (?, 'ui_state', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(pid, JSON.stringify(state || {}));

      setStoredProjectLink(pid);
      db.exec('COMMIT');
      res.json({ ok: true, projectId: pid, projectName });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Project sync error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync chart to project' });
  }
});

// ── POST /api/trad-org-chart/share ─────────────────────────────────────────
// Creates a shareable web chart snapshot. Requires auth (editor only).
// Returns { id, url } — the url is the public viewer link.
router.post('/share', authenticateToken, (req, res) => {
  try {
    const { chartData } = req.body;
    if (!chartData) {
      return res.status(400).json({ error: 'chartData is required' });
    }

    // Generate a unique ID (timestamp + random hex)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const value = typeof chartData === 'string' ? chartData : JSON.stringify(chartData);

    db.prepare(`
      INSERT INTO trad_shared_charts (id, chart_data, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(id, value);

    res.status(201).json({ id, ok: true });
  } catch (err) {
    console.error('Share chart error:', err);
    res.status(500).json({ error: err.message || 'Failed to create shared chart' });
  }
});

// ── GET /api/trad-org-chart/share/:id ──────────────────────────────────────
// Public endpoint — NO authentication required.
// Returns the stored chart snapshot for the viewer.
// Checks both trad_shared_charts (legacy singleton) and proj_trad_shared_charts (project-scoped).
router.get('/share/:id', (req, res) => {
  try {
    // Check legacy table first
    let row = db.prepare(`SELECT chart_data FROM trad_shared_charts WHERE id = ?`).get(req.params.id);
    // Fall back to project-scoped shared charts
    if (!row) {
      row = db.prepare(`SELECT chart_data FROM proj_trad_shared_charts WHERE id = ?`).get(req.params.id);
    }
    if (!row) {
      return res.status(404).json({ error: 'Shared chart not found' });
    }
    let data;
    try {
      data = JSON.parse(row.chart_data);
    } catch {
      return res.status(500).json({ error: 'Invalid chart data' });
    }
    res.json(data);
  } catch (err) {
    console.error('Get shared chart error:', err);
    res.status(500).json({ error: err.message || 'Failed to load shared chart' });
  }
});

// ─── Shared helpers for both import formats ────────────────────────────────

/**
 * Normalise raw Excel row keys:
 *   "EMP CODE INDIA" → "emp_code_india"
 *   "EMPLOYEE NAME"  → "employee_name"
 * etc.
 */
function normaliseRows(rows) {
  return rows.map((row) => {
    const r = {};
    for (const [k, v] of Object.entries(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
    }
    return r;
  });
}

/** Return the first matching alias value from a normalised row, or '' */
function col(row, ...aliases) {
  for (const a of aliases) if (row[a] !== undefined) return row[a];
  return '';
}

/**
 * Normalise a name for comparison:
 *   - trim
 *   - collapse multiple spaces to single space
 *   - uppercase
 * This ensures "VEERANJAN  PRABHUSANKAR" matches "VEERANJAN PRABHUSANKAR"
 */
function normaliseName(str) {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Detect which format the Excel file uses and return a parsed array of:
 *   { rowNum, empId, name, desig, dept, reportsTo, _rawMgr, _mgrNotFound, ...newFields }
 *
 * Format A (original — UNCHANGED):
 *   Employee ID | Employee Name | Designation | Department | Reports To Employee ID
 *   reportsTo = manager's Employee ID string
 *
 * Format B (new):
 *   EMP CODE INDIA | EMPLOYEE NAME | DESIGNATION | DEPARTMENT | LINE MANAGER
 *   reportsTo = manager's EMP CODE INDIA (resolved by matching LINE MANAGER → EMPLOYEE NAME)
 *   If LINE MANAGER is blank / N/A / - / not found in sheet → reportsTo = '' (root node)
 *
 * NEW FIELDS (optional, empty cells allowed):
 *   Gender, Place, Date of Join (Previous Company), Date of Join in BB, Join Date,
 *   Date of Exit, Service Duration, Remarks, Status, Service in BB,
 *   Went To Company, Location of Went To Company, Currently Working Company,
 *   Location of Currently Working Company, Education, DOB, Immediate Previous Company
 *
 * Returns { parsed, format }
 */
function detectAndParse(data) {
  const keys = Object.keys(data[0] || {});
  const isFormatB = keys.some((k) => k === 'emp_code_india' || k === 'line_manager');

  if (isFormatB) {
    // ── Format B ──────────────────────────────────────────────────────────
    // First pass: build NORMALISED_NAME → empId map
    const nameToEmpId = {};
    for (const row of data) {
      const empId = col(row, 'emp_code_india');
      const name  = col(row, 'employee_name');
      if (name) {
        nameToEmpId[normaliseName(name)] = String(empId).trim();
      }
    }

    const parsed = data.map((row, idx) => {
      const rowNum  = idx + 2;
      const empId   = String(col(row, 'emp_code_india')).trim();
      const name    = col(row, 'employee_name');
      const desig   = col(row, 'designation');
      const dept    = col(row, 'department');
      const rawMgr  = col(row, 'line_manager');

      // Treat blank / N/A / - as root immediately
      const rootMarkers = ['', 'N/A', '-', 'NA', 'NONE', 'NULL'];
      const isExplicitRoot = rootMarkers.includes(normaliseName(rawMgr));

      let reportsTo    = '';
      let mgrNotFound  = false;

      if (!isExplicitRoot) {
        const mgrKey = normaliseName(rawMgr);
        if (nameToEmpId[mgrKey]) {
          reportsTo = nameToEmpId[mgrKey]; // manager's EMP CODE = reportsTo
        } else {
          // Manager not in this sheet → treat as root, remember for warning
          reportsTo   = '';
          mgrNotFound = true;
        }
      }

      // Extract new optional fields - empty cells are allowed
      return {
        rowNum, empId, name, desig, dept, reportsTo, _rawMgr: rawMgr, _mgrNotFound: mgrNotFound,
        gender: col(row, 'gender', 'sex'),
        place: col(row, 'place', 'location', 'city'),
        dateOfJoinPreviousCompany: col(row, 'date_of_join_previous_company', 'date_of_join_prev_company', 'join_date_previous'),
        dateOfJoinInBB: col(row, 'date_of_join_in_bb', 'date_of_join_bb', 'bb_join_date'),
        joinDate: col(row, 'join_date', 'joining_date'),
        dateOfExit: col(row, 'date_of_exit', 'exit_date', 'leaving_date'),
        serviceDuration: col(row, 'service_duration', 'duration', 'total_service'),
        remarks: col(row, 'remarks', 'comments', 'notes'),
        status: col(row, 'status', 'employment_status'),
        serviceInBB: col(row, 'service_in_bb', 'bb_service', 'service_bb'),
        wentToCompany: col(row, 'went_to_company', 'previous_company', 'left_for'),
        locationOfWentToCompany: col(row, 'location_of_went_to_company', 'went_to_location'),
        currentlyWorkingCompany: col(row, 'currently_working_company', 'current_company', 'present_company'),
        locationOfCurrentlyWorkingCompany: col(row, 'location_of_currently_working_company', 'current_company_location'),
        education: col(row, 'education', 'qualification', 'degree'),
        dob: col(row, 'dob', 'date_of_birth', 'birth_date'),
        immediatePreviousCompany: col(row, 'immediate_previous_company', 'immediate_prev_company'),
      };
    });

    return { parsed, format: 'B' };

  } else {
    // ── Format A (original — completely unchanged + new fields) ────────────────
    const parsed = data.map((row, idx) => {
      const rowNum    = idx + 2;
      const empId     = col(row, 'employee_id', 'emp_id', 'id', 'employeeid');
      const name      = col(row, 'employee_name', 'name', 'full_name', 'employeename');
      const desig     = col(row, 'designation', 'title', 'job_title');
      const dept      = col(row, 'department', 'dept');
      const reportsTo = col(row, 'reports_to_employee_id', 'reports_to', 'manager_id', 'reportsto', 'manager');

      // Extract new optional fields - empty cells are allowed
      return {
        rowNum, empId, name, desig, dept, reportsTo,
        gender: col(row, 'gender', 'sex'),
        place: col(row, 'place', 'location', 'city'),
        dateOfJoinPreviousCompany: col(row, 'date_of_join_previous_company', 'date_of_join_prev_company', 'join_date_previous'),
        dateOfJoinInBB: col(row, 'date_of_join_in_bb', 'date_of_join_bb', 'bb_join_date'),
        joinDate: col(row, 'join_date', 'joining_date'),
        dateOfExit: col(row, 'date_of_exit', 'exit_date', 'leaving_date'),
        serviceDuration: col(row, 'service_duration', 'duration', 'total_service'),
        remarks: col(row, 'remarks', 'comments', 'notes'),
        status: col(row, 'status', 'employment_status'),
        serviceInBB: col(row, 'service_in_bb', 'bb_service', 'service_bb'),
        wentToCompany: col(row, 'went_to_company', 'previous_company', 'left_for'),
        locationOfWentToCompany: col(row, 'location_of_went_to_company', 'went_to_location'),
        currentlyWorkingCompany: col(row, 'currently_working_company', 'current_company', 'present_company'),
        locationOfCurrentlyWorkingCompany: col(row, 'location_of_currently_working_company', 'current_company_location'),
        education: col(row, 'education', 'qualification', 'degree'),
        dob: col(row, 'dob', 'date_of_birth', 'birth_date'),
        immediatePreviousCompany: col(row, 'immediate_previous_company', 'immediate_prev_company'),
      };
    });
    return { parsed, format: 'A' };
  }
}

// ── POST /api/trad-org-chart/import/validate ────────────────────────────────
// Parses uploaded Excel file, validates it, and returns a summary report.
// Does NOT write anything to the database.
//
// Format A validation (original, unchanged):
//   - empId required
//   - name required
//   - no duplicate empIds
//   - reportsTo must reference a known empId (if set)
//   - circular reference check
//
// Format B validation (new):
//   - empId (EMP CODE INDIA) required
//   - name (EMPLOYEE NAME) required
//   - no duplicate empIds
//   - LINE MANAGER not found → warning only, NOT an error → row becomes root
//   - NO check that manager exists in sheet (by design)
//   - circular reference check only among relationships that resolved within sheet
router.post('/import/validate', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = (req.file.originalname || '').toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      return res.status(400).json({ error: 'Only .xlsx and .xls files are supported' });
    }

    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'The Excel file contains no data rows' });
    }

    const data = normaliseRows(rows);
    const { parsed, format } = detectAndParse(data);

    const errors   = [];
    const warnings = [];
    const seen     = new Set();

    // ── Required field checks (same for both formats) ──
    for (const p of parsed) {
      if (!p.empId) errors.push({ row: p.rowNum, field: 'Employee ID', message: `Row ${p.rowNum}: Missing Employee ID / EMP CODE INDIA` });
      if (!p.name)  errors.push({ row: p.rowNum, field: 'Employee Name', message: `Row ${p.rowNum}: Missing Employee Name` });
      if (p.empId && seen.has(p.empId)) errors.push({ row: p.rowNum, field: 'Employee ID', message: `Duplicate Employee ID: ${p.empId}` });
      if (p.empId) seen.add(p.empId);
    }

    if (format === 'A') {
      // ── Format A: manager must exist in the sheet ──
      const empIdSet = new Set(parsed.map((p) => p.empId).filter(Boolean));
      for (const p of parsed) {
        if (p.reportsTo && p.reportsTo !== '' && !empIdSet.has(p.reportsTo)) {
          errors.push({ row: p.rowNum, field: 'Reports To', message: `Row ${p.rowNum} (${p.empId}): Manager ID "${p.reportsTo}" not found` });
        }
      }
    } else {
      // ── Format B: manager not in sheet → warning only, row becomes root ──
      for (const p of parsed) {
        if (p._mgrNotFound && p._rawMgr) {
          warnings.push({
            row: p.rowNum,
            field: 'Line Manager',
            message: `Row ${p.rowNum} (${p.name}): Line Manager "${p._rawMgr}" not in this file — treated as root node`,
          });
        }
      }
    }

    // ── Circular reference check (only among resolved in-sheet relationships) ──
    const childOf = {};
    for (const p of parsed) {
      if (p.reportsTo) {
        if (!childOf[p.reportsTo]) childOf[p.reportsTo] = [];
        childOf[p.reportsTo].push(p.empId);
      }
    }
    function hasCycle(id, visited = new Set()) {
      if (visited.has(id)) return true;
      visited.add(id);
      for (const child of (childOf[id] || [])) {
        if (hasCycle(child, new Set(visited))) return true;
      }
      return false;
    }
    for (const p of parsed) {
      if (p.reportsTo && hasCycle(p.empId)) {
        errors.push({ row: p.rowNum, field: 'Reports To', message: `Circular reference detected for Employee ID: ${p.empId}` });
      }
    }

    const rootCount = parsed.filter((p) => !p.reportsTo || p.reportsTo === '').length;
    const relCount  = parsed.filter((p) =>  p.reportsTo && p.reportsTo !== '').length;

    res.json({
      valid:          errors.length === 0,
      total:          parsed.length,
      rootCount,
      relCount,
      errorCount:     errors.length,
      warnCount:      warnings.length,
      detectedFormat: format === 'B' ? 'Format B (EMP CODE INDIA / LINE MANAGER)' : 'Format A (Employee ID / Reports To Employee ID)',
      errors,
      warnings,
      preview:        parsed.slice(0, 5).map((p) => ({ empId: p.empId, name: p.name, desig: p.desig, dept: p.dept, reportsTo: p.reportsTo })),
    });
  } catch (err) {
    console.error('Validate import error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse Excel file' });
  }
});

// ── POST /api/trad-org-chart/import/execute ─────────────────────────────────
// Parses Excel, validates, then writes all employees into trad_employees.
// Supports APPEND (keeps existing) or REPLACE (clears existing first).
// Auto-detects Format A (Employee ID / Reports To Employee ID)
// and Format B (EMP CODE INDIA / LINE MANAGER).
//
// Both formats share the same DB write path because detectAndParse normalises
// everything to { empId, name, desig, dept, reportsTo } where reportsTo is
// always the manager's empId (or '' for root).
router.post('/import/execute', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mode = req.body.mode || 'replace'; // 'replace' | 'append'

    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const data = normaliseRows(rows);
    const { parsed: rawParsed, format } = detectAndParse(data);
    // Only keep rows that have both an id and a name
    const parsed = rawParsed.filter((p) => p.empId && p.name);

    db.exec('BEGIN');
    try {
      if (mode === 'replace') {
        db.exec('DELETE FROM trad_employees');
        db.prepare(`DELETE FROM trad_chart_state WHERE key = 'ui_state'`).run();
        // NOTE: We do NOT touch the shared `employees` or `relationships` tables.
        // Traditional Org Chart uses trad_employees exclusively.
        // Dashboard reads from trad_employees directly (see dashboard.js).
      }

      // Phase 1: Insert all employees (no manager_id yet) with new fields
      const insertStmt = db.prepare(`
        INSERT INTO trad_employees (
          employee_id, name, designation, department, manager_id,
          gender, place, date_of_join_previous_company, date_of_join_in_bb,
          join_date, date_of_exit, service_duration, remarks, status,
          service_in_bb, went_to_company, location_of_went_to_company,
          currently_working_company, location_of_currently_working_company,
          education, dob, immediate_previous_company
        )
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'Active'), ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id) DO UPDATE SET
          name = excluded.name,
          designation = COALESCE(excluded.designation, trad_employees.designation),
          department = COALESCE(excluded.department, trad_employees.department),
          gender = COALESCE(excluded.gender, trad_employees.gender),
          place = COALESCE(excluded.place, trad_employees.place),
          date_of_join_previous_company = COALESCE(excluded.date_of_join_previous_company, trad_employees.date_of_join_previous_company),
          date_of_join_in_bb = COALESCE(excluded.date_of_join_in_bb, trad_employees.date_of_join_in_bb),
          join_date = COALESCE(excluded.join_date, trad_employees.join_date),
          date_of_exit = COALESCE(excluded.date_of_exit, trad_employees.date_of_exit),
          service_duration = COALESCE(excluded.service_duration, trad_employees.service_duration),
          remarks = COALESCE(excluded.remarks, trad_employees.remarks),
          status = COALESCE(excluded.status, trad_employees.status),
          service_in_bb = COALESCE(excluded.service_in_bb, trad_employees.service_in_bb),
          went_to_company = COALESCE(excluded.went_to_company, trad_employees.went_to_company),
          location_of_went_to_company = COALESCE(excluded.location_of_went_to_company, trad_employees.location_of_went_to_company),
          currently_working_company = COALESCE(excluded.currently_working_company, trad_employees.currently_working_company),
          location_of_currently_working_company = COALESCE(excluded.location_of_currently_working_company, trad_employees.location_of_currently_working_company),
          education = COALESCE(excluded.education, trad_employees.education),
          dob = COALESCE(excluded.dob, trad_employees.dob),
          immediate_previous_company = COALESCE(excluded.immediate_previous_company, trad_employees.immediate_previous_company)
      `);
      for (const p of parsed) {
        insertStmt.run(
          p.empId, p.name, sqlValue(p.desig), sqlValue(p.dept),
          sqlValue(p.gender), sqlValue(p.place), sqlValue(p.dateOfJoinPreviousCompany),
          sqlValue(p.dateOfJoinInBB), sqlValue(p.joinDate), sqlValue(p.dateOfExit),
          sqlValue(p.serviceDuration), sqlValue(p.remarks), sqlValue(p.status) || 'Active',
          sqlValue(p.serviceInBB), sqlValue(p.wentToCompany), sqlValue(p.locationOfWentToCompany),
          sqlValue(p.currentlyWorkingCompany), sqlValue(p.locationOfCurrentlyWorkingCompany),
          sqlValue(p.education), sqlValue(p.dob), sqlValue(p.immediatePreviousCompany)
        );
      }

      // Phase 2: Resolve manager_id for each employee
      //   reportsTo already holds the manager's empId for both formats
      //   (Format B resolved name→empId inside detectAndParse)
      const allInserted = db.prepare('SELECT id, employee_id FROM trad_employees').all();
      const empIdToDbId = {};
      for (const r of allInserted) empIdToDbId[r.employee_id] = r.id;

      const updateStmt = db.prepare('UPDATE trad_employees SET manager_id = ? WHERE id = ?');
      for (const p of parsed) {
        if (p.reportsTo && empIdToDbId[p.reportsTo] && empIdToDbId[p.empId]) {
          updateStmt.run(empIdToDbId[p.reportsTo], empIdToDbId[p.empId]);
        }
        // If reportsTo is '' (root) or manager not in DB → manager_id stays NULL → root node
      }

      // Phase 3: Log to import history
      const rootCount = parsed.filter((p) => !p.reportsTo || p.reportsTo === '').length;
      const relCount  = parsed.filter((p) =>  p.reportsTo && p.reportsTo !== '').length;
      db.prepare(`
        INSERT INTO trad_import_history (file_name, imported_by, total_employees, root_count, relationship_count, error_count, status)
        VALUES (?, ?, ?, ?, ?, 0, 'success')
      `).run(req.file.originalname, req.user?.username || 'unknown', parsed.length, rootCount, relCount);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.json({ ok: true, imported: parsed.length, detectedFormat: format });
  } catch (err) {
    console.error('Execute import error:', err);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// ── GET /api/trad-org-chart/import/history ──────────────────────────────────
router.get('/import/history', authenticateToken, (_req, res) => {
  const rows = db.prepare(`
    SELECT id, file_name, imported_by, total_employees, root_count,
           relationship_count, error_count, status, created_at
    FROM trad_import_history
    ORDER BY created_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

// ── POST /api/trad-org-chart/import/regenerate/:historyId ───────────────────
// Re-applies the saved import (employees already in DB) — just resets state
// so the chart refreshes cleanly.
router.post('/import/regenerate/:historyId', authenticateToken, (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM trad_import_history WHERE id = ?').get(req.params.historyId);
    if (!entry) return res.status(404).json({ error: 'Import record not found' });
    // Reset ui_state so chart reloads with default expand
    db.prepare(`DELETE FROM trad_chart_state WHERE key = 'ui_state'`).run();
    res.json({ ok: true, message: 'Chart state reset — reload Traditional Org Chart to view' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to regenerate' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FEATURE ROUTES — additive only, no existing routes changed
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/trad-org-chart/title ───────────────────────────────────────────
router.get('/title', authenticateToken, (_req, res) => {
  const row = db.prepare('SELECT title FROM trad_chart_title WHERE id = 1').get();
  res.json({ title: row ? row.title : 'Traditional Org Chart' });
});

// ── PUT /api/trad-org-chart/title ───────────────────────────────────────────
router.put('/title', authenticateToken, (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    db.prepare(`
      INSERT INTO trad_chart_title (id, title, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP
    `).run(title.trim());
    res.json({ ok: true, title: title.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save title' });
  }
});

// ── GET /api/trad-org-chart/line-style ──────────────────────────────────────
router.get('/line-style', authenticateToken, (_req, res) => {
  const row = db.prepare('SELECT color, thickness FROM trad_line_styles WHERE id = 1').get();
  res.json({ color: row ? row.color : '#94a3b8', thickness: row ? row.thickness : 2 });
});

// ── PUT /api/trad-org-chart/line-style ──────────────────────────────────────
router.put('/line-style', authenticateToken, (req, res) => {
  try {
    const { color, thickness } = req.body;
    const c = color?.trim() || '#94a3b8';
    const t = Math.max(1, Math.min(10, Number(thickness) || 2));
    db.prepare(`
      INSERT INTO trad_line_styles (id, color, thickness, updated_at)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET color = excluded.color, thickness = excluded.thickness, updated_at = CURRENT_TIMESTAMP
    `).run(c, t);
    res.json({ ok: true, color: c, thickness: t });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save line style' });
  }
});

// GET /api/trad-org-chart/node-colors
router.get('/node-colors', authenticateToken, (_req, res) => {
  const rows = db.prepare('SELECT employee_id, color FROM trad_node_colors').all();
  const map = {};
  for (const r of rows) map[r.employee_id] = r.color;
  res.json(map);
});

// ── PUT /api/trad-org-chart/node-colors/:empId ──────────────────────────────
router.put('/node-colors/:empId', authenticateToken, (req, res) => {
  try {
    const empId = Number(req.params.empId);
    const { color } = req.body;
    if (!color?.trim()) return res.status(400).json({ error: 'Color is required' });
    const emp = db.prepare('SELECT id FROM trad_employees WHERE id = ?').get(empId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    db.prepare(`
      INSERT INTO trad_node_colors (employee_id, color, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(employee_id) DO UPDATE SET color = excluded.color, updated_at = CURRENT_TIMESTAMP
    `).run(empId, color.trim());
    res.json({ ok: true, employee_id: empId, color: color.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save node color' });
  }
});

// ── DELETE /api/trad-org-chart/node-colors/:empId ───────────────────────────
router.delete('/node-colors/:empId', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM trad_node_colors WHERE employee_id = ?').run(Number(req.params.empId));
  res.json({ ok: true });
});

// ── GET /api/trad-org-chart/node-size ───────────────────────────────────────
router.get('/node-size', authenticateToken, (_req, res) => {
  const row = db.prepare('SELECT card_w, card_h FROM trad_node_size WHERE id = 1').get();
  res.json({ cardW: row?.card_w || 180, cardH: row?.card_h || 90 });
});

// ── PUT /api/trad-org-chart/node-size ───────────────────────────────────────
router.put('/node-size', authenticateToken, (req, res) => {
  try {
    const { cardW, cardH } = req.body;
    const w = Math.max(100, Math.min(500, Number(cardW) || 180));
    const h = Math.max(60,  Math.min(300, Number(cardH) || 90));
    db.prepare(`
      INSERT INTO trad_node_size (id, card_w, card_h, updated_at)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET card_w = excluded.card_w, card_h = excluded.card_h, updated_at = CURRENT_TIMESTAMP
    `).run(w, h);
    res.json({ ok: true, cardW: w, cardH: h });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save node size' });
  }
});

export default router;
