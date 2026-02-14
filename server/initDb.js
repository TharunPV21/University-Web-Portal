const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function runSeed(db) {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','faculty','admin'))
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      UNIQUE(user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      session_date DATE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present','Absent')),
      marked_by INTEGER,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (marked_by) REFERENCES users(id),
      UNIQUE(course_id, student_id, session_date)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      file_path TEXT,
      file_name TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      feedback_text TEXT,
      score INTEGER,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (student_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (existing && existing.c > 0) return;

  db.prepare(`
    INSERT INTO users (email, password, name, role) VALUES
    ('admin@uni.edu', 'admin123', 'Admin User', 'admin'),
    ('faculty1@uni.edu', 'faculty123', 'Dr. Jane Smith', 'faculty'),
    ('student1@uni.edu', 'student123', 'Alice Johnson', 'student'),
    ('student2@uni.edu', 'student123', 'Bob Williams', 'student'),
    ('student3@uni.edu', 'student123', 'Carol Davis', 'student')
  `).run();

  db.prepare(`
    INSERT INTO courses (name, code) VALUES
    ('Introduction to Computer Science', 'CS101'),
    ('Web Development', 'CS201'),
    ('Database Systems', 'CS301')
  `).run();

  const students = [3, 4, 5];
  const courses = [1, 2, 3];
  for (const sid of students) {
    for (const cid of courses) {
      db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)').run(sid, cid);
    }
  }

  db.prepare(`
    INSERT INTO assignments (course_id, title, description, due_date) VALUES
    (1, 'Assignment 1 - Basics', 'Complete exercises 1-5', date('now','+7 days')),
    (1, 'Assignment 2 - Loops', 'Implement loops and arrays', date('now','+14 days')),
    (2, 'Portfolio Website', 'Build a simple portfolio with HTML/CSS', date('now','+10 days'))
  `).run();

  db.prepare(`
    INSERT INTO events (title, description, event_date) VALUES
    ('Annual Tech Fest', 'Coding competition and workshops', date('now','+5 days')),
    ('Guest Lecture: AI in Education', 'Dr. Smith from MIT', date('now','+3 days')),
    ('Semester Registration Opens', 'Register for next semester courses', date('now','+1 days'))
  `).run();
}

if (require.main === module) {
  const { loadDb } = require('./db');
  loadDb().then(db => {
    runSeed(db);
    process.exit(0);
  }).catch(() => {
    process.exit(1);
  });
}

module.exports = { runSeed };
