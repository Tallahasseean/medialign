const fs = require('fs');
const path = require('path');
const util = require('util');

// Convert fs.readdir to Promise-based
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// Common video file extensions
const VIDEO_EXTENSIONS = [
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'
];

/**
 * Check if a file is a video based on its extension
 * @param {string} filePath - Path to the file
 * @returns {boolean} - Whether the file is a video
 */
function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Scan a directory for video files
 * @param {string} dirPath - Path to the directory
 * @param {boolean} recursive - Whether to scan subdirectories
 * @returns {Promise<Array<string>>} - Array of video file paths
 */
async function scanDirectory(dirPath, recursive = true) {
  try {
    const files = await readdir(dirPath);
    const results = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isDirectory() && recursive) {
        // Recursively scan subdirectories
        const subResults = await scanDirectory(filePath, recursive);
        results.push(...subResults);
      } else if (fileStat.isFile() && isVideoFile(filePath)) {
        // Add video files to results
        results.push(filePath);
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Group video files by season
 * @param {Array<string>} filePaths - Array of video file paths
 * @returns {Object} - Object with season numbers as keys and arrays of file paths as values
 */
function groupFilesBySeason(filePaths) {
  const seasons = {};
  
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    
    // Try to extract season number using common patterns
    // Pattern: S01E01, Season 1, etc.
    let seasonMatch = fileName.match(/S(\d+)E\d+/i) || 
                      fileName.match(/Season\s*(\d+)/i) ||
                      fileName.match(/(\d+)x\d+/);
    
    if (seasonMatch) {
      const seasonNumber = parseInt(seasonMatch[1], 10);
      
      if (!seasons[seasonNumber]) {
        seasons[seasonNumber] = [];
      }
      
      seasons[seasonNumber].push(filePath);
    } else {
      // If no season number found, put in season 0 (unknown)
      if (!seasons[0]) {
        seasons[0] = [];
      }
      
      seasons[0].push(filePath);
    }
  }
  
  return seasons;
}

/**
 * Extract episode information from filename
 * @param {string} filePath - Path to the video file
 * @returns {Object} - Object with season and episode numbers
 */
function extractEpisodeInfo(filePath) {
  const fileName = path.basename(filePath);
  
  // Try different patterns to extract season and episode numbers
  
  // Pattern: S01E01
  let match = fileName.match(/S(\d+)E(\d+)/i);
  if (match) {
    return {
      season: parseInt(match[1], 10),
      episode: parseInt(match[2], 10)
    };
  }
  
  // Pattern: 1x01
  match = fileName.match(/(\d+)x(\d+)/);
  if (match) {
    return {
      season: parseInt(match[1], 10),
      episode: parseInt(match[2], 10)
    };
  }
  
  // Pattern: Season 1 Episode 1
  match = fileName.match(/Season\s*(\d+)\s*Episode\s*(\d+)/i);
  if (match) {
    return {
      season: parseInt(match[1], 10),
      episode: parseInt(match[2], 10)
    };
  }
  
  // If no pattern matches, return null
  return null;
}

/**
 * Rename a file
 * @param {string} oldPath - Current path of the file
 * @param {string} newName - New filename (without path)
 * @returns {Promise<string>} - New path of the file
 */
async function renameFile(oldPath, newName) {
  const dirPath = path.dirname(oldPath);
  const newPath = path.join(dirPath, newName);
  
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error(`Error renaming file ${oldPath} to ${newPath}:`, err);
        reject(err);
      } else {
        console.log(`Renamed file from ${oldPath} to ${newPath}`);
        resolve(newPath);
      }
    });
  });
}

/**
 * Generate a new filename based on episode information
 * @param {string} originalPath - Original file path
 * @param {Object} episodeInfo - Episode information object
 * @returns {string} - New filename
 */
function generateFilename(originalPath, episodeInfo) {
  const ext = path.extname(originalPath);
  const paddedSeason = String(episodeInfo.season).padStart(2, '0');
  const paddedEpisode = String(episodeInfo.episode).padStart(2, '0');
  
  return `S${paddedSeason}E${paddedEpisode} - ${episodeInfo.title}${ext}`;
}

module.exports = {
  scanDirectory,
  groupFilesBySeason,
  extractEpisodeInfo,
  renameFile,
  generateFilename,
  isVideoFile
}; 