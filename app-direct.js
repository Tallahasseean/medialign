// Direct port of the working code from renderer.js
// This uses the code that was working before the refactor

// Set up global variables
let seriesList = [];
let currentSeriesId = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  
  // Initialize the application
  init();
});

// Initialize the application
async function init() {
  console.log('Initializing application...');
  
  try {
    // Load settings
    loadSettings();
    
    // Load series list
    await loadSeriesList();
    
    // Render series list
    renderSeriesTable();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Add Series button
  const addSeriesButton = document.getElementById('add-series-button');
  if (addSeriesButton) {
    console.log('Found Add Series button');
    addSeriesButton.addEventListener('click', () => {
      console.log('Add Series button clicked');
      const modal = document.getElementById('add-series-modal');
      if (modal) {
        // Reset fields
        const directory = document.getElementById('new-series-directory');
        const title = document.getElementById('new-series-title');
        const tmdbId = document.getElementById('new-tmdb-id');
        const results = document.getElementById('new-tmdb-results');
        
        if (directory) directory.value = '';
        if (title) title.value = '';
        if (tmdbId) tmdbId.value = '';
        if (results) results.style.display = 'none';
        
        modal.showModal();
      } else {
        console.error('Add Series modal not found');
      }
    });
  } else {
    console.error('Add Series button not found');
  }
  
  // Settings button
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    console.log('Found Settings button');
    settingsButton.addEventListener('click', () => {
      console.log('Settings button clicked');
      const modal = document.getElementById('settings-modal');
      if (modal) {
        modal.showModal();
      } else {
        console.error('Settings modal not found');
      }
    });
  }
  
  // Browse button in Add Series modal
  const newBrowseButton = document.getElementById('new-browse-button');
  if (newBrowseButton) {
    console.log('Found New Browse button');
    newBrowseButton.addEventListener('click', async () => {
      console.log('New Browse button clicked');
      try {
        const result = await window.electronAPI.selectDirectory();
        console.log('Directory selected:', result);
        
        const directoryInput = document.getElementById('new-series-directory');
        const titleInput = document.getElementById('new-series-title');
        
        if (directoryInput && result) {
          directoryInput.value = result;
          
          // Extract title from directory path
          if (titleInput) {
            const pathParts = result.split('/');
            titleInput.value = pathParts[pathParts.length - 1];
          }
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    });
  }
  
  // Confirm Add Series button
  const confirmAddSeries = document.getElementById('confirm-add-series');
  if (confirmAddSeries) {
    console.log('Found Confirm Add Series button');
    confirmAddSeries.addEventListener('click', () => {
      console.log('Confirm Add Series button clicked');
      
      const directoryInput = document.getElementById('new-series-directory');
      const titleInput = document.getElementById('new-series-title');
      const tmdbIdInput = document.getElementById('new-tmdb-id');
      const modal = document.getElementById('add-series-modal');
      
      if (directoryInput && titleInput) {
        const directory = directoryInput.value.trim();
        const title = titleInput.value.trim();
        const tmdbId = tmdbIdInput ? tmdbIdInput.value.trim() : '';
        
        if (directory && title) {
          // Add series to list
          addSeries({
            directory,
            title,
            tmdbId: tmdbId || null,
            id: Date.now().toString()
          });
          
          // Close modal
          if (modal) modal.close();
          
          // Render series table
          renderSeriesTable();
        } else {
          alert('Please enter both a directory and title');
        }
      }
    });
  }
  
  // Cancel Add Series button
  const cancelAddSeries = document.getElementById('cancel-add-series');
  if (cancelAddSeries) {
    console.log('Found Cancel Add Series button');
    cancelAddSeries.addEventListener('click', () => {
      console.log('Cancel Add Series button clicked');
      const modal = document.getElementById('add-series-modal');
      if (modal) modal.close();
    });
  }
  
  // Cancel Settings button
  const cancelSettings = document.getElementById('cancel-settings');
  if (cancelSettings) {
    console.log('Found Cancel Settings button');
    cancelSettings.addEventListener('click', () => {
      console.log('Cancel Settings button clicked');
      const modal = document.getElementById('settings-modal');
      if (modal) modal.close();
    });
  }
  
  // Save Settings button
  const saveSettings = document.getElementById('save-settings');
  if (saveSettings) {
    console.log('Found Save Settings button');
    saveSettings.addEventListener('click', () => {
      console.log('Save Settings button clicked');
      
      const apiKeyInput = document.getElementById('tmdb-api-key');
      const accessTokenInput = document.getElementById('tmdb-access-token');
      const modal = document.getElementById('settings-modal');
      
      if (apiKeyInput) localStorage.setItem('tmdbApiKey', apiKeyInput.value);
      if (accessTokenInput) localStorage.setItem('tmdbAccessToken', accessTokenInput.value);
      
      if (modal) modal.close();
    });
  }
  
  console.log('Event listeners set up');
}

// Load series list from local storage
async function loadSeriesList() {
  try {
    console.log('Loading series list from local storage...');
    
    // Initialize an empty series list if needed
    if (!Array.isArray(seriesList)) {
      seriesList = [];
    }
    
    // Load from local storage
    const storedSeries = localStorage.getItem('seriesList');
    console.log('Raw stored series:', storedSeries);
    
    if (storedSeries) {
      try {
        const parsedSeries = JSON.parse(storedSeries);
        console.log(`Parsed ${parsedSeries.length} series from local storage`);
        
        if (Array.isArray(parsedSeries)) {
          seriesList = parsedSeries;
          
          // Ensure all series have IDs
          seriesList.forEach((series, index) => {
            if (!series.id) {
              series.id = Date.now().toString() + index;
            }
          });
        }
      } catch (error) {
        console.error('Error parsing stored series:', error);
      }
    } else {
      console.log('No stored series found in local storage');
    }
    
    console.log(`Loaded ${seriesList.length} series`);
    return seriesList;
  } catch (error) {
    console.error('Error loading series list:', error);
    return [];
  }
}

// Save series list to local storage
function saveSeriesList() {
  try {
    console.log(`Saving ${seriesList.length} series to local storage`);
    localStorage.setItem('seriesList', JSON.stringify(seriesList));
  } catch (error) {
    console.error('Error saving series list:', error);
  }
}

// Load settings from local storage
function loadSettings() {
  try {
    console.log('Loading settings from local storage...');
    
    // Check if we have TMDB API key and access token
    const tmdbApiKey = localStorage.getItem('tmdbApiKey');
    const tmdbAccessToken = localStorage.getItem('tmdbAccessToken');
    
    console.log('TMDB API Key exists:', !!tmdbApiKey);
    console.log('TMDB Access Token exists:', !!tmdbAccessToken);
    
    // Set input values if they exist
    const apiKeyInput = document.getElementById('tmdb-api-key');
    const accessTokenInput = document.getElementById('tmdb-access-token');
    
    if (apiKeyInput && tmdbApiKey) apiKeyInput.value = tmdbApiKey;
    if (accessTokenInput && tmdbAccessToken) accessTokenInput.value = tmdbAccessToken;
    
    // Show settings modal if no API key or access token
    if (!tmdbApiKey && !tmdbAccessToken) {
      console.log('No TMDB API key or access token found, showing settings modal');
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) settingsModal.showModal();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Add a series to the list
function addSeries(series) {
  try {
    console.log('Adding series:', series);
    
    // Ensure the series has an ID
    if (!series.id) {
      series.id = Date.now().toString();
    }
    
    // Add to list
    seriesList.push(series);
    
    // Save to local storage
    saveSeriesList();
    
    return seriesList.length - 1;
  } catch (error) {
    console.error('Error adding series:', error);
    return -1;
  }
}

// Delete a series by index
function deleteSeries(index) {
  try {
    console.log(`Deleting series at index ${index}`);
    
    if (index >= 0 && index < seriesList.length) {
      // Remove from list
      seriesList.splice(index, 1);
      
      // Save to local storage
      saveSeriesList();
      
      // Render series table
      renderSeriesTable();
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting series:', error);
    return false;
  }
}

// Render series table
function renderSeriesTable() {
  try {
    console.log('Rendering series table...');
    
    const tableBody = document.getElementById('series-table-body');
    if (!tableBody) {
      console.error('Series table body not found');
      return;
    }
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    // Check if we have any series
    if (!seriesList || seriesList.length === 0) {
      console.log('No series to display, showing empty state');
      
      // Show empty state
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-8">
            <div class="flex flex-col items-center justify-center">
              <i class="fas fa-tv text-4xl mb-4 text-gray-400"></i>
              <p class="text-lg font-medium text-gray-600">No series added yet</p>
              <p class="text-sm text-gray-500 mt-1">Click the "Add Series" button to get started</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    // Render each series
    seriesList.forEach((series, index) => {
      console.log(`Rendering series ${index}:`, series);
      
      // Get directory name
      const path = require('path');
      const directoryName = path.basename(series.directory);
      
      // Create row
      const row = document.createElement('tr');
      row.className = 'series-row';
      row.dataset.seriesIndex = index;
      row.dataset.expanded = 'false';
      
      row.innerHTML = `
        <td class="px-3 py-2">
          <div class="flex items-center">
            <button class="expand-button mr-2" aria-label="Expand series">
              <i class="fas fa-chevron-right text-gray-600"></i>
            </button>
            <span class="font-medium">${series.title || directoryName}</span>
          </div>
        </td>
        <td class="px-3 py-2">${directoryName}</td>
        <td class="px-3 py-2">${series.tmdbId || 'N/A'}</td>
        <td class="px-3 py-2">
          <span class="badge badge-primary">Ready</span>
        </td>
        <td class="px-3 py-2 text-right">
          <div class="flex justify-end space-x-2">
            <button class="btn btn-sm btn-circle analyze-series" title="Analyze Series" data-series-index="${index}">
              <i class="fas fa-play"></i>
            </button>
            <button class="btn btn-sm btn-circle view-series" title="View Details" data-series-index="${index}">
              <i class="fas fa-info"></i>
            </button>
            <button class="btn btn-sm btn-circle edit-series" title="Edit Series" data-series-index="${index}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-circle delete-series" title="Delete Series" data-series-index="${index}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      
      // Add to table
      tableBody.appendChild(row);
      
      // Add event listener for expansion
      const expandButton = row.querySelector('.expand-button');
      if (expandButton) {
        expandButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleSeriesExpansion(row, index);
        });
      }
      
      // Add event listener for row click (also expands)
      row.addEventListener('click', async () => {
        await toggleSeriesExpansion(row, index);
      });
      
      // Add event listener for delete button
      const deleteButton = row.querySelector('.delete-series');
      if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(deleteButton.dataset.seriesIndex, 10);
          
          if (confirm(`Are you sure you want to delete "${series.title}"? This will not delete any files on disk.`)) {
            deleteSeries(index);
          }
        });
      }
      
      // Add event listeners for other action buttons
      const analyzeButton = row.querySelector('.analyze-series');
      if (analyzeButton) {
        analyzeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          alert(`Analyze functionality not implemented in this simplified version`);
        });
      }
      
      const viewButton = row.querySelector('.view-series');
      if (viewButton) {
        viewButton.addEventListener('click', (e) => {
          e.stopPropagation();
          alert(`View details functionality not implemented in this simplified version`);
        });
      }
      
      const editButton = row.querySelector('.edit-series');
      if (editButton) {
        editButton.addEventListener('click', (e) => {
          e.stopPropagation();
          alert(`Edit functionality not implemented in this simplified version`);
        });
      }
    });
    
    console.log('Series table rendered successfully');
  } catch (error) {
    console.error('Error rendering series table:', error);
  }
}

// Toggle series expansion to show contents
async function toggleSeriesExpansion(row, seriesIndex) {
  try {
    console.log(`Toggling expansion for series at index ${seriesIndex}`);
    
    // Get the series
    const series = seriesList[seriesIndex];
    if (!series) {
      console.error(`Series not found at index ${seriesIndex}`);
      return;
    }
    
    // Check if already expanded
    const isExpanded = row.dataset.expanded === 'true';
    const expandButton = row.querySelector('.expand-button i');
    
    if (isExpanded) {
      // Collapse the row
      console.log('Collapsing row');
      expandButton.className = 'fas fa-chevron-right text-gray-600';
      
      // Remove all child rows
      const childRows = document.querySelectorAll(`[data-parent-index="${seriesIndex}"]`);
      childRows.forEach(childRow => childRow.remove());
      
      row.dataset.expanded = 'false';
    } else {
      // Expand the row
      console.log('Expanding row');
      expandButton.className = 'fas fa-chevron-down text-gray-600';
      row.dataset.expanded = 'true';
      
      try {
        // Add spinner to indicate loading
        expandButton.className = 'fas fa-spinner fa-spin text-gray-600';
        
        // Use the original expandDirectory function with require statements
        await expandDirectoryOriginal(row, series.directory, 0, seriesIndex);
        
        // Update icon to expanded state
        expandButton.className = 'fas fa-chevron-down text-gray-600';
      } catch (error) {
        console.error('Error expanding directory:', error);
        expandButton.className = 'fas fa-exclamation-circle text-red-600';
        row.dataset.expanded = 'false';
      }
    }
  } catch (error) {
    console.error('Error toggling series expansion:', error);
  }
}

// This is the original expandDirectory function from renderer.js
async function expandDirectoryOriginal(parentRow, directoryPath, level, parentIndex) {
  try {
    console.log(`Expanding directory ${directoryPath} at level ${level} with parent index ${parentIndex}`);
    
    // Don't go too deep
    if (level > 4) {
      console.warn('Maximum directory depth reached');
      return;
    }
    
    // Use Node.js modules to scan the directory
    const fs = require('fs');
    const path = require('path');
    const util = require('util');
    
    const readdir = util.promisify(fs.readdir);
    const stat = util.promisify(fs.stat);
    
    console.log(`Reading directory: ${directoryPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      console.error(`Directory does not exist: ${directoryPath}`);
      return;
    }
    
    // Scan the directory
    const dirItems = await readdir(directoryPath);
    console.log(`Found ${dirItems.length} items in directory`);
    
    // Get stats for all items
    const itemsWithStats = await Promise.all(
      dirItems.map(async (item) => {
        const itemPath = path.join(directoryPath, item);
        try {
          const itemStat = await stat(itemPath);
          return {
            name: item,
            path: itemPath,
            isDirectory: itemStat.isDirectory(),
            isVideo: !itemStat.isDirectory() && isVideoFile(itemPath),
            size: itemStat.size,
            mtime: itemStat.mtime
          };
        } catch (error) {
          console.error(`Error getting stats for ${itemPath}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null items and filter to only directories and video files
    const filteredItems = itemsWithStats
      .filter(item => item !== null)
      .filter(item => item.isDirectory || item.isVideo);
    
    console.log(`Filtered to ${filteredItems.length} directories and video files`);
    
    // Sort: directories first, then files alphabetically
    const sortedItems = filteredItems.sort((a, b) => {
      // Directories first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      // Alphabetical sorting
      return a.name.localeCompare(b.name);
    });
    
    // Add each item as a row in the table
    for (const item of sortedItems) {
      const itemRow = document.createElement('tr');
      itemRow.classList.add('expanded-row');
      
      // Set data attributes
      itemRow.dataset.parentIndex = parentIndex;
      itemRow.dataset.level = level.toString();
      
      // Set the item's own path
      itemRow.dataset.path = item.path;
      
      // For nested items (beyond level 0), make sure to set the parent path
      if (level > 0) {
        itemRow.dataset.parentPath = directoryPath;
      }
      
      // Indentation level
      const indentation = level * 20; // 20px per level
      
      if (item.isDirectory) {
        // It's a directory
        itemRow.dataset.expanded = 'false';
        itemRow.classList.add('directory-row');
        
        // Create directory row
        itemRow.innerHTML = `
          <td colspan="5" class="px-3 py-2">
            <div class="flex items-center" style="padding-left: ${indentation}px;">
              <button class="expand-button mr-2" aria-label="Expand directory">
                <i class="fas fa-chevron-right text-gray-400"></i>
              </button>
              <i class="fas fa-folder text-yellow-500 mr-2"></i>
              <span>${item.name}</span>
            </div>
          </td>
        `;
        
        // Add event listener for subdirectory expansion
        const expandButton = itemRow.querySelector('.expand-button');
        if (expandButton) {
          expandButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // Toggle expansion
            const isExpanded = itemRow.dataset.expanded === 'true';
            const icon = expandButton.querySelector('i');
            
            if (isExpanded) {
              // Collapse
              icon.className = 'fas fa-chevron-right text-gray-400';
              
              // Remove child rows
              const childSelector = `[data-parent-path="${item.path}"]`;
              const childRows = document.querySelectorAll(childSelector);
              childRows.forEach(child => child.remove());
              
              itemRow.dataset.expanded = 'false';
            } else {
              // Expand
              icon.className = 'fas fa-spinner fa-spin text-gray-400';
              itemRow.dataset.expanded = 'true';
              
              try {
                // Expand this subdirectory
                await expandDirectoryOriginal(itemRow, item.path, level + 1, parentIndex);
                icon.className = 'fas fa-chevron-down text-gray-400';
              } catch (error) {
                console.error(`Error expanding subdirectory ${item.path}:`, error);
                icon.className = 'fas fa-exclamation-circle text-red-500';
                itemRow.dataset.expanded = 'false';
              }
            }
          });
          
          // Also add click handler to the entire row
          itemRow.addEventListener('click', async () => {
            expandButton.click();
          });
        }
      } else if (item.isVideo) {
        // It's a video file
        itemRow.classList.add('file-row');
        
        // Extract season and episode info
        const seasonEpisode = extractSeasonEpisode(item.name);
        const seasonEpisodeText = seasonEpisode 
          ? `<span class="badge badge-info ml-2">S${seasonEpisode.season.toString().padStart(2, '0')}E${seasonEpisode.episode.toString().padStart(2, '0')}</span>` 
          : '';
        
        // Create video file row
        itemRow.innerHTML = `
          <td colspan="5" class="px-3 py-2">
            <div class="flex items-center" style="padding-left: ${indentation + 20}px;">
              <i class="fas fa-file-video text-blue-500 mr-2"></i>
              <span class="flex-1 truncate-text">${item.name}</span>
              ${seasonEpisodeText}
              <span class="status-cell ml-2">Pending</span>
            </div>
          </td>
        `;
      }
      
      // Add to table after parent or last child
      if (level > 0) {
        // For nested items, find the last child of the parent with the same path
        const lastChild = findLastChildWithSameParent(parentRow, directoryPath);
        if (lastChild) {
          lastChild.after(itemRow);
        } else {
          parentRow.after(itemRow);
        }
      } else {
        // For top-level items, find the last item with the same parent index
        const lastChild = getLastChildRow(parentRow, parentIndex.toString());
        if (lastChild) {
          lastChild.after(itemRow);
        } else {
          parentRow.after(itemRow);
        }
      }
    }
  } catch (error) {
    console.error(`Error in expandDirectoryOriginal for ${directoryPath}:`, error);
  }
}

// Find the last child row that has the same parent path
function findLastChildWithSameParent(parentRow, parentPath) {
  try {
    let lastChild = null;
    let currentRow = parentRow.nextElementSibling;
    
    while (currentRow) {
      if (currentRow.dataset.parentPath === parentPath) {
        lastChild = currentRow;
      } else if (currentRow.dataset.level <= parentRow.dataset.level) {
        // Stop when we reach a row of the same or lower level than the parent
        break;
      }
      
      currentRow = currentRow.nextElementSibling;
    }
    
    return lastChild;
  } catch (error) {
    console.error('Error finding last child with same parent:', error);
    return null;
  }
}

// Function to check if a file is a video file
function isVideoFile(filePath) {
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.mpg', '.mpeg', '.flv', '.webm', '.ts', '.m2ts'];
  const extension = require('path').extname(filePath).toLowerCase();
  return videoExtensions.includes(extension);
}

// Get the last child row of a parent row
function getLastChildRow(parentRow, parentIndex) {
  try {
    let lastChild = null;
    let currentRow = parentRow.nextElementSibling;
    
    while (currentRow) {
      if (currentRow.dataset.parentIndex === parentIndex) {
        lastChild = currentRow;
      } else if (!currentRow.dataset.parentIndex) {
        break;
      }
      
      currentRow = currentRow.nextElementSibling;
    }
    
    return lastChild;
  } catch (error) {
    console.error('Error getting last child row:', error);
    return null;
  }
}

// Extract season and episode from filename
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