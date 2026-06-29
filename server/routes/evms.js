/**
 * EVMS — Executive Visit Management System API Routes
 * Completely isolated from all ORMS employee/relationship endpoints.
 */
import { Router } from 'express';
import db from '../db.js';
import '../evms-db.js'; // ensure tables exist
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads/evms');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseIds(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
function enrichVisit(v) {
  const visitors = db.prepare('SELECT * FROM evms_visitors WHERE visit_id = ? ORDER BY visitor_name').all(v.id);
  const travel   = db.prepare('SELECT * FROM evms_travel WHERE visit_id = ?').all(v.id);

  // Attach travel record to each visitor for easy front-end access
  const visitorsWithTravel = visitors.map(vis => {
    const t = travel.find(tr => tr.visitor_id === vis.id) || {};
    return {
      ...vis,
      travel_arrival_airport:    t.arrival_airport   || null,
      travel_arrival_date:       t.arrival_date      || null,
      travel_arrival_time:       t.arrival_time      || null,
      travel_departure_airport:  t.departure_airport || null,
      travel_departure_date:     t.departure_date    || null,
      travel_departure_time:     t.departure_time    || null,
    };
  });

  return {
    ...v,
    visitors:      visitorsWithTravel,
    hosts:         db.prepare('SELECT * FROM evms_hosts WHERE visit_id = ? ORDER BY is_company_head DESC, host_name').all(v.id),
    travel,
    accommodation: db.prepare('SELECT * FROM evms_accommodation WHERE visit_id = ?').all(v.id),
    agenda:        db.prepare('SELECT * FROM evms_agenda WHERE visit_id = ? ORDER BY agenda_date, start_time, sort_order').all(v.id),
    meetings:      db.prepare('SELECT * FROM evms_meetings WHERE visit_id = ? ORDER BY meeting_date, start_time').all(v.id),
    activities:    db.prepare('SELECT * FROM evms_activities WHERE visit_id = ? ORDER BY activity_date, start_time').all(v.id),
    tasks:         db.prepare('SELECT * FROM evms_tasks WHERE visit_id = ? ORDER BY due_date').all(v.id),
    documents:     db.prepare('SELECT * FROM evms_documents WHERE visit_id = ? ORDER BY created_at DESC').all(v.id),
    comments:      db.prepare('SELECT * FROM evms_comments WHERE visit_id = ? ORDER BY created_at DESC').all(v.id),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', authenticateToken, (_req, res) => {
  // Use local date (not UTC) to avoid timezone offset causing wrong "today"
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const totalVisits     = db.prepare('SELECT COUNT(*) as c FROM evms_visits').get().c;
  const totalVisitors   = db.prepare('SELECT COUNT(*) as c FROM evms_visitors').get().c;
  const totalHosts      = db.prepare('SELECT COUNT(*) as c FROM evms_hosts').get().c;
  const totalMeetings   = db.prepare('SELECT COUNT(*) as c FROM evms_meetings').get().c;
  const totalActivities = db.prepare('SELECT COUNT(*) as c FROM evms_activities').get().c;
  const upcomingMeetings = db.prepare('SELECT COUNT(*) as c FROM evms_meetings WHERE meeting_date > ?').get(today).c;
  const completedMeetings= db.prepare("SELECT COUNT(*) as c FROM evms_meetings WHERE meeting_date < ?").get(today).c;
  const upcomingActivities = db.prepare('SELECT COUNT(*) as c FROM evms_activities WHERE activity_date > ?').get(today).c;

  // Recent 5 visits
  const recentVisits = db.prepare(
    'SELECT id, visit_name, start_date, end_date, status FROM evms_visits ORDER BY created_at DESC LIMIT 5'
  ).all();

  // Today's meetings
  const todayMeetings = db.prepare(
    `SELECT m.*, v.visit_name FROM evms_meetings m
     JOIN evms_visits v ON v.id = m.visit_id
     WHERE m.meeting_date = ? ORDER BY m.start_time`
  ).all(today);

  // Today's activities
  const todayActivities = db.prepare(
    `SELECT a.*, v.visit_name FROM evms_activities a
     JOIN evms_visits v ON v.id = a.visit_id
     WHERE a.activity_date = ? ORDER BY a.start_time`
  ).all(today);

  // Recent meetings (last 5)
  const recentMeetings = db.prepare(
    `SELECT m.*, v.visit_name FROM evms_meetings m
     JOIN evms_visits v ON v.id = m.visit_id
     ORDER BY m.meeting_date DESC, m.start_time DESC LIMIT 5`
  ).all();

  // Recent activities (last 5)
  const recentActivities = db.prepare(
    `SELECT a.*, v.visit_name FROM evms_activities a
     JOIN evms_visits v ON v.id = a.visit_id
     ORDER BY a.activity_date DESC, a.start_time DESC LIMIT 5`
  ).all();

  // Recent docs
  const recentDocs = db.prepare(
    'SELECT d.*, v.visit_name FROM evms_documents d JOIN evms_visits v ON v.id = d.visit_id ORDER BY d.created_at DESC LIMIT 5'
  ).all();

  res.json({
    totalVisits, totalVisitors, totalHosts, totalMeetings, totalActivities,
    upcomingMeetings, completedMeetings, upcomingActivities,
    recentVisits, todayMeetings, todayActivities, recentMeetings, recentActivities, recentDocs,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VISITS CRUD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits', authenticateToken, (req, res) => {
  const { search, status } = req.query;
  let q = 'SELECT * FROM evms_visits WHERE 1=1';
  const p = [];
  if (search) { q += ' AND (visit_name LIKE ? OR host_company LIKE ? OR coordinator LIKE ?)'; const t = `%${search}%`; p.push(t, t, t); }
  if (status && status !== 'All') { q += ' AND status = ?'; p.push(status); }
  q += ' ORDER BY start_date DESC';
  res.json(db.prepare(q).all(...p));
});

router.get('/visits/:id', authenticateToken, (req, res) => {
  const v = db.prepare('SELECT * FROM evms_visits WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Visit not found' });
  res.json(enrichVisit(v));
});

router.post('/visits', authenticateToken, (req, res) => {
  try {
    const { visit_name, visit_type, purpose, host_company, host_location, coordinator, start_date, end_date, status = 'Planning', description } = req.body;
    if (!visit_name?.trim()) return res.status(400).json({ error: 'Missing required field: Visit Name' });
    const r = db.prepare(
      `INSERT INTO evms_visits (visit_name,visit_type,purpose,host_company,host_location,coordinator,start_date,end_date,status,description) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(visit_name.trim(), visit_type || null, purpose || null, host_company || null, host_location || null, coordinator || null, start_date || null, end_date || null, status, description || null);
    const newVisit = db.prepare('SELECT * FROM evms_visits WHERE id = ?').get(r.lastInsertRowid);
    if (!newVisit) return res.status(500).json({ error: 'Visit created but could not be retrieved' });
    res.status(201).json(enrichVisit(newVisit));
  } catch (err) {
    console.error('EVMS create visit error:', err);
    res.status(500).json({ error: err.message || 'Failed to create visit' });
  }
});

router.put('/visits/:id', authenticateToken, (req, res) => {
  try {
    const { visit_name, visit_type, purpose, host_company, host_location, coordinator, start_date, end_date, status, description } = req.body;
    db.prepare(`UPDATE evms_visits SET visit_name=?,visit_type=?,purpose=?,host_company=?,host_location=?,coordinator=?,start_date=?,end_date=?,status=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(visit_name, visit_type, purpose, host_company, host_location, coordinator, start_date, end_date, status, description, req.params.id);
    const v = db.prepare('SELECT * FROM evms_visits WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Visit not found' });
    res.json(enrichVisit(v));
  } catch (err) {
    console.error('EVMS update visit error:', err);
    res.status(500).json({ error: err.message || 'Failed to update visit' });
  }
});

router.patch('/visits/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['Planning','Approved','In Progress','Completed','Cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE evms_visits SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
    const v = db.prepare('SELECT * FROM evms_visits WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Visit not found' });
    res.json(enrichVisit(v));
  } catch (err) {
    console.error('EVMS patch status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update status' });
  }
});

