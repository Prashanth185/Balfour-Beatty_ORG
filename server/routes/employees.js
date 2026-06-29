import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sqlValue, sqlInt } from '../utils/sql.js';

const router = Router();
// Must match dashboard.js — includes Live (Excel import value) + Active + NULL
const ACTIVE_STATUS_SQL = "status IN ('Live','Active','active','live') OR status IS NULL";

function enrichEmployee(emp) {
  if (!emp) return null;
  const managers = db.prepare(`
    SELECT e.id, e.name, e.designation, r.relationship_type
    FROM relationships r
    JOIN employees e ON e.id = r.manager_id
    WHERE r.employee_id = ?
  `).all(emp.id);

  const directReports = db.prepare(`
    SELECT e.id, e.name, e.designation, e.employee_id, r.relationship_type
    FROM relationships r
    JOIN employees e ON e.id = r.employee_id
    WHERE r.manager_id = ? AND r.relationship_type = 'reports_to'
  `).all(emp.id);

  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, ep.role
    FROM employee_projects ep
    JOIN projects p ON p.id = ep.project_id
    WHERE ep.employee_id = ?
  `).all(emp.id);

  const documents = db.prepare(`
    SELECT id, title, file_url, doc_type, uploaded_at
    FROM documents WHERE employee_id = ?
  `).all(emp.id);

  return { ...emp, managers, directReports, projects, documents };
}

const employeeSelect = `
  SELECT e.*,
    d.name as department,
    bu.name as business_unit,
    l.name as location,
    l.city,
    l.country,
    mgr.name as manager_name,
    mgr.employee_id as manager_employee_id
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN business_units bu ON bu.id = e.business_unit_id
  LEFT JOIN locations l ON l.id = e.location_id
  LEFT JOIN relationships r ON r.employee_id = e.id AND r.relationship_type = 'reports_to'
  LEFT JOIN employees mgr ON mgr.id = r.manager_id
`;

function resolveDepartmentId(department) {
  if (!department?.trim()) return null;
  const name = department.trim();
  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO departments (name) VALUES (?)').run(name).lastInsertRowid;
}

function resolveBusinessUnitId(business_unit) {
  if (!business_unit?.trim()) return null;
  const name = business_unit.trim();
  const existing = db.prepare('SELECT id FROM business_units WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO business_units (name) VALUES (?)').run(name).lastInsertRowid;
}

function resolveLocationId(location) {
  if (!location?.trim()) return null;
  const name = location.trim();
  const existing = db.prepare('SELECT id FROM locations WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO locations (name) VALUES (?)').run(name).lastInsertRowid;
}

router.get('/', authenticateToken, (req, res) => {
  const { search, department, location, designation } = req.query;
  // Exclude employees that were imported via Traditional Org Chart (present in trad_employees)
  // so they don't appear on the Manual Org Chart canvas or its dropdown.
  let query = employeeSelect + ` WHERE NOT EXISTS (
    SELECT 1 FROM trad_employees te WHERE te.employee_id = e.employee_id
  )`;
  const params = [];

  if (search) {
    query += ` AND (e.name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ? OR e.designation LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (department) {
    query += ' AND d.name = ?';
    params.push(department);
  }
  if (location) {
    query += ' AND l.name = ?';
    params.push(location);
  }
  if (designation) {
    query += ' AND e.designation LIKE ?';
    params.push(`%${designation}%`);
  }

  query += ' ORDER BY e.name';
  const employees = db.prepare(query).all(...params);
  res.json(employees);
});

