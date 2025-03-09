// File Service - Handles file-related operations

/**
 * Select a directory using the system dialog
 * @returns {Promise<string>} - Selected directory path
 */
async function selectDirectory() {
  try {
    console.log('Selecting directory...');
    const result = await window.electronAPI.selectDirectory();
    console.log('Directory selection result:', result);
    return result;
  } catch (error) {
    console.error('Error selecting directory:', error);
    throw error;
  }
}

/**
 * Update file rows with analysis results
 * @param {Array} videoFiles - Array of video files with analysis results
 * @param {string} seriesId - Series ID
 */
function updateFileRowsWithAnalysis(videoFiles, seriesId) {
  try {
    if (!videoFiles || !videoFiles.length) {
      console.log('No video files to update');
      return;
    }
    
    console.log(`Updating ${videoFiles.length} file rows for series ${seriesId}`);
    
    // Find all file rows for this series
    const fileRows = document.querySelectorAll(`[data-series-id="${seriesId}"].file-row`);
    console.log(`Found ${fileRows.length} file rows to update`);
    
    fileRows.forEach(row => {
      const fileId = row.dataset.fileId;
      const matchingFile = videoFiles.find(file => file.id === fileId);
      
      if (matchingFile) {
        // Update the row with analysis results
        updateFileRowWithAnalysis(row, matchingFile);
      }
    });
  } catch (error) {
    console.error('Error updating file rows:', error);
  }
}

/**
 * Update a file row with analysis results
 * @param {HTMLElement} row - The file row element
 * @param {Object} file - The file object with analysis results
 */
function updateFileRowWithAnalysis(row, file) {
  try {
    // Update status cell
    const statusCell = row.querySelector('.status-cell');
    if (statusCell) {
      statusCell.innerHTML = getStatusIndicator(file);
    }
    
    // Update the match cell if there are matches
    const matchCell = row.querySelector('.match-cell');
    if (matchCell && file.matches && file.matches.length > 0) {
      matchCell.innerHTML = createMatchesDropdown(file);
    }
    
    // Add data attributes for status filtering
    row.dataset.status = file.status || 'unknown';
    
    // Add click handler for the matches dropdown if it exists
    const dropdown = row.querySelector('.matches-dropdown');
    if (dropdown) {
      dropdown.addEventListener('change', () => {
        const episodeId = dropdown.value;
        if (episodeId && episodeId !== 'none') {
          fixFile(file.id, episodeId);
        }
      });
    }
  } catch (error) {
    console.error('Error updating file row:', error, file);
  }
}

/**
 * Get status indicator HTML based on file status
 * @param {Object} file - File object
 * @returns {string} - HTML for status indicator
 */
function getStatusIndicator(file) {
  const status = file.status || 'unknown';
  let iconClass = '';
  let statusText = '';
  
  switch (status) {
    case 'verified':
      iconClass = 'verified-icon fas fa-check-circle';
      statusText = 'Verified';
      break;
    case 'processed':
      iconClass = 'processed-icon fas fa-clock';
      statusText = 'Processed';
      break;
    case 'processing':
      iconClass = 'processing-icon fas fa-spinner fa-spin';
      statusText = 'Processing';
      break;
    case 'error':
      iconClass = 'error-icon fas fa-exclamation-circle';
      statusText = file.error || 'Error';
      break;
    default:
      iconClass = 'unknown-icon fas fa-question-circle';
      statusText = 'Unknown';
  }
  
  return `<i class="${iconClass}" title="${statusText}"></i> ${statusText}`;
}

/**
 * Create matches dropdown HTML
 * @param {Object} file - File object with matches
 * @returns {string} - HTML for matches dropdown
 */
function createMatchesDropdown(file) {
  if (!file.matches || file.matches.length === 0) {
    return '<span>No matches</span>';
  }
  
  let html = `<select class="matches-dropdown" data-file-id="${file.id}">`;
  html += '<option value="none">Select match...</option>';
  
  file.matches.forEach(match => {
    const selected = match.selected ? 'selected' : '';
    html += `<option value="${match.episodeId}" ${selected}>S${match.season}E${match.episode} - ${match.confidence.toFixed(2)}%</option>`;
  });
  
  html += '</select>';
  return html;
}

/**
 * Fix a file by linking it to an episode
 * @param {string} fileId - File ID
 * @param {string} episodeId - Episode ID
 */
async function fixFile(fileId, episodeId) {
  try {
    console.log(`Fixing file ${fileId} with episode ${episodeId}`);
    const result = await window.electronAPI.fixFile(fileId, episodeId);
    console.log('Fix result:', result);
    return result;
  } catch (error) {
    console.error('Error fixing file:', error);
    throw error;
  }
}

module.exports = {
  selectDirectory,
  updateFileRowsWithAnalysis,
  fixFile
}; 