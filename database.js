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
        is_correct BOOLEAN DEFAULT 0,
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
          // Run migrations after tables are created
          migrateDatabase()
            .then(() => resolve())
            .catch(err => reject(err));
        }
      });
    });
  });
}

// Run database migrations
function migrateDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if is_correct column exists in files table
      db.all("PRAGMA table_info(files)", (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Check if the column exists
        const hasIsCorrectColumn = rows.some(row => row.name === 'is_correct');
        
        if (!hasIsCorrectColumn) {
          console.log('Adding is_correct column to files table...');
          // Add the column if it doesn't exist
          db.run("ALTER TABLE files ADD COLUMN is_correct BOOLEAN DEFAULT 0", (err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log('Added is_correct column successfully');
          });
        } else {
          console.log('is_correct column already exists in files table');
        }
      });
      
      // Check if audio_extraction_status column exists in files table
      db.all("PRAGMA table_info(files)", (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Check if the columns exist
        const hasAudioStatusColumn = rows.some(row => row.name === 'audio_extraction_status');
        const hasAudioProgressColumn = rows.some(row => row.name === 'audio_extraction_progress');
        const hasProcessingStepColumn = rows.some(row => row.name === 'processing_step');
        
        if (!hasAudioStatusColumn) {
          console.log('Adding audio_extraction_status column to files table...');
          db.run("ALTER TABLE files ADD COLUMN audio_extraction_status TEXT DEFAULT 'pending'", (err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log('Added audio_extraction_status column successfully');
          });
        }
        
        if (!hasAudioProgressColumn) {
          console.log('Adding audio_extraction_progress column to files table...');
          db.run("ALTER TABLE files ADD COLUMN audio_extraction_progress INTEGER DEFAULT 0", (err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log('Added audio_extraction_progress column successfully');
          });
        }
        
        if (!hasProcessingStepColumn) {
          console.log('Adding processing_step column to files table...');
          db.run("ALTER TABLE files ADD COLUMN processing_step TEXT DEFAULT 'pending'", (err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log('Added processing_step column successfully');
          });
        }
      });
      
      // Create audio_data table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS audio_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        segment_number INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        audio_data BLOB,
        text_transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files (id),
        UNIQUE(file_id, segment_number)
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Created or verified audio_data table');
      });
      
      // Create settings table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Created or verified settings table');
        
        // Set default settings if they don't exist
        db.get("SELECT value FROM settings WHERE key = 'max_extraction_processes'", (err, row) => {
          if (err || !row) {
            db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_extraction_processes', ?)", 
              [Math.max(1, Math.floor(require('os').cpus().length / 2))], 
              (err) => {
                if (err) console.error('Error setting default max_extraction_processes:', err);
                else console.log('Set default max_extraction_processes');
              });
          }
        });
        
        resolve();
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

function updateFileStatus(fileId, episodeId, status, correctedFilename, confidenceScore, isCorrect = 0) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE files SET episode_id = ?, status = ?, corrected_filename = ?, confidence_score = ?, is_correct = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [episodeId, status, correctedFilename, confidenceScore, isCorrect, fileId],
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
    const query = seriesId ? 
      `SELECT f.*, e.season_number, e.episode_number, e.title as episode_title 
       FROM files f 
       LEFT JOIN episodes e ON f.episode_id = e.id 
       WHERE f.series_id = ?` :
      `SELECT f.*, e.season_number, e.episode_number, e.title as episode_title 
       FROM files f 
       LEFT JOIN episodes e ON f.episode_id = e.id`;
    
    const params = seriesId ? [seriesId] : [];
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
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

// Get cached episode data
function getCachedEpisodeInfo(tmdbId, seasonNumber, episodeNumber) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT data, last_updated FROM tmdb_episode_cache WHERE tmdb_id = ? AND season_number = ? AND episode_number = ?',
      [tmdbId, seasonNumber, episodeNumber],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          try {
            const data = JSON.parse(row.data);
            const lastUpdated = new Date(row.last_updated);
            resolve({ data, lastUpdated });
          } catch (parseErr) {
            console.error('Error parsing cached episode data:', parseErr);
            resolve(null);
          }
        }
      }
    );
  });
}

