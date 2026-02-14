const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'university.db');
let db = null;

function wrapDb(sqliteDb) {
  return {
    prepare(sql) {
      return {
        get(...params) {
          const stmt = sqliteDb.prepare(sql);
          try {
            if (params.length) stmt.bind(params);
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally {
            stmt.free();
          }
        },
        all(...params) {
          const stmt = sqliteDb.prepare(sql);
          try {
            if (params.length) stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.free();
          }
        },
        run(...params) {
          sqliteDb.run(sql, params);
        }
      };
    },
    exec(sql) {
      sqliteDb.exec(sql);
    },
    transaction(fn) {
      sqliteDb.run('BEGIN TRANSACTION');
      try {
        fn();
        sqliteDb.run('COMMIT');
      } catch (e) {
        sqliteDb.run('ROLLBACK');
        throw e;
      }
    }
  };
}

function save() {
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

async function loadDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  const wrapped = wrapDb(db);
  // Patch run to save after each write (simple persistence)
  const origRun = wrapped.prepare.bind(wrapped);
  wrapped.prepare = function(sql) {
    const p = origRun(sql);
    const origR = p.run;
    p.run = function(...args) {
      origR.apply(this, args);
      save();
    };
    return p;
  };
  const origExec = wrapped.exec;
  wrapped.exec = function(sql) {
    origExec(sql);
    save();
  };
  return wrapped;
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) dbPromise = loadDb();
  return dbPromise;
}

module.exports = { getDb, loadDb, save };
