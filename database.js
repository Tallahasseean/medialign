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
      )`);
      
      // Create TMDB series cache table
      db.run(`CREATE TABLE IF NOT EXISTS tmdb_series_cache (
        tmdb_id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Create TMDB season cache table
      db.run(`CREATE TABLE IF NOT EXISTS tmdb_season_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        data TEXT NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tmdb_id, season_number)
      )`);
      
      // Create TMDB episode cache table
      db.run(`CREATE TABLE IF NOT EXISTS tmdb_episode_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        data TEXT NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tmdb_id, season_number, episode_number)
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

// TMDB Cache Operations

// Get cached series data
function getCachedSeriesInfo(tmdbId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT data, last_updated FROM tmdb_series_cache WHERE tmdb_id = ?',
      [tmdbId],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null); // No cached data found
        } else {
          try {
            const parsedData = JSON.parse(row.data);
            resolve({
              data: parsedData,
              lastUpdated: new Date(row.last_updated)
            });
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      }
    );
  });
}

// Cache series data
function cacheSeriesInfo(tmdbId, data) {
  return new Promise((resolve, reject) => {
    const serializedData = JSON.stringify(data);
    
    db.run(
      `INSERT OR REPLACE INTO tmdb_series_cache (tmdb_id, data, last_updated)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [tmdbId, serializedData],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Get cached season data
function getCachedSeasonInfo(tmdbId, seasonNumber) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT data, last_updated FROM tmdb_season_cache WHERE tmdb_id = ? AND season_number = ?',
      [tmdbId, seasonNumber],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null); // No cached data found
        } else {
          try {
            const parsedData = JSON.parse(row.data);
            resolve({
              data: parsedData,
              lastUpdated: new Date(row.last_updated)
            });
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      }
    );
  });
}

// Cache season data
function cacheSeasonInfo(tmdbId, seasonNumber, data) {
  return new Promise((resolve, reject) => {
    const serializedData = JSON.stringify(data);
    
    db.run(
      `INSERT OR REPLACE INTO tmdb_season_cache (tmdb_id, season_number, data, last_updated)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [tmdbId, seasonNumber, serializedData],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Clear expired cache entries
function clearExpiredCache(expirationDays = 30) {
  return new Promise((resolve, reject) => {
    const expirationTimestamp = new Date();
    expirationTimestamp.setDate(expirationTimestamp.getDate() - expirationDays);
    
    db.serialize(() => {
      // Clear expired series cache
      db.run(
        'DELETE FROM tmdb_series_cache WHERE last_updated < ?',
        [expirationTimestamp.toISOString()],
        (err) => {
          if (err) console.error('Error clearing expired series cache:', err);
        }
      );
      
      // Clear expired season cache
      db.run(
        'DELETE FROM tmdb_season_cache WHERE last_updated < ?',
        [expirationTimestamp.toISOString()],
        (err) => {
          if (err) console.error('Error clearing expired season cache:', err);
        }
      );
      
      // Clear expired episode cache
      db.run(
        'DELETE FROM tmdb_episode_cache WHERE last_updated < ?',
        [expirationTimestamp.toISOString()],
        (err) => {
          if (err) {
            console.error('Error clearing expired episode cache:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
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
  getCachedSeriesInfo,
  cacheSeriesInfo,
  getCachedSeasonInfo,
  cacheSeasonInfo,
  clearExpiredCache,
  closeDatabase
}; 