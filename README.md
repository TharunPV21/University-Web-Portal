# University Web Portal

A simple, user-friendly university portal with a homepage, attendance marking (faculty), and assignment submission with AI-based evaluation (students).

## Features

- **Home Page**: University branding, navigation, upcoming events, quick links, footer with contact and social links. Responsive layout.
- **Attendance**: Faculty can select class and date, mark each student Present/Absent, and view attendance records by course and date range. Data stored in SQLite.
- **Assignments**: Students select course and assignment, upload a file (PDF, DOCX, TXT, images) or paste text. The system runs AI evaluation (OpenAI if `OPENAI_API_KEY` is set, otherwise rule-based feedback) and shows a score and feedback.
- **Auth**: Simple login (demo accounts below). Session cookie for faculty/student/admin.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server (this creates the database and seed data automatically):
   ```bash
   npm start
   ```
3. Open **http://localhost:3000** in your browser.

## Demo Logins

| Role    | Email              | Password   |
|---------|--------------------|------------|
| Faculty | faculty1@uni.edu   | faculty123 |
| Student | student1@uni.edu  | student123 |
| Admin   | admin@uni.edu      | admin123   |

## Optional: AI Evaluation with OpenAI

For richer AI feedback on assignments, set your OpenAI API key:

- Windows (PowerShell): `$env:OPENAI_API_KEY="sk-your-key"`
- Mac/Linux: `export OPENAI_API_KEY=sk-your-key`

Then restart the server. Without the key, the app still gives rule-based feedback (length, structure, etc.).

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js, Express
- **Database**: SQLite (via sql.js — runs everywhere, no native build)
- **AI**: OpenAI API (optional), fallback rule-based evaluation
- **File upload**: Multer; text extraction from PDF (pdf-parse), DOCX (mammoth)

## Project Structure

```
├── public/
│   ├── index.html      # Home page
│   ├── about.html      # About Us
│   ├── courses.html    # Course list
│   ├── login.html      # Login
│   ├── attendance.html # Mark & view attendance (faculty)
│   ├── assignments.html# Submit assignments & AI feedback (students)
│   ├── css/style.css
│   └── js/app.js
├── server/
│   ├── index.js        # Express app & API
│   ├── db.js           # SQLite connection
│   ├── initDb.js       # Schema & seed
│   └── aiEvaluation.js # AI/rule-based feedback
├── uploads/            # Assignment uploads (created on first run)
├── package.json
└── README.md
```

## Notes

- Passwords are stored in plain text for demo only; use hashing in production.
- PDF parsing is optional (`pdf-parse`); if not installed, only DOCX, TXT, and pasted text are evaluated.
