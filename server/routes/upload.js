import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const photosDir = path.join(__dirname, '../uploads/photos');

if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `emp-${req.params.id}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and WebP images are allowed'));
  },
});

const router = Router();

function removeStoredPhoto(photoUrl) {
  if (!photoUrl) return;
  const oldPath = path.join(__dirname, '..', photoUrl.replace(/^\//, ''));
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
}

router.post('/employees/:id/photo', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    const empId = req.params.id;
    const existing = db.prepare('SELECT id, photo_url, employee_id FROM employees WHERE id = ?').get(empId);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    if (!req.file) return res.status(400).json({ error: 'No photo file uploaded' });

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    removeStoredPhoto(existing.photo_url);

    db.prepare(`
      UPDATE employees SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(photoUrl, empId);

    // ── Sync to trad_employees table (same employee_id text key) ────────────
    // This ensures Traditional Org Chart nodes show the same photo as the
    // Employee Profile page.
    if (existing.employee_id) {
      const tradEmp = db.prepare('SELECT id, photo_url FROM trad_employees WHERE employee_id = ?').get(existing.employee_id);
      if (tradEmp) {
        removeStoredPhoto(tradEmp.photo_url);
        db.prepare('UPDATE trad_employees SET photo_url = ? WHERE employee_id = ?')
          .run(photoUrl, existing.employee_id);
      }
    }

    res.json({ message: 'Photo uploaded', photo_url: photoUrl });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.delete('/employees/:id/photo', authenticateToken, (req, res) => {
  try {
    const empId = req.params.id;
    const existing = db.prepare('SELECT id, photo_url, employee_id FROM employees WHERE id = ?').get(empId);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    removeStoredPhoto(existing.photo_url);
    db.prepare(`UPDATE employees SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(empId);

    // ── Sync removal to trad_employees table ────────────────────────────────
    if (existing.employee_id) {
      db.prepare('UPDATE trad_employees SET photo_url = NULL WHERE employee_id = ?')
        .run(existing.employee_id);
    }

    res.json({ message: 'Photo removed', photo_url: null });
  } catch (err) {
    console.error('Photo remove error:', err);
    res.status(500).json({ error: err.message || 'Remove failed' });
  }
});

router.post('/trad-employees/:id/photo', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    const empId = req.params.id;
    const existing = db.prepare('SELECT id, photo_url, employee_id FROM trad_employees WHERE id = ?').get(empId);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    if (!req.file) return res.status(400).json({ error: 'No photo file uploaded' });
    const photoUrl = `/uploads/photos/${req.file.filename}`;
    removeStoredPhoto(existing.photo_url);
    db.prepare(`UPDATE trad_employees SET photo_url = ? WHERE id = ?`).run(photoUrl, empId);

    // ── Sync to master employees table (same employee_id text key) ──────────
    // This ensures Employee Profile, Master Data, and Dashboard all show the
    // same photo as the Traditional Org Chart node.
    if (existing.employee_id) {
      const masterEmp = db.prepare('SELECT id, photo_url FROM employees WHERE employee_id = ?').get(existing.employee_id);
      if (masterEmp) {
        removeStoredPhoto(masterEmp.photo_url);
        db.prepare('UPDATE employees SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?')
          .run(photoUrl, existing.employee_id);
      }
    }

    res.json({ message: 'Photo uploaded', photo_url: photoUrl });
  } catch (err) {
    console.error('Traditional photo upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.delete('/trad-employees/:id/photo', authenticateToken, (req, res) => {
  try {
    const empId = req.params.id;
    const existing = db.prepare('SELECT id, photo_url, employee_id FROM trad_employees WHERE id = ?').get(empId);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    removeStoredPhoto(existing.photo_url);
    db.prepare(`UPDATE trad_employees SET photo_url = NULL WHERE id = ?`).run(empId);

    // ── Sync removal to master employees table ──────────────────────────────
    if (existing.employee_id) {
      db.prepare('UPDATE employees SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?')
        .run(existing.employee_id);
    }

    res.json({ message: 'Photo removed', photo_url: null });
  } catch (err) {
    console.error('Traditional photo remove error:', err);
    res.status(500).json({ error: err.message || 'Remove failed' });
  }
});

router.post('/projects/:pid/trad-employees/:id/photo', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    const { pid, id } = req.params;
    const existing = db.prepare('SELECT id, photo_url, employee_id FROM proj_trad_employees WHERE project_id = ? AND id = ?').get(pid, id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    if (!req.file) return res.status(400).json({ error: 'No photo file uploaded' });
    const photoUrl = `/uploads/photos/${req.file.filename}`;
    removeStoredPhoto(existing.photo_url);
    db.prepare(`UPDATE proj_trad_employees SET photo_url = ? WHERE project_id = ? AND id = ?`).run(photoUrl, pid, id);

    // ── Sync to master employees and trad_employees tables ──────────────────
    if (existing.employee_id) {
      const masterEmp = db.prepare('SELECT id, photo_url FROM employees WHERE employee_id = ?').get(existing.employee_id);
      if (masterEmp) {
        removeStoredPhoto(masterEmp.photo_url);
        db.prepare('UPDATE employees SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?')
          .run(photoUrl, existing.employee_id);
      }
      const tradEmp = db.prepare('SELECT id, photo_url FROM trad_employees WHERE employee_id = ?').get(existing.employee_id);
      if (tradEmp) {
        removeStoredPhoto(tradEmp.photo_url);
        db.prepare('UPDATE trad_employees SET photo_url = ? WHERE employee_id = ?')
          .run(photoUrl, existing.employee_id);
      }
    }

    res.json({ message: 'Photo uploaded', photo_url: photoUrl });
  } catch (err) {
    console.error('Project traditional photo upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.delete('/projects/:pid/trad-employees/:id/photo', authenticateToken, (req, res) => {
  try {
    const { pid, id } = req.params;
    const existing = db.prepare('SELECT id, photo_url, employee_id FROM proj_trad_employees WHERE project_id = ? AND id = ?').get(pid, id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    removeStoredPhoto(existing.photo_url);
    db.prepare(`UPDATE proj_trad_employees SET photo_url = NULL WHERE project_id = ? AND id = ?`).run(pid, id);

    // ── Sync removal to master employees and trad_employees tables ───────────
    if (existing.employee_id) {
      db.prepare('UPDATE employees SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?')
        .run(existing.employee_id);
      db.prepare('UPDATE trad_employees SET photo_url = NULL WHERE employee_id = ?')
        .run(existing.employee_id);
    }

    res.json({ message: 'Photo removed', photo_url: null });
  } catch (err) {
    console.error('Project traditional photo remove error:', err);
    res.status(500).json({ error: err.message || 'Remove failed' });
  }
});

export default router;