// Cache episode data
function cacheEpisodeInfo(tmdbId, seasonNumber, episodeNumber, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    
    db.run(
      `INSERT OR REPLACE INTO tmdb_episode_cache 
       (tmdb_id, season_number, episode_number, data, last_updated) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [tmdbId, seasonNumber, episodeNumber, jsonData],
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

// Update file processing step
function updateFileProcessingStep(fileId, step) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE files SET processing_step = ? WHERE id = ?',
      [step, fileId],
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

// Update audio extraction status
function updateAudioExtractionStatus(fileId, status, progress = 0) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE files SET audio_extraction_status = ?, audio_extraction_progress = ? WHERE id = ?',
      [status, progress, fileId],
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

// Save audio segment data
function saveAudioSegment(fileId, segmentNumber, startTime, duration, audioData, transcript = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO audio_data 
       (file_id, segment_number, start_time, duration, audio_data, text_transcript) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fileId, segmentNumber, startTime, duration, audioData, transcript],
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

// Get audio segments for a file
function getAudioSegments(fileId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM audio_data WHERE file_id = ? ORDER BY segment_number',
      [fileId],
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

// Get files that need audio extraction
function getFilesForAudioExtraction(seriesId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM files 
       WHERE series_id = ? AND 
       (audio_extraction_status = 'pending' OR audio_extraction_status = 'in_progress') 
       ORDER BY id LIMIT ?`,
      [seriesId, limit],
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

// Get setting value
function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT value FROM settings WHERE key = ?',
      [key],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.value : null);
        }
      }
    );
  });
}

// Update setting value
function updateSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value],
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

// Get a single file by ID
function getFile(fileId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Get a single episode by ID
function getEpisode(episodeId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM episodes WHERE id = ?', [episodeId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Get all files for a specific series directory
function getFilesForSeries(directory) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        f.id, 
        f.original_path as file_path, 
        f.original_filename, 
        f.corrected_filename, 
        f.status, 
        f.confidence_score, 
        f.is_correct,
        f.episode_id,
        e.season_number,
        e.episode_number,
        f.audio_extraction_status,
        f.audio_extraction_progress,
        f.processing_step
      FROM 
        files f
      LEFT JOIN 
        episodes e ON f.episode_id = e.id
      WHERE 
        f.original_path LIKE ?
      ORDER BY 
        e.season_number, e.episode_number
    `;
    
    // Use % as wildcard to match any files in the directory or subdirectories
    const directoryPattern = `${directory}%`;
    
    db.all(query, [directoryPattern], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Remove a series by ID
function removeSeries(seriesId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Begin transaction
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Error beginning transaction:', err);
          reject(err);
          return;
        }
        
        // Delete files associated with the series
        db.run('DELETE FROM files WHERE series_id = ?', [seriesId], (err) => {
          if (err) {
            console.error('Error deleting files:', err);
            db.run('ROLLBACK', () => reject(err));
            return;
          }
          
          // Delete episodes associated with the series
          db.run('DELETE FROM episodes WHERE series_id = ?', [seriesId], (err) => {
            if (err) {
              console.error('Error deleting episodes:', err);
              db.run('ROLLBACK', () => reject(err));
              return;
            }
            
            // Delete the series
            db.run('DELETE FROM series WHERE id = ?', [seriesId], (err) => {
              if (err) {
                console.error('Error deleting series:', err);
                db.run('ROLLBACK', () => reject(err));
                return;
              }
              
              // Commit transaction
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  db.run('ROLLBACK', () => reject(err));
                  return;
                }
                
                resolve({ success: true, seriesId });
              });
            });
          });
        });
      });
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
  getCachedEpisodeInfo,
  cacheEpisodeInfo,
  clearExpiredCache,
  closeDatabase,
  updateFileProcessingStep,
  updateAudioExtractionStatus,
  saveAudioSegment,
  getAudioSegments,
  getFilesForAudioExtraction,
  getSetting,
  updateSetting,
  getFile,
  getEpisode,
  getFilesForSeries,
  removeSeries
}; 