// ── Employee Master Data with Advanced Filtering ─────────────────────────────
router.get('/master', authenticateToken, (req, res) => {
  const {
    search,
    department,
    gender,
    status,
    place,
    education,
    serviceDuration,
    serviceInBB,
    joinDateRange,
    exitDateRange,
    currentCompany,
    immediatePreviousCompany,
    source,       // 'trad' → read from trad_employees (for dashboard KPI modals)
    page = 1,
    limit = 50,
    sortBy = 'name',
    sortOrder = 'ASC',
  } = req.query;

  // ── Source: trad_employees (Dashboard KPI modals) ───────────────────────────
  // Dashboard stats are calculated from trad_employees, so the modal must also
  // read from trad_employees to guarantee count parity.
  if (source === 'trad') {
    const VALID_SORT = ['name','employee_id','designation','department','status','gender','place','education'];
    const col   = VALID_SORT.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let where = 'WHERE 1=1';
    const p = [];

    if (search) {
      where += ` AND (name LIKE ? OR employee_id LIKE ? OR designation LIKE ? OR department LIKE ?)`;
      const t = `%${search}%`;
      p.push(t, t, t, t);
    }
    if (department && department !== 'All') { where += ' AND department = ?'; p.push(department); }
    if (place      && place      !== 'All') { where += ' AND place = ?';      p.push(place); }
    if (education  && education  !== 'All') { where += ' AND education = ?';  p.push(education); }

    if (gender && gender !== 'All') {
      if (gender === 'Male')
        where += ` AND gender IN ('M','Male','male','m')`;
      else if (gender === 'Female')
        where += ` AND gender IN ('F','Female','female','f')`;
      else if (gender === 'Other')
        where += ` AND (gender IS NULL OR TRIM(gender) = '' OR gender NOT IN ('M','Male','male','m','F','Female','female','f'))`;
      else { where += ' AND gender = ?'; p.push(gender); }
    }
    if (status && status !== 'All') {
      if (status === 'Active')
        where += ` AND (${ACTIVE_STATUS_SQL})`;
      else if (status === 'Exited')
        where += ` AND status IN ('Leaver','Exited','exited','Resigned','resigned','Terminated','terminated','Inactive','inactive')`;
      else { where += ' AND status = ?'; p.push(status); }
    }

    const VALID_SORT_TRAD = ['name','employee_id','designation','department','status','gender','place','education'];
    const sortColTrad = VALID_SORT_TRAD.includes(sortBy) ? sortBy : 'name';
    const orderTrad   = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const offsetTrad  = (parseInt(page) - 1) * parseInt(limit);

    const rows  = db.prepare(`
      SELECT te.*,
             mgr.name AS manager_name,
             mgr.employee_id AS manager_employee_id
      FROM trad_employees te
      LEFT JOIN trad_employees mgr ON mgr.id = te.manager_id
      ${where} ORDER BY ${sortColTrad} ${orderTrad} LIMIT ? OFFSET ?
    `).all(...p, parseInt(limit), offsetTrad);
    const total = db.prepare(`SELECT COUNT(*) as c FROM trad_employees ${where}`).get(...p).c;

    return res.json({
      employees: rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }

  let query = employeeSelect + ' WHERE 1=1';
  const params = [];

  // Global search
  if (search) {
    query += ` AND (e.name LIKE ? OR e.employee_id LIKE ? OR e.designation LIKE ? OR d.name LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  // Department filter
  if (department && department !== 'All') {
    query += ' AND d.name = ?';
    params.push(department);
  }

  // Gender filter — match both short ('M'/'F') and full ('Male'/'Female') forms
  if (gender && gender !== 'All') {
    if (gender === 'Male') {
      query += ` AND (e.gender = 'M' OR e.gender = 'Male' OR e.gender = 'male' OR e.gender = 'm')`;
    } else if (gender === 'Female') {
      query += ` AND (e.gender = 'F' OR e.gender = 'Female' OR e.gender = 'female' OR e.gender = 'f')`;
    } else {
      query += ' AND e.gender = ?';
      params.push(gender);
    }
  }

  // Status filter — match both Excel values ('Live'/'Leaver') and display values
  if (status && status !== 'All') {
    if (status === 'Active') {
      query += ` AND LOWER(TRIM(e.status)) = 'active'`;
    } else if (status === 'Exited') {
      query += ` AND LOWER(TRIM(e.status)) IN ('exited','resigned','terminated','inactive','leaver')`;
    } else {
      query += ' AND e.status = ?';
      params.push(status);
    }
  }

  // Place filter
  if (place && place !== 'All') {
    query += ' AND e.place = ?';
    params.push(place);
  }

  // Education filter
  if (education && education !== 'All' && education !== 'Unknown') {
    query += ' AND e.education = ?';
    params.push(education);
  }

  // Service duration filter (parse range)
  if (serviceDuration && serviceDuration !== 'All') {
    const ranges = {
      '0-2 Years': [0, 2],
      '2-5 Years': [2, 5],
      '5-10 Years': [5, 10],
      '10-15 Years': [10, 15],
      '15+ Years': [15, 100],
    };
    const [min, max] = ranges[serviceDuration] || [0, 100];
    query += ` AND (
      CAST(SUBSTR(e.service_duration, 1, CASE WHEN INSTR(e.service_duration, ' ') > 0 THEN INSTR(e.service_duration, ' ') - 1 ELSE LENGTH(e.service_duration) END) AS REAL) >= ? AND
      CAST(SUBSTR(e.service_duration, 1, CASE WHEN INSTR(e.service_duration, ' ') > 0 THEN INSTR(e.service_duration, ' ') - 1 ELSE LENGTH(e.service_duration) END) AS REAL) < ?
    )`;
    params.push(min, max);
  }

  // Service in BB filter (parse range)
  if (serviceInBB && serviceInBB !== 'All') {
    const ranges = {
      '0-1 Year': [0, 1],
      '1-3 Years': [1, 3],
      '3-5 Years': [3, 5],
      '5-10 Years': [5, 10],
      '10+ Years': [10, 100],
    };
    const [min, max] = ranges[serviceInBB] || [0, 100];
    query += ` AND (
      CAST(SUBSTR(e.service_in_bb, 1, CASE WHEN INSTR(e.service_in_bb, ' ') > 0 THEN INSTR(e.service_in_bb, ' ') - 1 ELSE LENGTH(e.service_in_bb) END) AS REAL) >= ? AND
      CAST(SUBSTR(e.service_in_bb, 1, CASE WHEN INSTR(e.service_in_bb, ' ') > 0 THEN INSTR(e.service_in_bb, ' ') - 1 ELSE LENGTH(e.service_in_bb) END) AS REAL) < ?
    )`;
    params.push(min, max);
  }

  // Join date filter
  if (joinDateRange && joinDateRange !== 'All') {
    const now = new Date();
    let startDate;
    if (joinDateRange === 'Last 30 Days') startDate = new Date(now.setDate(now.getDate() - 30));
    else if (joinDateRange === 'Last 6 Months') startDate = new Date(now.setMonth(now.getMonth() - 6));
    else if (joinDateRange === 'Last 1 Year') startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    if (startDate) {
      query += ' AND e.join_date >= ?';
      params.push(startDate.toISOString().split('T')[0]);
    }
  }

  // Exit date filter
  if (exitDateRange && exitDateRange !== 'All') {
    const now = new Date();
    let startDate;
    if (exitDateRange === 'Last 30 Days') startDate = new Date(now.setDate(now.getDate() - 30));
    else if (exitDateRange === 'Last 6 Months') startDate = new Date(now.setMonth(now.getMonth() - 6));
    else if (exitDateRange === 'Last 1 Year') startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    if (startDate) {
      query += ' AND e.date_of_exit >= ?';
      params.push(startDate.toISOString().split('T')[0]);
    }
  }

  // Current company filter
  if (currentCompany && currentCompany !== 'All') {
    query += ' AND e.currently_working_company = ?';
    params.push(currentCompany);
  }

  // Immediate previous company filter
  if (immediatePreviousCompany && immediatePreviousCompany !== 'All') {
    query += ' AND e.immediate_previous_company = ?';
    params.push(immediatePreviousCompany);
  }

  // ── Dashboard drill-down filters (new — additive only) ─────────────────────
  const { joinYear, joinMonth, spanBucket } = req.query;

  // Sorting
  const validSortColumns = ['name', 'employee_id', 'designation', 'status', 'gender', 'place', 'education'];
  const sortColumn = validSortColumns.includes(sortBy) ? `e.${sortBy}` : 'e.name';
  const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  query += ` ORDER BY ${sortColumn} ${order}`;

  // ── Helper: parse any date format → year + YYYY-MM string ─────────────────
  function parseDateYearMonth(raw) {
    if (!raw) return { year: null, ym: null };
    const d = String(raw).trim();
    // Excel serial
    const n = Number(d);
    if (!isNaN(n) && n > 1000 && n < 200000) {
      const dt = new Date(new Date(1900, 0, 1).getTime() + (n - 2) * 86400000);
      return {
        year: String(dt.getFullYear()),
        ym:   `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`,
      };
    }
    // ISO YYYY-MM-DD
    if (/^\d{4}[-/]\d{2}/.test(d)) return { year: d.slice(0, 4), ym: d.slice(0, 7).replace('/', '-') };
    // DD-MM-YYYY
    const m = d.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) return { year: m[3], ym: `${m[3]}-${m[2]}` };
    return { year: null, ym: null };
  }

  const needsJSFilter = !!(joinYear || joinMonth || spanBucket);

  // When JS post-filtering is needed, fetch ALL rows (no pagination), filter in JS, then slice
  if (needsJSFilter) {
    const allRows = db.prepare(query).all(...params);

    let filtered = allRows;

    if (joinYear) {
      filtered = filtered.filter(e => parseDateYearMonth(e.join_date).year === joinYear);
    }
    if (joinMonth) {
      filtered = filtered.filter(e => parseDateYearMonth(e.join_date).ym === joinMonth);
    }
    if (spanBucket) {
      // spanBucket = '2–3' | '4–6' | '7–10' | '10+' — need managers whose team size falls in bucket
      const allTeams = db.prepare(`
        SELECT manager_id, COUNT(*) as team_size
        FROM relationships WHERE relationship_type = 'reports_to'
        GROUP BY manager_id
      `).all();
      const bucketMap = {
        '2–3':  [2, 3],
        '4–6':  [4, 6],
        '7–10': [7, 10],
        '10+':  [11, 99999],
      };
      const [lo, hi] = bucketMap[spanBucket] || [0, 99999];
      const validMgrIds = new Set(
        allTeams.filter(t => t.team_size >= lo && t.team_size <= hi).map(t => t.manager_id)
      );
      filtered = filtered.filter(e => validMgrIds.has(e.id));
      // Annotate with direct report count for display
      const countMap = {};
      allTeams.forEach(t => { countMap[t.manager_id] = t.team_size; });
      filtered = filtered.map(e => ({ ...e, direct_reports_count: countMap[e.id] || 0 }));
    }

    const total = filtered.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const sliced = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({
      employees: sliced,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  }

  // Standard path — pagination in SQL
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const employees = db.prepare(query).all(...params);

  // Total count — rebuild query without ORDER BY / LIMIT
  const baseQuery = query
    .replace(/ORDER BY.*$/s, '')
    .replace(/LIMIT \? OFFSET \?/, '');
  const countQuery = `SELECT COUNT(*) as count FROM (${baseQuery}) sub`;
  const total = db.prepare(countQuery).get(...params.slice(0, -2))?.count || 0;

  res.json({
    employees,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
});

router.get('/filters', authenticateToken, (req, res) => {
  // If source=trad, return filter values from trad_employees
  if (req.query.source === 'trad') {
    const departments = db.prepare("SELECT DISTINCT department FROM trad_employees WHERE department IS NOT NULL AND department != '' ORDER BY department").all().map(r => r.department);
    const places = db.prepare("SELECT DISTINCT place FROM trad_employees WHERE place IS NOT NULL AND place != '' ORDER BY place").all().map(r => r.place);
    const educations = db.prepare("SELECT DISTINCT education FROM trad_employees WHERE education IS NOT NULL AND education != '' ORDER BY education").all().map(r => r.education);
    const currentCompanies = db.prepare("SELECT DISTINCT currently_working_company FROM trad_employees WHERE currently_working_company IS NOT NULL AND currently_working_company != '' ORDER BY currently_working_company").all().map(r => r.currently_working_company);
    const immediatePreviousCompanies = db.prepare("SELECT DISTINCT immediate_previous_company FROM trad_employees WHERE immediate_previous_company IS NOT NULL AND immediate_previous_company != '' ORDER BY immediate_previous_company").all().map(r => r.immediate_previous_company);
    return res.json({
      departments,
      locations: [],
      designations: [],
      businessUnits: [],
      genders: ['Male', 'Female'],
      statuses: [],
      places,
      educations,
      currentCompanies,
      immediatePreviousCompanies,
    });
  }

  const departments = db.prepare('SELECT DISTINCT name FROM departments ORDER BY name').all().map(r => r.name);
  const locations = db.prepare('SELECT DISTINCT name FROM locations ORDER BY name').all().map(r => r.name);
  const designations = db.prepare('SELECT DISTINCT designation FROM employees WHERE designation IS NOT NULL ORDER BY designation').all().map(r => r.designation);
  const businessUnits = db.prepare('SELECT DISTINCT name FROM business_units ORDER BY name').all().map(r => r.name);
  
  // New filter options
  const genders = db.prepare("SELECT DISTINCT gender FROM employees WHERE gender IS NOT NULL AND gender != '' ORDER BY gender").all().map(r => r.gender);
  const statuses = db.prepare("SELECT DISTINCT status FROM employees WHERE status IS NOT NULL AND status != '' ORDER BY status").all().map(r => r.status);
  const places = db.prepare("SELECT DISTINCT place FROM employees WHERE place IS NOT NULL AND place != '' ORDER BY place").all().map(r => r.place);
  const educations = db.prepare("SELECT DISTINCT education FROM employees WHERE education IS NOT NULL AND education != '' ORDER BY education").all().map(r => r.education);
  const currentCompanies = db.prepare("SELECT DISTINCT currently_working_company FROM employees WHERE currently_working_company IS NOT NULL AND currently_working_company != '' ORDER BY currently_working_company").all().map(r => r.currently_working_company);
  const immediatePreviousCompanies = db.prepare("SELECT DISTINCT immediate_previous_company FROM employees WHERE immediate_previous_company IS NOT NULL AND immediate_previous_company != '' ORDER BY immediate_previous_company").all().map(r => r.immediate_previous_company);
  
  res.json({ 
    departments, 
    locations, 
    designations, 
    businessUnits,
    // New filter options
    genders,
    statuses,
    places,
    educations,
    currentCompanies,
    immediatePreviousCompanies,
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  res.json(enrichEmployee(emp));
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      employee_id, name, designation, department, business_unit, location,
      email, phone, photo_url, bio, reporting_to,
    } = req.body;

    if (!employee_id?.trim() || !name?.trim()) {
      return res.status(400).json({ error: 'Employee ID and name are required' });
    }

    const departmentId = resolveDepartmentId(department);
    const buId = resolveBusinessUnitId(business_unit);
    const locId = resolveLocationId(location);

    const result = db.prepare(`
      INSERT INTO employees (employee_id, name, designation, department_id, business_unit_id, location_id, email, phone, photo_url, bio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee_id.trim(),
      name.trim(),
      sqlValue(designation),
      sqlInt(departmentId),
      sqlInt(buId),
      sqlInt(locId),
      sqlValue(email),
      sqlValue(phone),
      sqlValue(photo_url),
      sqlValue(bio),
    );

    const newId = result.lastInsertRowid;

    if (reporting_to) {
      const managerIds = Array.isArray(reporting_to) ? reporting_to : [reporting_to];
      const insertRel = db.prepare(`
        INSERT OR IGNORE INTO relationships (employee_id, manager_id, relationship_type)
        VALUES (?, ?, 'reports_to')
      `);
      for (const mgrId of managerIds) {
        insertRel.run(newId, Number(mgrId));
      }
    }

    const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(newId);
    res.status(201).json(enrichEmployee(emp));
  } catch (err) {
    console.error('Create employee error:', err);
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to save employee' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    const {
      employee_id, name, designation, department, business_unit, location,
      email, phone, photo_url, bio,
    } = req.body;

    const departmentId = resolveDepartmentId(department);
    const buId = resolveBusinessUnitId(business_unit);
    const locId = resolveLocationId(location);

    db.prepare(`
      UPDATE employees SET
        employee_id = ?,
        name = ?,
        designation = ?,
        department_id = ?,
        business_unit_id = ?,
        location_id = ?,
        email = ?,
        phone = ?,
        photo_url = ?,
        bio = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      employee_id?.trim() || existing.employee_id,
      name?.trim() || existing.name,
      sqlValue(designation),
      sqlInt(departmentId),
      sqlInt(buId),
      sqlInt(locId),
      sqlValue(email),
      sqlValue(phone),
      sqlValue(photo_url),
      sqlValue(bio),
      req.params.id,
    );

    const emp = db.prepare(employeeSelect + ' WHERE e.id = ?').get(req.params.id);
    res.json(enrichEmployee(emp));
  } catch (err) {
    console.error('Update employee error:', err);
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to update employee' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ message: 'Employee deleted successfully' });
});

export default router;