router.delete('/visits/:id', authenticateToken, (req, res) => {
  try {
    const r = db.prepare('DELETE FROM evms_visits WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Visit not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('EVMS delete visit error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete visit' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// VISITORS
// ══════════════════════════════════════════════════════════════════════════════
router.post('/visits/:id/visitors', authenticateToken, (req, res) => {
  try {
    const visitId = parseInt(req.params.id, 10);
    if (isNaN(visitId)) return res.status(400).json({ error: 'Invalid visit ID' });

    // Verify the visit exists before inserting
    const visitExists = db.prepare('SELECT id FROM evms_visits WHERE id = ?').get(visitId);
    if (!visitExists) return res.status(404).json({ error: 'Visit not found' });

    const {
      visitor_name, short_name, designation, department,
      country, email, phone,
      arrival_date, departure_date,
      special_requirements, biography
    } = req.body;

    if (!visitor_name || !visitor_name.toString().trim()) {
      return res.status(400).json({ error: 'Visitor Name is required' });
    }

    // Coerce every optional field to null to prevent SQLite type errors
    const safe = (v) => (v !== undefined && v !== null && v !== '') ? String(v).trim() : null;

    const r = db.prepare(
      `INSERT INTO evms_visitors
         (visit_id, visitor_name, short_name, designation, department, country,
          email, phone, arrival_date, departure_date, special_requirements, biography)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      visitId,
      visitor_name.toString().trim(),
      safe(short_name),
      safe(designation),
      safe(department),
      safe(country),
      safe(email),
      safe(phone),
      safe(arrival_date),
      safe(departure_date),
      safe(special_requirements),
      safe(biography),
    );

    const created = db.prepare('SELECT * FROM evms_visitors WHERE id = ?').get(r.lastInsertRowid);
    if (!created) return res.status(500).json({ error: 'Visitor saved but could not be retrieved' });
    res.status(201).json(created);
  } catch (err) {
    console.error('EVMS create visitor error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Failed to create visitor' });
  }
});

router.put('/visitors/:id', authenticateToken, (req, res) => {
  const { visitor_name, short_name, designation, department, country, email, phone, arrival_date, departure_date, special_requirements, biography } = req.body;
  db.prepare(`UPDATE evms_visitors SET visitor_name=?,short_name=?,designation=?,department=?,country=?,email=?,phone=?,arrival_date=?,departure_date=?,special_requirements=?,biography=? WHERE id=?`
  ).run(visitor_name, short_name, designation, department, country, email, phone, arrival_date, departure_date, special_requirements, biography, req.params.id);
  res.json(db.prepare('SELECT * FROM evms_visitors WHERE id = ?').get(req.params.id));
});

router.delete('/visitors/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_visitors WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOSTS
// ══════════════════════════════════════════════════════════════════════════════
router.post('/visits/:id/hosts', authenticateToken, (req, res) => {
  try {
    const { host_name, short_name, designation, department, email, phone,
            role_during_visit, company_name, is_company_head } = req.body;
    if (!host_name?.trim()) return res.status(400).json({ error: 'Missing required field: Host Name' });
    const safe = (v) => (v !== undefined && v !== null && v !== '') ? String(v).trim() : null;
    const r = db.prepare(
      `INSERT INTO evms_hosts
         (visit_id, host_name, short_name, designation, department, email, phone,
          role_during_visit, company_name, is_company_head)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.params.id, host_name.trim(), safe(short_name), safe(designation),
      safe(department), safe(email), safe(phone), safe(role_during_visit),
      safe(company_name), is_company_head ? 1 : 0
    );
    res.status(201).json(db.prepare('SELECT * FROM evms_hosts WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    console.error('EVMS create host error:', err);
    res.status(500).json({ error: err.message || 'Failed to create host' });
  }
});

router.put('/hosts/:id', authenticateToken, (req, res) => {
  try {
    const { host_name, short_name, designation, department, email, phone,
            role_during_visit, company_name, is_company_head } = req.body;
    const safe = (v) => (v !== undefined && v !== null && v !== '') ? String(v).trim() : null;
    db.prepare(
      `UPDATE evms_hosts SET host_name=?, short_name=?, designation=?, department=?,
       email=?, phone=?, role_during_visit=?, company_name=?, is_company_head=? WHERE id=?`
    ).run(
      host_name, safe(short_name), safe(designation), safe(department),
      safe(email), safe(phone), safe(role_during_visit),
      safe(company_name), is_company_head ? 1 : 0, req.params.id
    );
    res.json(db.prepare('SELECT * FROM evms_hosts WHERE id = ?').get(req.params.id));
  } catch (err) {
    console.error('EVMS update host error:', err);
    res.status(500).json({ error: err.message || 'Failed to update host' });
  }
});

router.delete('/hosts/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_hosts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRAVEL
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/travel', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_travel WHERE visit_id = ? ORDER BY arrival_date').all(req.params.id));
});
router.post('/visits/:id/travel', authenticateToken, (req, res) => {
  try {
    const visitId = parseInt(req.params.id, 10);
    if (isNaN(visitId)) return res.status(400).json({ error: 'Invalid visit ID' });

    const safe = (v) => (v !== undefined && v !== null && v !== '') ? String(v).trim() : null;
    const {
      visitor_id, arrival_flight, arrival_airport, arrival_date, arrival_time,
      departure_flight, departure_airport, departure_date, departure_time,
      pickup_required, pickup_owner, transport_notes
    } = req.body;

    const r = db.prepare(
      `INSERT INTO evms_travel
         (visit_id, visitor_id, arrival_flight, arrival_airport, arrival_date, arrival_time,
          departure_flight, departure_airport, departure_date, departure_time,
          pickup_required, pickup_owner, transport_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      visitId,
      visitor_id ? parseInt(visitor_id, 10) : null,
      safe(arrival_flight),   safe(arrival_airport),
      safe(arrival_date),     safe(arrival_time),
      safe(departure_flight), safe(departure_airport),
      safe(departure_date),   safe(departure_time),
      pickup_required ? 1 : 0,
      safe(pickup_owner),     safe(transport_notes),
    );
    res.status(201).json(db.prepare('SELECT * FROM evms_travel WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    console.error('EVMS create travel error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Failed to create travel record' });
  }
});
router.put('/travel/:id', authenticateToken, (req, res) => {
  const f = req.body;
  db.prepare(`UPDATE evms_travel SET visitor_id=?,arrival_flight=?,arrival_airport=?,arrival_date=?,arrival_time=?,departure_flight=?,departure_airport=?,departure_date=?,departure_time=?,pickup_required=?,pickup_owner=?,transport_notes=? WHERE id=?`
  ).run(f.visitor_id || null, f.arrival_flight, f.arrival_airport, f.arrival_date, f.arrival_time, f.departure_flight, f.departure_airport, f.departure_date, f.departure_time, f.pickup_required ? 1 : 0, f.pickup_owner, f.transport_notes, req.params.id);
  res.json(db.prepare('SELECT * FROM evms_travel WHERE id = ?').get(req.params.id));
});
router.delete('/travel/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_travel WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// ACCOMMODATION
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/accommodation', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_accommodation WHERE visit_id = ?').all(req.params.id));
});
router.post('/visits/:id/accommodation', authenticateToken, (req, res) => {
  const { hotel_name, checkin_date, checkout_date, room_count, room_numbers, booking_status, contact_person, contact_number, special_notes } = req.body;
  const r = db.prepare(`INSERT INTO evms_accommodation (visit_id,hotel_name,checkin_date,checkout_date,room_count,room_numbers,booking_status,contact_person,contact_number,special_notes) VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(req.params.id, hotel_name, checkin_date, checkout_date, room_count || 1, room_numbers, booking_status || 'Pending', contact_person, contact_number, special_notes);
  res.status(201).json(db.prepare('SELECT * FROM evms_accommodation WHERE id = ?').get(r.lastInsertRowid));
});
router.put('/accommodation/:id', authenticateToken, (req, res) => {
  const f = req.body;
  db.prepare(`UPDATE evms_accommodation SET hotel_name=?,checkin_date=?,checkout_date=?,room_count=?,room_numbers=?,booking_status=?,contact_person=?,contact_number=?,special_notes=? WHERE id=?`
  ).run(f.hotel_name, f.checkin_date, f.checkout_date, f.room_count, f.room_numbers, f.booking_status, f.contact_person, f.contact_number, f.special_notes, req.params.id);
  res.json(db.prepare('SELECT * FROM evms_accommodation WHERE id = ?').get(req.params.id));
});
router.delete('/accommodation/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_accommodation WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// AGENDA
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/agenda', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_agenda WHERE visit_id = ? ORDER BY agenda_date, start_time, sort_order').all(req.params.id));
});
router.post('/visits/:id/agenda', authenticateToken, (req, res) => {
  const { agenda_date, start_time, end_time, activity_name, description, location, visitor_ids, host_ids, owner, status, sort_order } = req.body;
  if (!activity_name?.trim()) return res.status(400).json({ error: 'Activity name required' });
  const r = db.prepare(`INSERT INTO evms_agenda (visit_id,agenda_date,start_time,end_time,activity_name,description,location,visitor_ids,host_ids,owner,status,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.params.id, agenda_date, start_time, end_time, activity_name.trim(), description, location,
    JSON.stringify(visitor_ids || []), JSON.stringify(host_ids || []), owner, status || 'Planned', sort_order || 0);
  res.status(201).json(db.prepare('SELECT * FROM evms_agenda WHERE id = ?').get(r.lastInsertRowid));
});
router.put('/agenda/:id', authenticateToken, (req, res) => {
  const { agenda_date, start_time, end_time, activity_name, description, location, visitor_ids, host_ids, owner, status, sort_order } = req.body;
  db.prepare(`UPDATE evms_agenda SET agenda_date=?,start_time=?,end_time=?,activity_name=?,description=?,location=?,visitor_ids=?,host_ids=?,owner=?,status=?,sort_order=? WHERE id=?`
  ).run(agenda_date, start_time, end_time, activity_name, description, location,
    JSON.stringify(visitor_ids || []), JSON.stringify(host_ids || []), owner, status, sort_order || 0, req.params.id);
  res.json(db.prepare('SELECT * FROM evms_agenda WHERE id = ?').get(req.params.id));
});
router.delete('/agenda/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_agenda WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEETINGS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/meetings', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_meetings WHERE visit_id = ? ORDER BY meeting_date, start_time').all(req.params.id));
});

router.post('/visits/:id/meetings', authenticateToken, (req, res) => {
  try {
    const { meeting_title, visitor_ids, host_ids, location, meeting_date, start_time, end_time, duration_minutes, notes } = req.body;
    if (!meeting_title?.trim()) return res.status(400).json({ error: 'Missing required field: Meeting Title' });

    // Safely serialise IDs — handle array, string-JSON, or undefined
    const safeIds = (val) => {
      if (!val) return '[]';
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') { try { JSON.parse(val); return val; } catch { return '[]'; } }
      return '[]';
    };

    const r = db.prepare(
      `INSERT INTO evms_meetings
         (visit_id, meeting_title, visitor_ids, host_ids, location, meeting_date, start_time, end_time, duration_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.params.id,
      meeting_title.trim(),
      safeIds(visitor_ids),
      safeIds(host_ids),
      location        || null,
      meeting_date    || null,
      start_time      || null,
      end_time        || null,
      duration_minutes ? Number(duration_minutes) : null,
      notes           || null,
    );

    const created = db.prepare('SELECT * FROM evms_meetings WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error('EVMS create meeting error:', err);
    res.status(500).json({ error: err.message || 'Failed to create meeting' });
  }
});

router.put('/meetings/:id', authenticateToken, (req, res) => {
  try {
    const { meeting_title, visitor_ids, host_ids, location, meeting_date, start_time, end_time, duration_minutes, notes } = req.body;
    const safeIds = (val) => {
      if (!val) return '[]';
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') { try { JSON.parse(val); return val; } catch { return '[]'; } }
      return '[]';
    };
    db.prepare(
      `UPDATE evms_meetings
       SET meeting_title=?, visitor_ids=?, host_ids=?, location=?, meeting_date=?, start_time=?, end_time=?, duration_minutes=?, notes=?
       WHERE id=?`
    ).run(
      meeting_title, safeIds(visitor_ids), safeIds(host_ids),
      location, meeting_date, start_time, end_time,
      duration_minutes ? Number(duration_minutes) : null,
      notes, req.params.id,
    );
    res.json(db.prepare('SELECT * FROM evms_meetings WHERE id = ?').get(req.params.id));
  } catch (err) {
    console.error('EVMS update meeting error:', err);
    res.status(500).json({ error: err.message || 'Failed to update meeting' });
  }
});

router.delete('/meetings/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_meetings WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/tasks', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_tasks WHERE visit_id = ? ORDER BY due_date, priority').all(req.params.id));
});
router.post('/visits/:id/tasks', authenticateToken, (req, res) => {
  const { task_name, owner, due_date, priority, status, comments } = req.body;
  if (!task_name?.trim()) return res.status(400).json({ error: 'Task name required' });
  const r = db.prepare(`INSERT INTO evms_tasks (visit_id,task_name,owner,due_date,priority,status,comments) VALUES (?,?,?,?,?,?,?)`
  ).run(req.params.id, task_name.trim(), owner, due_date, priority || 'Medium', status || 'Pending', comments);
  res.status(201).json(db.prepare('SELECT * FROM evms_tasks WHERE id = ?').get(r.lastInsertRowid));
});
router.put('/tasks/:id', authenticateToken, (req, res) => {
  const { task_name, owner, due_date, priority, status, comments } = req.body;
  db.prepare(`UPDATE evms_tasks SET task_name=?,owner=?,due_date=?,priority=?,status=?,comments=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(task_name, owner, due_date, priority, status, comments, req.params.id);
  res.json(db.prepare('SELECT * FROM evms_tasks WHERE id = ?').get(req.params.id));
});
router.delete('/tasks/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/documents', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_documents WHERE visit_id = ? ORDER BY created_at DESC').all(req.params.id));
});
router.post('/visits/:id/documents', authenticateToken, upload.single('file'), (req, res) => {
  try {
    const { document_name, document_type, uploaded_by, category } = req.body;
    const file_url = req.file ? `/uploads/evms/${req.file.filename}` : null;
    if (!req.file && !document_name) return res.status(400).json({ error: 'File or document name required' });
    const r = db.prepare(
      `INSERT INTO evms_documents (visit_id,document_name,document_type,file_url,upload_date,uploaded_by,category) VALUES (?,?,?,?,?,?,?)`
    ).run(
      req.params.id,
      document_name || req.file?.originalname || 'Document',
      document_type || 'Other',
      file_url,
      new Date().toISOString().slice(0,10),
      uploaded_by || 'User',
      category || 'General'
    );
    res.status(201).json(db.prepare('SELECT * FROM evms_documents WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    console.error('EVMS document upload error:', err);
    res.status(500).json({ error: err.message || 'Document upload failed' });
  }
});
router.delete('/documents/:id', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM evms_documents WHERE id = ?').get(req.params.id);
  if (doc?.file_url) {
    const fp = path.join(__dirname, '..', doc.file_url);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
  }
  db.prepare('DELETE FROM evms_documents WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/comments', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_comments WHERE visit_id = ? ORDER BY created_at DESC').all(req.params.id));
});
router.post('/visits/:id/comments', authenticateToken, (req, res) => {
  const { comment_text, comment_user } = req.body;
  if (!comment_text?.trim()) return res.status(400).json({ error: 'Comment required' });
  const r = db.prepare('INSERT INTO evms_comments (visit_id,comment_text,comment_user) VALUES (?,?,?)')
    .run(req.params.id, comment_text.trim(), comment_user || 'User');
  res.status(201).json(db.prepare('SELECT * FROM evms_comments WHERE id = ?').get(r.lastInsertRowid));
});
router.delete('/comments/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_comments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITIES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/visits/:id/activities', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM evms_activities WHERE visit_id = ? ORDER BY activity_date, start_time').all(req.params.id));
});

router.post('/visits/:id/activities', authenticateToken, (req, res) => {
  try {
    const { activity_type, activity_date, start_time, end_time, location, description, visitor_ids, host_ids } = req.body;
    if (!activity_type?.trim()) return res.status(400).json({ error: 'Activity Type is required' });

    const safeIds = (val) => {
      if (!val) return '[]';
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') { try { JSON.parse(val); return val; } catch { return '[]'; } }
      return '[]';
    };

    const r = db.prepare(
      `INSERT INTO evms_activities
         (visit_id, activity_type, activity_date, start_time, end_time, location, description, visitor_ids, host_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.params.id,
      activity_type.trim(),
      activity_date || null,
      start_time || null,
      end_time || null,
      location || null,
      description || null,
      safeIds(visitor_ids),
      safeIds(host_ids)
    );

    const created = db.prepare('SELECT * FROM evms_activities WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error('EVMS create activity error:', err);
    res.status(500).json({ error: err.message || 'Failed to create activity' });
  }
});

router.put('/activities/:id', authenticateToken, (req, res) => {
  try {
    const { activity_type, activity_date, start_time, end_time, location, description, visitor_ids, host_ids } = req.body;
    const safeIds = (val) => {
      if (!val) return '[]';
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') { try { JSON.parse(val); return val; } catch { return '[]'; } }
      return '[]';
    };
    db.prepare(
      `UPDATE evms_activities
       SET activity_type=?, activity_date=?, start_time=?, end_time=?, location=?, description=?, visitor_ids=?, host_ids=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).run(
      activity_type, activity_date, start_time, end_time, location, description,
      safeIds(visitor_ids), safeIds(host_ids), req.params.id
    );
    res.json(db.prepare('SELECT * FROM evms_activities WHERE id = ?').get(req.params.id));
  } catch (err) {
    console.error('EVMS update activity error:', err);
    res.status(500).json({ error: err.message || 'Failed to update activity' });
  }
});

router.delete('/activities/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM evms_activities WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR — visits with date range for calendar view
// ══════════════════════════════════════════════════════════════════════════════
router.get('/calendar', authenticateToken, (req, res) => {
  const { year, month } = req.query;
  let q = 'SELECT id, visit_name, start_date, end_date, status, host_location FROM evms_visits WHERE 1=1';
  const p = [];
  if (year && month) {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to   = `${year}-${String(month).padStart(2,'0')}-31`;
    q += ' AND start_date <= ? AND end_date >= ?';
    p.push(to, from);
  }
  q += ' ORDER BY start_date';
  res.json(db.prepare(q).all(...p));
});

export default router;
