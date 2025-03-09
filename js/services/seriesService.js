// Series Service - Manages series data and operations

// Store all series
let seriesList = [];

/**
 * Load series list from local storage
 * @returns {Promise<Array>} - Loaded series list
 */
async function loadSeriesList() {
  try {
    // Initialize an empty series list if needed
    if (!Array.isArray(seriesList)) {
      seriesList = [];
    }
    
    console.log('Loading series list from local storage...');
    
    // Load from local storage
    const storedSeries = localStorage.getItem('seriesList');
    console.log('Raw stored series:', storedSeries);
    
    if (storedSeries) {
      try {
        const localSeriesList = JSON.parse(storedSeries);
        console.log(`Parsed ${localSeriesList.length} series from local storage`);
        
        // Add local series to the list if they're valid
        if (Array.isArray(localSeriesList)) {
          // Check if we already have series in the list
          if (seriesList.length > 0) {
            console.log(`Merging ${localSeriesList.length} series with existing ${seriesList.length} series`);
            
            // Merge by ID to avoid duplicates
            localSeriesList.forEach(localSeries => {
              if (localSeries.id) {
                const existingIndex = seriesList.findIndex(s => s.id === localSeries.id);
                if (existingIndex >= 0) {
                  console.log(`Updating existing series: ${localSeries.title} (${localSeries.id})`);
                  seriesList[existingIndex] = localSeries;
                } else {
                  console.log(`Adding new series: ${localSeries.title} (${localSeries.id})`);
                  seriesList.push(localSeries);
                }
              } else {
                // Generate an ID if missing
                localSeries.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                console.log(`Adding series with new ID: ${localSeries.title} (${localSeries.id})`);
                seriesList.push(localSeries);
              }
            });
          } else {
            // Just use the loaded list
            seriesList = localSeriesList;
            console.log(`Set seriesList to ${seriesList.length} loaded series`);
          }
          
          // Ensure all series have IDs
          seriesList.forEach((series, index) => {
            if (!series.id) {
              series.id = Date.now().toString() + index;
              console.log(`Generated ID for series at index ${index}: ${series.id}`);
            }
          });
        } else {
          console.warn('Stored series is not an array:', localSeriesList);
        }
      } catch (error) {
        console.error('Error parsing stored series:', error);
      }
    } else {
      console.log('No stored series found in local storage');
    }
    
    console.log(`Returning ${seriesList.length} series from loadSeriesList`);
    return seriesList;
  } catch (error) {
    console.error('Error loading series list:', error);
    return [];
  }
}

/**
 * Save series list to local storage
 */
function saveSeriesList() {
  try {
    localStorage.setItem('seriesList', JSON.stringify(seriesList));
    console.log(`Saved ${seriesList.length} series to local storage`);
  } catch (error) {
    console.error('Error saving series list:', error);
  }
}

/**
 * Get all series
 * @returns {Array} - All series
 */
function getAllSeries() {
  return seriesList;
}

/**
 * Get series by index
 * @param {number} index - Series index
 * @returns {Object|null} - Series object or null if not found
 */
function getSeriesByIndex(index) {
  if (index >= 0 && index < seriesList.length) {
    return seriesList[index];
  }
  return null;
}

/**
 * Add a new series
 * @param {Object} series - Series object to add
 * @returns {number} - Index of the added series
 */
function addSeries(series) {
  // Ensure the series has an ID
  if (!series.id) {
    series.id = Date.now().toString();
  }
  
  seriesList.push(series);
  saveSeriesList();
  return seriesList.length - 1;
}

/**
 * Update a series by index
 * @param {number} index - Series index
 * @param {Object} updatedSeries - Updated series object
 * @returns {boolean} - Success status
 */
function updateSeries(index, updatedSeries) {
  if (index >= 0 && index < seriesList.length) {
    seriesList[index] = updatedSeries;
    saveSeriesList();
    return true;
  }
  return false;
}

/**
 * Delete a series by index
 * @param {number} index - Series index
 * @returns {boolean} - Success status
 */
function deleteSeries(index) {
  if (index >= 0 && index < seriesList.length) {
    seriesList.splice(index, 1);
    saveSeriesList();
    return true;
  }
  return false;
}

/**
 * Start audio extraction for a series
 * @param {number} seriesIndex - Series index
 * @returns {Promise<void>}
 */
async function startAudioExtraction(seriesIndex) {
  try {
    const series = getSeriesByIndex(seriesIndex);
    if (!series) {
      throw new Error(`Series not found: ${seriesIndex}`);
    }
    
    // Create a unique ID for this processing job if it doesn't exist
    if (!series.id) {
      series.id = Date.now().toString();
      updateSeries(seriesIndex, series);
    }
    
    console.log(`Starting audio extraction for series: ${series.title} (${series.id})`);
    
    // Start the analysis process via IPC
    await window.electronAPI.analyzeSeries(series.directory, series.tmdbId);
    
    // Begin polling for status updates
    return pollAudioExtractionStatus(seriesIndex, series.id);
  } catch (error) {
    console.error('Error starting audio extraction:', error);
    throw error;
  }
}

/**
 * Poll for audio extraction status
 * @param {number} seriesIndex - Series index
 * @param {string} seriesId - Series ID
 * @returns {Promise<void>}
 */
async function pollAudioExtractionStatus(seriesIndex, seriesId) {
  try {
    const series = getSeriesByIndex(seriesIndex);
    if (!series || series.id !== seriesId) {
      console.log('Series changed or removed, stopping polling');
      return;
    }
    
    const status = await window.electronAPI.getProcessingStatus(seriesId);
    
    if (status) {
      // Update progress
      if (status.progress) {
        // Update progress UI
        const progressBar = document.getElementById('progress-bar');
        const progressLabel = document.getElementById('progress-label');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressBar && progressLabel && progressPercentage) {
          const percentage = Math.round(status.progress.percentage || 0);
          progressBar.value = percentage;
          progressBar.style.width = `${percentage}%`;
          progressLabel.textContent = status.progress.message || 'Processing...';
          progressPercentage.textContent = `${percentage}%`;
        }
      }
      
      // If processing is complete
      if (status.complete) {
        console.log('Processing complete:', status);
        return;
      }
    }
    
    // Continue polling
    setTimeout(() => pollAudioExtractionStatus(seriesIndex, seriesId), 1000);
  } catch (error) {
    console.error('Error polling for status:', error);
  }
}

/**
 * Fix a file by linking it to an episode
 * @param {string} fileId - File ID
 * @param {string} episodeId - Episode ID
 * @returns {Promise<Object>} - Result of the fix operation
 */
async function fixFile(fileId, episodeId) {
  try {
    return await window.electronAPI.fixFile(fileId, episodeId);
  } catch (error) {
    console.error('Error fixing file:', error);
    throw error;
  }
}

module.exports = {
  loadSeriesList,
  saveSeriesList,
  getAllSeries,
  getSeriesByIndex,
  addSeries,
  updateSeries,
  deleteSeries,
  startAudioExtraction,
  pollAudioExtractionStatus,
  fixFile
}; 