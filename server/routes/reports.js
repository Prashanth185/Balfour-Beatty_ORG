import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All reports read from trad_employees (Traditional Org Chart source of truth)
const ACTIVE_STATUS_SQL = "status IN ('Live','Active','active','live') OR status IS NULL";

router.get('/span-of-control', authenticateToken, (_req, res) => {
  // Managers ranked by direct report count — from trad_employees.manager_id
  const data = db.prepare(`
    SELECT
      m.id,
      m.name,
      m.designation,
      m.department,
      COUNT(e.id) as direct_reports
    FROM trad_employees m
    JOIN trad_employees e ON e.manager_id = m.id
    GROUP BY m.id
    HAVING direct_reports > 0
    ORDER BY direct_reports DESC
  `).all();
  res.json(data);
});

router.get('/department-distribution', authenticateToken, (_req, res) => {
  // Department counts from trad_employees — exclude empty departments
  const data = db.prepare(`
    SELECT department, COUNT(*) as count
    FROM trad_employees
    WHERE department IS NOT NULL AND TRIM(department) != ''
    GROUP BY department
    HAVING COUNT(*) > 0
    ORDER BY count DESC
  `).all();
  res.json(data);
});

router.get('/matrix-report', authenticateToken, (_req, res) => {
  // Employees with their manager — from trad_employees.manager_id
  const data = db.prepare(`
    SELECT
      e.employee_id,
      e.name        AS employee,
      e.designation,
      e.department,
      m.name        AS manager,
      m.designation AS manager_designation
    FROM trad_employees e
    JOIN trad_employees m ON m.id = e.manager_id
    WHERE e.manager_id IS NOT NULL
    ORDER BY e.department, e.name
  `).all();
  res.json(data);
});

router.get('/location-report', authenticateToken, (_req, res) => {
  // Location counts from trad_employees.place column
  const data = db.prepare(`
    SELECT
      place AS location,
      COUNT(*) AS count
    FROM trad_employees
    WHERE place IS NOT NULL AND TRIM(place) != ''
    GROUP BY place
    HAVING COUNT(*) > 0
    ORDER BY count DESC
  `).all();
  res.json(data);
});

router.get('/export', authenticateToken, (req, res) => {
  const { type = 'employees' } = req.query;

  let data;
  if (type === 'relationships') {
    // Matrix: employee → manager relationships from trad_employees
    data = db.prepare(`
      SELECT
        e.employee_id,
        e.name        AS employee,
        e.designation,
        e.department,
        m.name        AS manager,
        m.designation AS manager_designation
      FROM trad_employees e
      JOIN trad_employees m ON m.id = e.manager_id
      WHERE e.manager_id IS NOT NULL
      ORDER BY e.name
    `).all();
  } else {
    data = db.prepare(`
      SELECT
        employee_id, name, designation, department,
        gender, place, status, join_date, service_duration, education
      FROM trad_employees
      ORDER BY name
    `).all();
  }

  res.json(data);
});

export default router;
