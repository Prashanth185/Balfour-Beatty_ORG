/**
 * EVMS — Executive Visit Management System
 * Standalone SQLite tables, completely isolated from ORMS employee/relationship data.
 */
import db from './db.js';

db.exec(`
  -- ── Visit Master ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_name TEXT NOT NULL,
    visit_type TEXT,
    purpose TEXT,
    host_company TEXT,
    host_location TEXT,
    coordinator TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'Planning',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Visitors ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    visitor_name TEXT NOT NULL,
    short_name TEXT,
    designation TEXT,
    department TEXT,
    country TEXT,
    email TEXT,
    phone TEXT,
    arrival_date TEXT,
    departure_date TEXT,
    special_requirements TEXT,
    biography TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Hosts ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    host_name TEXT NOT NULL,
    short_name TEXT,
    designation TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    role_during_visit TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Travel ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_travel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    visitor_id INTEGER REFERENCES evms_visitors(id) ON DELETE CASCADE,
    arrival_flight TEXT,
    arrival_airport TEXT,
    arrival_date TEXT,
    arrival_time TEXT,
    departure_flight TEXT,
    departure_airport TEXT,
    departure_date TEXT,
    departure_time TEXT,
    pickup_required INTEGER DEFAULT 0,
    pickup_owner TEXT,
    transport_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Accommodation ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_accommodation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    hotel_name TEXT,
    checkin_date TEXT,
    checkout_date TEXT,
    room_count INTEGER DEFAULT 1,
    room_numbers TEXT,
    booking_status TEXT DEFAULT 'Pending',
    contact_person TEXT,
    contact_number TEXT,
    special_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Agenda ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    agenda_date TEXT,
    start_time TEXT,
    end_time TEXT,
    activity_name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    visitor_ids TEXT DEFAULT '[]',
    host_ids TEXT DEFAULT '[]',
    owner TEXT,
    status TEXT DEFAULT 'Planned',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Meetings ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    meeting_title TEXT NOT NULL,
    visitor_ids TEXT DEFAULT '[]',
    host_ids TEXT DEFAULT '[]',
    location TEXT,
    meeting_date TEXT,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Activities ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    activity_date TEXT,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    description TEXT,
    visitor_ids TEXT DEFAULT '[]',
    host_ids TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Tasks ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    owner TEXT,
    due_date TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Documents ─────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT,
    file_url TEXT,
    upload_date TEXT,
    uploaded_by TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ── Comments ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS evms_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES evms_visits(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    comment_user TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Safe migrations: add new host columns (backward-compatible) ───────────────
try { db.exec('ALTER TABLE evms_hosts ADD COLUMN company_name TEXT'); } catch {}
try { db.exec('ALTER TABLE evms_hosts ADD COLUMN is_company_head INTEGER DEFAULT 0'); } catch {}

export default db;
