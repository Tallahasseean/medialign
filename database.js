const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(process.env.APPDATA || 
                         (process.platform === 'darwin' ? 
                          path.join(process.env.HOME, 'Library', 'Application Support') : 
                          path.join(process.env.HOME, '.local', 'share')), 
                         'MediaAlign');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'medialign.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create series table
      db.run(`CREATE TABLE IF NOT EXISTS series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imdb_id TEXT NOT NULL,
        title TEXT NOT NULL,
        directory TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Create episodes table
      db.run(`CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        imdb_id TEXT,
        FOREIGN KEY (series_id) REFERENCES series (id)
      )`);

      // Create files table
      db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id INTEGER NOT NULL,
        episode_id INTEGER,
        original_path TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        corrected_filename TEXT,
        status TEXT DEFAULT 'pending', /* pending, correct, incorrect, fixed */
        confidence_score REAL,
        processed_at TIMESTAMP,
        FOREIGN KEY (series_id) REFERENCES series (id),
        FOREIGN KEY (episode_id) REFERENCES episodes (id)
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Series operations
function addSeries(imdbId, title, directory) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO series (imdb_id, title, directory) VALUES (?, ?, ?)',
      [imdbId, title, directory],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function getSeries(seriesId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM series WHERE id = ?', [seriesId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function getAllSeries() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM series ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Episode operations
function addEpisode(seriesId, seasonNumber, episodeNumber, title, description, imdbId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO episodes (series_id, season_number, episode_number, title, description, imdb_id) VALUES (?, ?, ?, ?, ?, ?)',
      [seriesId, seasonNumber, episodeNumber, title, description, imdbId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function getEpisodes(seriesId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM episodes WHERE series_id = ? ORDER BY season_number, episode_number',
      [seriesId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// File operations
function addFile(seriesId, originalPath, originalFilename) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO files (series_id, original_path, original_filename) VALUES (?, ?, ?)',
      [seriesId, originalPath, originalFilename],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function updateFileStatus(fileId, episodeId, status, correctedFilename, confidenceScore) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE files SET episode_id = ?, status = ?, corrected_filename = ?, confidence_score = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [episodeId, status, correctedFilename, confidenceScore, fileId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

function getFiles(seriesId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT f.*, e.season_number, e.episode_number, e.title as episode_title 
       FROM files f 
       LEFT JOIN episodes e ON f.episode_id = e.id 
       WHERE f.series_id = ?`,
      [seriesId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function getProcessingSummary(seriesId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN status = 'incorrect' THEN 1 ELSE 0 END) as incorrect,
        SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed
       FROM files
       WHERE series_id = ?`,
      [seriesId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  initDatabase,
  addSeries,
  getSeries,
  getAllSeries,
  addEpisode,
  getEpisodes,
  addFile,
  updateFileStatus,
  getFiles,
  getProcessingSummary,
  closeDatabase
}; 