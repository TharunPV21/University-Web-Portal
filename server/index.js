const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { getDb, loadDb } = require('./db');
const { runSeed } = require('./initDb');
const { evaluateWithAI } = require('./aiEvaluation');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '..', 'uploads');
try { require('fs').mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|docx?|txt|png|jpe?g)$/i.test(file.originalname);
    cb(null, !!allowed);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

function getCurrentUser(req) {
  const db = req.app.locals.db;
  if (!db) return null;
  const sid = req.cookies?.session;
  if (!sid) return null;
  const u = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(parseInt(sid, 10));
  return u || null;
}

app.post('/api/login', (req, res) => {
  const db = req.app.locals.db;
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ? AND password = ?').get(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  res.cookie('session', user.id, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const user = getCurrentUser(req);
  res.json(user ? { user } : { user: null });
});

app.get('/api/events', (req, res) => {
  const list = req.app.locals.db.prepare('SELECT id, title, description, event_date FROM events ORDER BY event_date ASC LIMIT 10').all();
  res.json({ events: list });
});

app.get('/api/courses', (req, res) => {
  const list = req.app.locals.db.prepare('SELECT id, name, code FROM courses ORDER BY code').all();
  res.json({ courses: list });
});

app.get('/api/attendance/students', (req, res) => {
  const courseId = req.query.courseId;
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  const students = req.app.locals.db.prepare(`
    SELECT u.id, u.name, u.email FROM users u
    JOIN enrollments e ON e.user_id = u.id
    WHERE e.course_id = ? AND u.role = 'student'
    ORDER BY u.name
  `).all(courseId);
  res.json({ students });
});

app.post('/api/attendance/mark', (req, res) => {
  const user = getCurrentUser(req);
  if (!user || (user.role !== 'faculty' && user.role !== 'admin'))
    return res.status(403).json({ error: 'Faculty access required' });
  const { courseId, date, records } = req.body;
  if (!courseId || !date || !Array.isArray(records))
    return res.status(400).json({ error: 'courseId, date, and records required' });
  const db = req.app.locals.db;
  const insert = db.prepare(`
    INSERT OR REPLACE INTO attendance (course_id, student_id, session_date, status, marked_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const r of records) {
      insert.run(courseId, r.studentId, date, r.status || 'Absent', user.id);
    }
  });
  res.json({ ok: true });
});

app.get('/api/attendance/records', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Login required' });
  const { courseId, from, to } = req.query;
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  let sql = `
    SELECT a.session_date, a.status, u.name as student_name
    FROM attendance a
    JOIN users u ON u.id = a.student_id
    WHERE a.course_id = ?
  `;
  const params = [courseId];
  if (from) { sql += ' AND a.session_date >= ?'; params.push(from); }
  if (to) { sql += ' AND a.session_date <= ?'; params.push(to); }
  sql += ' ORDER BY a.session_date DESC, u.name';
  const records = req.app.locals.db.prepare(sql).all(...params);
  res.json({ records });
});

app.get('/api/assignments', (req, res) => {
  const courseId = req.query.courseId;
  let sql = 'SELECT id, course_id, title, description, due_date FROM assignments';
  const params = [];
  if (courseId) { sql += ' WHERE course_id = ?'; params.push(courseId); }
  sql += ' ORDER BY due_date';
  const list = req.app.locals.db.prepare(sql).all(...params);
  res.json({ assignments: list });
});

app.post('/api/assignments/:id/submit', upload.single('file'), async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'student')
    return res.status(403).json({ error: 'Student access required' });
  const db = req.app.locals.db;
  const assignmentId = parseInt(req.params.id, 10);
  const assignment = db.prepare('SELECT id, course_id FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(user.id, assignment.course_id);
  if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this course' });

  const file = req.file;
  const filePath = file ? path.join(file.path) : null;
  const fileName = file ? file.originalname : null;

  let feedback_text = '';
  let score = null;
  try {
    const result = await evaluateWithAI(filePath, fileName, req.body.textContent);
    feedback_text = result.feedback;
    score = result.score;
  } catch (e) {
    feedback_text = 'Evaluation could not be run: ' + (e.message || 'Unknown error');
  }

  db.prepare(`
    INSERT INTO submissions (assignment_id, student_id, file_path, file_name, feedback_text, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(assignmentId, user.id, filePath, fileName, feedback_text, score);

  res.json({ ok: true, feedback: feedback_text, score });
});

app.get('/api/submissions', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Login required' });
  const db = req.app.locals.db;
  let list;
  if (user.role === 'student') {
    list = db.prepare(`
      SELECT s.id, s.assignment_id, s.file_name, s.submitted_at, s.feedback_text, s.score, a.title as assignment_title
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC
    `).all(user.id);
  } else {
    list = db.prepare(`
      SELECT s.id, s.assignment_id, s.student_id, s.file_name, s.submitted_at, s.feedback_text, s.score,
             a.title as assignment_title, u.name as student_name
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN users u ON u.id = s.student_id
      ORDER BY s.submitted_at DESC
    `).all();
  }
  res.json({ submissions: list });
});

loadDb().then(db => {
  runSeed(db);
  app.locals.db = db;
  app.listen(PORT, () => {});
}).catch(err => {
  process.exit(1);
});
