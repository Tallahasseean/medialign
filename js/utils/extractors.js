// Utility functions for extracting information from filenames and paths

/**
 * Extract title from directory path
 * @param {string} dirPath - Directory path
 * @returns {string} - Extracted title
 */
function extractTitleFromPath(dirPath) {
  if (!dirPath) return '';
  
  // Get the last directory name from the path
  const lastDir = dirPath.split(path.sep).pop();
  
  // Clean up the title (remove year, special characters)
  let title = lastDir
    .replace(/\(\d{4}\)/, '') // Remove year in parentheses
    .replace(/\[.*?\]/, '') // Remove anything in square brackets
    .replace(/\.(480|720|1080)p/, '') // Remove resolution
    .trim();
    
  return title;
}

/**
 * Extract season and episode numbers from filename
 * @param {string} filename - Filename to extract from
 * @returns {Object|null} - Object with season and episode numbers or null if not found
 */
function extractSeasonEpisode(filename) {
  if (!filename) return null;
  
  // Common patterns for season and episode
  const patterns = [
    // S01E01 pattern
    /S(\d{1,2})E(\d{1,2})/i,
    // s01.e01 pattern
    /s(\d{1,2})\.e(\d{1,2})/i,
    // 1x01 pattern
    /(\d{1,2})x(\d{1,2})/i,
    // Season 1 Episode 1 pattern
    /Season\s*(\d{1,2}).*?Episode\s*(\d{1,2})/i,
    // 101 pattern (assuming season 1-9)
    /^(?:.*?)(?<!\d)([1-9])(\d{2})(?!\d)/
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return {
        season: parseInt(match[1], 10),
        episode: parseInt(match[2], 10)
      };
    }
  }
  
  return null;
}

module.exports = {
  extractTitleFromPath,
  extractSeasonEpisode
}; 