import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const ACTIVE_STATUS_SQL = "status IN ('Live','Active','active','live') OR status IS NULL";

// ── Shared helpers ──────────────────────────────────────────────────────────────

function parseLeadingNumber(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const d = String(dateStr).trim();
  const asNum = Number(d);
  if (!isNaN(asNum) && asNum > 1000 && asNum < 200000) {
    const dt = new Date(new Date(1900, 0, 1).getTime() + (asNum - 2) * 86400000);
    return String(dt.getFullYear());
  }
  if (/^\d{4}[-/]/.test(d)) return d.slice(0, 4);
  const m = d.match(/(\d{4})$/);
  return m ? m[1] : null;
}

function extractMonth(dateStr) {
  if (!dateStr) return null;
  const d = String(dateStr).trim();
  const asNum = Number(d);
  if (!isNaN(asNum) && asNum > 1000 && asNum < 200000) {
    const dt = new Date(new Date(1900, 0, 1).getTime() + (asNum - 2) * 86400000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }
  if (/^\d{4}[-/]\d{2}/.test(d)) return d.slice(0, 7).replace('/', '-');
  const m = d.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}`;
  return null;
}

router.get('/stats', authenticateToken, (_req, res) => {
  // ── All stats read from trad_employees (Traditional Org Chart source of truth).
  // The shared `employees` table is reserved for manually-added employees only
  // and must NOT be polluted by Traditional Org Chart imports.
  // This ensures Manual Org Chart and Traditional Org Chart remain fully isolated.

  const totalEmployees     = db.prepare('SELECT COUNT(*) as count FROM trad_employees').get().count;
  const totalDepartments   = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
  const totalBusinessUnits = db.prepare('SELECT COUNT(*) as count FROM business_units').get().count;
  const totalLocations     = db.prepare('SELECT COUNT(*) as count FROM locations').get().count;
  const totalRelationships = db.prepare('SELECT COUNT(*) as count FROM relationships').get().count;

  // maleEmployees / femaleEmployees — active only (matches top KPI card labels)
  const maleEmployees = db.prepare(`SELECT COUNT(*) as count FROM trad_employees
    WHERE (${ACTIVE_STATUS_SQL}) AND gender IN ('M','Male','male','m')`).get().count;
  const femaleEmployees = db.prepare(`SELECT COUNT(*) as count FROM trad_employees
    WHERE (${ACTIVE_STATUS_SQL}) AND gender IN ('F','Female','female','f')`).get().count;
  const activeEmployees = db.prepare(`SELECT COUNT(*) as count FROM trad_employees
    WHERE ${ACTIVE_STATUS_SQL}`).get().count;
  // Employees with unclassified gender (NULL, blank, or not M/F) — active only
  // Computed by subtraction so Male + Female + Other always equals Active exactly.
  const otherGenderEmployees = Math.max(0, activeEmployees - maleEmployees - femaleEmployees);
  const exitedEmployees = db.prepare(`SELECT COUNT(*) as count FROM trad_employees
    WHERE status IN ('Leaver','Exited','exited')`).get().count;

  const empSD = db.prepare(`SELECT service_duration FROM trad_employees WHERE service_duration IS NOT NULL AND service_duration != ''`).all();
  let avgServiceDuration = 0;
  if (empSD.length > 0) {
    const t = empSD.reduce((s, e) => s + (parseLeadingNumber(e.service_duration) || 0), 0);
    avgServiceDuration = (t / empSD.length).toFixed(1);
  }

  const empSI = db.prepare(`SELECT service_in_bb FROM trad_employees WHERE service_in_bb IS NOT NULL AND service_in_bb != ''`).all();
  let avgServiceInBB = 0;
  if (empSI.length > 0) {
    const t = empSI.reduce((s, e) => s + (parseLeadingNumber(e.service_in_bb) || 0), 0);
    avgServiceInBB = (t / empSI.length).toFixed(1);
  }

  const currentYear   = String(new Date().getFullYear());
  // newJoinersThisYear — active employees only whose join_date is this year
  const allJoinDates  = db.prepare(`SELECT join_date FROM trad_employees WHERE (${ACTIVE_STATUS_SQL}) AND join_date IS NOT NULL AND join_date != ''`).all();
  const newJoinersThisYear = allJoinDates.filter(({ join_date }) => extractYear(join_date) === currentYear).length;

  const allExitDates = db.prepare(`SELECT date_of_exit FROM trad_employees WHERE date_of_exit IS NOT NULL AND date_of_exit != '' AND status IN ('Leaver','Exited','exited')`).all();
  const employeesLeftThisYear = allExitDates.filter(({ date_of_exit }) => extractYear(date_of_exit) === currentYear).length;

  const employeesByDepartment = db.prepare(`
    SELECT department, COUNT(*) as count FROM trad_employees
    WHERE department IS NOT NULL AND department != ''
    GROUP BY department HAVING COUNT(*) > 0 ORDER BY count DESC
  `).all();

  const employeesByLocation = db.prepare(`
    SELECT place as location, COUNT(*) as count FROM trad_employees
    WHERE place IS NOT NULL AND place != ''
    GROUP BY place ORDER BY count DESC
  `).all();

  const recentEmployees = db.prepare(`
    SELECT id, employee_id, name, designation, department, created_at
    FROM trad_employees ORDER BY created_at DESC LIMIT 10
  `).all();

  // ── Growth by Year ─────────────────────────────────────────────────────────
  const allJD = db.prepare(`SELECT join_date FROM trad_employees WHERE ${ACTIVE_STATUS_SQL} AND join_date IS NOT NULL AND join_date != ''`).all();
  const byYear = {};
  allJD.forEach(({ join_date }) => { const y = extractYear(join_date); if (y) byYear[y] = (byYear[y] || 0) + 1; });
  const growthByYear = Object.entries(byYear).sort(([a],[b]) => a.localeCompare(b)).map(([year,count]) => ({ year, count }));

  // ── Growth by Month ────────────────────────────────────────────────────────
  const byMonth = {};
  allJD.forEach(({ join_date }) => { const m = extractMonth(join_date); if (m) byMonth[m] = (byMonth[m] || 0) + 1; });
  const growthByMonth = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).slice(-24).map(([month,count]) => ({ month, count }));

  // ── Gender by Department ───────────────────────────────────────────────────
  const genderByDeptRows = db.prepare(`
    SELECT department,
      SUM(CASE WHEN gender IN ('M','Male','male','m') THEN 1 ELSE 0 END) as male,
      SUM(CASE WHEN gender IN ('F','Female','female','f') THEN 1 ELSE 0 END) as female
    FROM trad_employees WHERE ${ACTIVE_STATUS_SQL} AND department IS NOT NULL AND department != ''
    GROUP BY department HAVING COUNT(*) > 0 ORDER BY (male+female) DESC LIMIT 12
  `).all();

  // ── Education ─────────────────────────────────────────────────────────────
  const eduRows = db.prepare(`
    SELECT COALESCE(NULLIF(education,''),'Unknown') as education, COUNT(*) as count
    FROM trad_employees WHERE ${ACTIVE_STATUS_SQL} GROUP BY education ORDER BY count DESC
  `).all();

  // ── Experience Buckets ────────────────────────────────────────────────────
  const allSD2 = db.prepare(`SELECT service_duration FROM trad_employees WHERE ${ACTIVE_STATUS_SQL}`).all();
  const expBuckets = { '0–2 Yrs':0, '2–5 Yrs':0, '5–10 Yrs':0, '10+ Yrs':0 };
  allSD2.forEach(({ service_duration }) => {
    const n = parseLeadingNumber(service_duration);
    if (n === null) return;
    if (n < 2) expBuckets['0–2 Yrs']++;
    else if (n < 5) expBuckets['2–5 Yrs']++;
    else if (n < 10) expBuckets['5–10 Yrs']++;
    else expBuckets['10+ Yrs']++;
  });
  const experienceDistribution = Object.entries(expBuckets).map(([range,count]) => ({ range, count })).filter(d => d.count > 0);

  // ── Location Distribution ─────────────────────────────────────────────────
  const locationRows = db.prepare(`
    SELECT place as location, COUNT(*) as count FROM trad_employees
    WHERE ${ACTIVE_STATUS_SQL} AND place IS NOT NULL AND place != ''
    GROUP BY place HAVING COUNT(*) > 0 ORDER BY count DESC
  `).all();

  // ── Manager analytics (from trad_employees.manager_id) ───────────────────
  // teamSizes: only managers who have at least 1 active direct report
  const teamSizes = db.prepare(`
    SELECT manager_id, COUNT(*) as team_size FROM trad_employees
    WHERE (${ACTIVE_STATUS_SQL})
      AND manager_id IS NOT NULL
      AND manager_id IN (SELECT id FROM trad_employees WHERE (${ACTIVE_STATUS_SQL}))
    GROUP BY manager_id
    HAVING COUNT(*) >= 1
    ORDER BY team_size DESC
  `).all();
  const managersCount = teamSizes.length;
  const icCount       = activeEmployees - managersCount;
  const avgTeamSize   = managersCount > 0 ? (teamSizes.reduce((s,r) => s + r.team_size, 0) / managersCount).toFixed(1) : 0;

  const spanBuckets2 = { '2–3':0, '4–6':0, '7–10':0, '10+':0 };
  teamSizes.forEach(({ team_size: s }) => {
    if (s <= 1) return;
    if (s <= 3) spanBuckets2['2–3']++;
    else if (s <= 6) spanBuckets2['4–6']++;
    else if (s <= 10) spanBuckets2['7–10']++;
    else spanBuckets2['10+']++;
  });
  const spanDistribution = Object.entries(spanBuckets2).map(([span,count]) => ({ span, count }));

  // ── Orphan / hierarchy ────────────────────────────────────────────────────
  // Orphan = active employee with NO manager (manager_id IS NULL) who is also
  // NOT a manager of any other active employee.
  // Root nodes who manage others are NOT orphans — they are hierarchy roots.
  const orphanCount = db.prepare(`
    SELECT COUNT(*) as count FROM trad_employees te
    WHERE (${ACTIVE_STATUS_SQL})
      AND te.manager_id IS NULL
      AND te.id NOT IN (
        SELECT DISTINCT manager_id FROM trad_employees
        WHERE manager_id IS NOT NULL
          AND (${ACTIVE_STATUS_SQL})
      )
  `).get().count;

  const noDirectReports = db.prepare(`
    SELECT COUNT(*) as count FROM trad_employees te
    WHERE (${ACTIVE_STATUS_SQL})
      AND te.id NOT IN (
        SELECT DISTINCT manager_id FROM trad_employees
        WHERE manager_id IS NOT NULL
          AND (${ACTIVE_STATUS_SQL})
      )
  `).get().count;

  const crossDeptCount = db.prepare(`
    SELECT COUNT(*) as count FROM trad_employees e
    JOIN trad_employees m ON m.id = e.manager_id
    WHERE (${ACTIVE_STATUS_SQL.replaceAll('status', 'e.status')})
      AND (${ACTIVE_STATUS_SQL.replaceAll('status', 'm.status')})
      AND e.department IS NOT NULL AND m.department IS NOT NULL AND e.department != m.department
  `).get().count;

  // Max depth BFS — build from ALL active employees
  let maxDepth = 0;
  const allActiveIds = db.prepare(`SELECT id, manager_id FROM trad_employees WHERE (${ACTIVE_STATUS_SQL})`).all();
  const childMap = {};
  allActiveIds.forEach(({ id, manager_id }) => {
    if (manager_id !== null && manager_id !== undefined) {
      if (!childMap[manager_id]) childMap[manager_id] = [];
      childMap[manager_id].push(id);
    }
  });
  // Roots = active employees whose manager_id is NULL OR whose manager is not active
  const activeIdSet = new Set(allActiveIds.map(r => r.id));
  const roots = allActiveIds
    .filter(r => r.manager_id === null || r.manager_id === undefined || !activeIdSet.has(r.manager_id))
    .map(r => r.id);

  function calcDepth(id, visited = new Set()) {
    if (visited.has(id) || !childMap[id]) return 1;
    visited.add(id);
    return 1 + Math.max(0, ...childMap[id].map(c => calcDepth(c, new Set(visited))));
  }
  if (roots.length > 0 && Object.keys(childMap).length > 0) {
    for (const r of roots) {
      const d = calcDepth(r);
      if (d > maxDepth) maxDepth = d;
    }
  } else {
    maxDepth = roots.length > 0 ? 1 : 0;
  }

  const totalHierarchyLevels  = maxDepth;
  const reportingCompleteness = activeEmployees > 0
    ? (((activeEmployees - orphanCount) / activeEmployees) * 100).toFixed(1)
    : 0;

  // ── Detail data for clickable modals ──────────────────────────────────────
  // IMPORTANT: members query uses identical filter as teamSizes so count always matches KPI.
  const largestTeamDetail = (() => {
    if (!teamSizes.length) return null;
    const top = teamSizes[0];
    const mgr = db.prepare(
      `SELECT id, employee_id, name, designation, department FROM trad_employees WHERE id = ?`
    ).get(top.manager_id);
    const members = db.prepare(`
      SELECT id, employee_id, name, designation, department FROM trad_employees
      WHERE (${ACTIVE_STATUS_SQL}) AND manager_id = ?
      ORDER BY name
    `).all(top.manager_id);
    return { manager: mgr, members, teamSize: top.team_size };
  })();

  // Smallest Team = manager with fewest direct reports, among managers with ≥1 report.
  // teamSizes is ordered DESC so last element has the smallest team_size (≥1).
  const smallestTeamDetail = (() => {
    if (!teamSizes.length) return null;
    const bot = teamSizes[teamSizes.length - 1];
    const mgr = db.prepare(
      `SELECT id, employee_id, name, designation, department FROM trad_employees WHERE id = ?`
    ).get(bot.manager_id);
    const members = db.prepare(`
      SELECT id, employee_id, name, designation, department FROM trad_employees
      WHERE (${ACTIVE_STATUS_SQL}) AND manager_id = ?
      ORDER BY name
    `).all(bot.manager_id);
    return { manager: mgr, members, teamSize: bot.team_size };
  })();

  const orphanEmployees = db.prepare(`
    SELECT id, employee_id, name, designation, department FROM trad_employees te
    WHERE (${ACTIVE_STATUS_SQL})
      AND te.manager_id IS NULL
      AND te.id NOT IN (
        SELECT DISTINCT manager_id FROM trad_employees
        WHERE manager_id IS NOT NULL
          AND (${ACTIVE_STATUS_SQL})
      )
    ORDER BY name LIMIT 200
  `).all();

  // Hierarchy by level — BFS from roots
  const hierarchyByLevel = [];
  if (roots.length > 0) {
    let queue = roots.map(id => ({ id, level: 1 }));
    const vis = new Set();
    while (queue.length) {
      const next = [];
      const lg   = {};
      queue.forEach(({ id, level }) => {
        if (vis.has(id)) return;
        vis.add(id);
        if (!lg[level]) lg[level] = 0;
        lg[level]++;
        (childMap[id] || []).forEach(c => { if (!vis.has(c)) next.push({ id: c, level: level + 1 }); });
      });
      Object.entries(lg).forEach(([l, c]) => hierarchyByLevel.push({ level: `Level ${l}`, count: c }));
      queue = next;
    }
  }

  res.json({
    // ── Existing fields (unchanged — backward compat) ────────────────────────
    totalEmployees, totalDepartments, totalBusinessUnits, totalLocations, totalRelationships,
    maleEmployees, femaleEmployees, otherGenderEmployees, activeEmployees, exitedEmployees,
    avgServiceDuration, avgServiceInBB, newJoinersThisYear, employeesLeftThisYear,
    employeesByDepartment, employeesByLocation, recentEmployees,
    growthByYear, growthByMonth,
    genderByDepartment: genderByDeptRows,
    educationDistribution: eduRows,
    experienceDistribution,
    locationDistribution: locationRows,
    managersCount, icCount,
    avgTeamSize: Number(avgTeamSize),
    largestTeam:  largestTeamDetail?.teamSize  || 0,
    smallestTeam: smallestTeamDetail?.teamSize || 0,
    spanDistribution,
    orphanCount, noDirectReports, crossDeptCount,
    totalHierarchyLevels, maxReportingDepth: maxDepth,
    reportingCompleteness: Number(reportingCompleteness),
    largestTeamDetail, smallestTeamDetail, orphanEmployees, hierarchyByLevel,

    // ── NEW: Active-employee-only analytics ─────────────────────────────────
    // All charts in the MIDDLE section use active employees only.
    activeMale: db.prepare(`SELECT COUNT(*) as count FROM trad_employees WHERE (${ACTIVE_STATUS_SQL}) AND gender IN ('M','Male','male','m')`).get().count,
    activeFemale: db.prepare(`SELECT COUNT(*) as count FROM trad_employees WHERE (${ACTIVE_STATUS_SQL}) AND gender IN ('F','Female','female','f')`).get().count,

    activeAvgServiceDuration: (() => {
      const rows = db.prepare(`SELECT service_duration FROM trad_employees WHERE ${ACTIVE_STATUS_SQL} AND service_duration IS NOT NULL AND service_duration != ''`).all();
      if (!rows.length) return 0;
      return (rows.reduce((s, e) => s + (parseLeadingNumber(e.service_duration) || 0), 0) / rows.length).toFixed(1);
    })(),

    activeDeptDistribution: db.prepare(`
      SELECT department, COUNT(*) as count FROM trad_employees
      WHERE ${ACTIVE_STATUS_SQL}
        AND department IS NOT NULL AND department != ''
      GROUP BY department HAVING COUNT(*) > 0 ORDER BY count DESC
    `).all(),

    activeGenderByDept: db.prepare(`
      SELECT department,
        SUM(CASE WHEN gender IN ('M','Male','male','m') THEN 1 ELSE 0 END) as male,
        SUM(CASE WHEN gender IN ('F','Female','female','f') THEN 1 ELSE 0 END) as female
      FROM trad_employees
      WHERE ${ACTIVE_STATUS_SQL}
        AND department IS NOT NULL AND department != ''
      GROUP BY department HAVING COUNT(*) > 0 ORDER BY (male+female) DESC LIMIT 12
    `).all(),

    activeEducation: db.prepare(`
      SELECT COALESCE(NULLIF(education,''),'Unknown') as education, COUNT(*) as count
      FROM trad_employees WHERE ${ACTIVE_STATUS_SQL}
      GROUP BY education ORDER BY count DESC
    `).all(),

    activeExperience: (() => {
      const rows = db.prepare(`SELECT service_duration FROM trad_employees WHERE ${ACTIVE_STATUS_SQL}`).all();
      const b = { '0–2 Yrs':0, '2–5 Yrs':0, '5–10 Yrs':0, '10+ Yrs':0 };
      rows.forEach(({ service_duration }) => {
        const n = parseLeadingNumber(service_duration);
        if (n === null) return;
        if (n < 2) b['0–2 Yrs']++; else if (n < 5) b['2–5 Yrs']++; else if (n < 10) b['5–10 Yrs']++; else b['10+ Yrs']++;
      });
      return Object.entries(b).map(([range,count]) => ({ range, count })).filter(d => d.count > 0);
    })(),

    activeLocation: db.prepare(`
      SELECT place as location, COUNT(*) as count FROM trad_employees
      WHERE ${ACTIVE_STATUS_SQL}
        AND place IS NOT NULL AND place != ''
      GROUP BY place HAVING COUNT(*) > 0 ORDER BY count DESC
    `).all(),

    // Active Monthly Joiners (last 24 months) — only active employees
    activeGrowthByMonth: (() => {
      const rows = db.prepare(`SELECT join_date FROM trad_employees WHERE ${ACTIVE_STATUS_SQL} AND join_date IS NOT NULL AND join_date != ''`).all();
      const bm = {};
      rows.forEach(({ join_date }) => { const m = extractMonth(join_date); if (m) bm[m] = (bm[m] || 0) + 1; });
      return Object.entries(bm).sort(([a],[b]) => a.localeCompare(b)).slice(-24).map(([month,count]) => ({ month, count }));
    })(),

    // Active Employee Trend by Year — CUMULATIVE (total active workforce at end of each year)
    activeGrowthByYear: (() => {
      const rows = db.prepare(`SELECT join_date FROM trad_employees WHERE (status IN ('Live','Active','active') OR status IS NULL) AND join_date IS NOT NULL AND join_date != ''`).all();
      const by = {};
      rows.forEach(({ join_date }) => { const y = extractYear(join_date); if (y) by[y] = (by[y] || 0) + 1; });
      // Build cumulative: each year = sum of all joiners up to and including that year
      const sorted = Object.entries(by).sort(([a],[b]) => a.localeCompare(b));
      let cumulative = 0;
      return sorted.map(([year, count]) => {
        cumulative += count;
        return { year, count: cumulative, joinersThisYear: count };
      });
    })(),

    // Active manager analytics
    activeManagersCount: (() => {
      const ids = db.prepare(`SELECT DISTINCT manager_id FROM trad_employees WHERE manager_id IS NOT NULL AND ${ACTIVE_STATUS_SQL}`).all().map(r => r.manager_id);
      return new Set(ids).size;
    })(),

    // ── NEW: Historical / reference metrics (active + exited) ────────────────
    historicalTotal:   totalEmployees,
    historicalMale:    maleEmployees,
    historicalFemale:  femaleEmployees,
    historicalExited:  exitedEmployees,
    historicalAvgSD:   avgServiceDuration,
    historicalAvgSI:   avgServiceInBB,

    // ── NEW CHART 1: Active Employees by Department (%) ──────────────────────
    activeDeptPercentage: (() => {
      const depts = db.prepare(`
        SELECT department, COUNT(*) as count FROM trad_employees
        WHERE (${ACTIVE_STATUS_SQL}) AND department IS NOT NULL AND department != ''
        GROUP BY department HAVING COUNT(*) > 0 ORDER BY count DESC
      `).all();
      const total = depts.reduce((s, d) => s + d.count, 0);
      return depts.map(d => ({
        department: d.department,
        count: d.count,
        pct: total > 0 ? Math.round((d.count / total) * 1000) / 10 : 0,
      }));
    })(),

    // ── NEW CHART 2: Active Employees by Service Duration (finer buckets) ────
    activeServiceBuckets: (() => {
      const rows = db.prepare(`SELECT service_duration FROM trad_employees WHERE ${ACTIVE_STATUS_SQL}`).all();
      const b = { '0–1 Yr':0, '1–3 Yrs':0, '3–5 Yrs':0, '5–10 Yrs':0, '10+ Yrs':0 };
      rows.forEach(({ service_duration }) => {
        const n = parseLeadingNumber(service_duration);
        if (n === null) return;
        if (n < 1)  b['0–1 Yr']++;
        else if (n < 3)  b['1–3 Yrs']++;
        else if (n < 5)  b['3–5 Yrs']++;
        else if (n < 10) b['5–10 Yrs']++;
        else             b['10+ Yrs']++;
      });
      return Object.entries(b).map(([range, count]) => ({ range, count })).filter(d => d.count > 0);
    })(),
  });
});

// ── GET /api/dashboard/manager-sizes — returns team sizes per manager ─────────
// Used by the Span of Control drill-down to identify which managers belong
// to a given team-size bucket without loading all employee data twice.
router.get('/manager-sizes', authenticateToken, (_req, res) => {
  const rows = db.prepare(`
    SELECT manager_id, COUNT(*) as team_size
    FROM trad_employees
    WHERE (${ACTIVE_STATUS_SQL})
      AND manager_id IS NOT NULL
      AND manager_id IN (SELECT id FROM trad_employees WHERE (${ACTIVE_STATUS_SQL}))
    GROUP BY manager_id
  `).all();
  res.json(rows);
});

export default router;
