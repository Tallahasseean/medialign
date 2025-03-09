// Simple app.js - Direct replacement for renderer.js
// This is a simplified version to ensure basic functionality works

// Store all series
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
    // Set up event listeners
    setupEventListeners();
    
    // Load settings
    loadSettings();
    
    // Load series list
    await loadSeriesList();
    
    // Render series list
    renderSeriesTable();
    
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
      const pathParts = series.directory.split('/');
      const directoryName = pathParts[pathParts.length - 1];
      
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

// Toggle series expansion to show files and directories
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
        
        // Get directory structure
        await expandDirectory(row, series.directory, 0, seriesIndex);
        
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

// Expand a directory and show its contents
async function expandDirectory(parentRow, directoryPath, level, parentIndex) {
  try {
    console.log(`Expanding directory: ${directoryPath} (level ${level})`);
    
    // Don't go too deep
    if (level > 4) {
      console.warn('Maximum directory depth reached');
      return;
    }
    
    // Use Node.js modules via IPC to get directory contents
    const dirContents = await getDirectoryContents(directoryPath);
    
    if (!dirContents || dirContents.length === 0) {
      console.log('No contents found in directory');
      return;
    }
    
    // Sort contents: directories first, then files
    dirContents.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log(`Sorted ${dirContents.length} items:`, dirContents);
    
    // Get the series
    const series = seriesList[parentIndex];
    
    // Create rows for each item
    for (const item of dirContents) {
      let row;
      
      if (item.type === 'directory') {
        row = createDirectoryRow(item, series, parentRow, level, parentIndex);
      } else {
        row = createFileRow(item, dirContents.indexOf(item), series, parentRow, level, parentIndex);
      }
      
      // Insert after parent or after the last child of parent
      const lastChild = getLastChildRow(parentRow, parentIndex);
      if (lastChild) {
        lastChild.after(row);
      } else {
        parentRow.after(row);
      }
    }
  } catch (error) {
    console.error('Error expanding directory:', error);
  }
}

// Get directory contents from the file system
async function getDirectoryContents(directoryPath) {
  try {
    console.log(`Getting contents of directory: ${directoryPath}`);
    
    // Use IPC to get directory contents from the main process
    if (window.electronAPI && window.electronAPI.getDirectoryContents) {
      console.log('Using IPC to get directory contents');
      const contents = await window.electronAPI.getDirectoryContents(directoryPath);
      console.log(`Got ${contents.length} items from directory:`, contents);
      
      // Filter to only include directories and video files
      const filteredContents = contents.filter(item => 
        item.type === 'directory' || isVideo(item.name)
      );
      
      console.log(`Filtered to ${filteredContents.length} directories and video files`);
      return filteredContents;
    }
    
    // Fallback to simulated data if IPC method is not available
    console.warn('getDirectoryContents IPC method not available, using simulated data');
    return simulateGetDirectoryContents(directoryPath);
  } catch (error) {
    console.error('Error getting directory contents:', error);
    // Fallback to simulated data on error
    return simulateGetDirectoryContents(directoryPath);
  }
}

// Simulate getting directory contents (fallback)
async function simulateGetDirectoryContents(directoryPath) {
  console.log('Using simulated directory contents');
  
  // In a real app, this would use IPC to get directory contents
  return new Promise(resolve => {
    setTimeout(() => {
      // Extract the directory name to create more realistic simulated data
      const dirName = directoryPath.split('/').pop();
      
      // Create different simulated content based on the directory name
      let items = [];
      
      if (dirName.toLowerCase().includes('season')) {
        // If it's a season directory, create episode files
        const seasonMatch = dirName.match(/\d+/);
        const seasonNum = seasonMatch ? parseInt(seasonMatch[0], 10) : 1;
        
        // Create 5 episodes for this season
        for (let i = 1; i <= 5; i++) {
          items.push({
            type: 'file',
            name: `S${seasonNum.toString().padStart(2, '0')}E${i.toString().padStart(2, '0')} - Episode ${i}.mkv`,
            path: `${directoryPath}/S${seasonNum.toString().padStart(2, '0')}E${i.toString().padStart(2, '0')} - Episode ${i}.mkv`
          });
        }
      } else {
        // If it's the main series directory, create season folders
        for (let i = 1; i <= 3; i++) {
          items.push({
            type: 'directory',
            name: `Season ${i}`,
            path: `${directoryPath}/Season ${i}`
          });
        }
        
        // Add a few loose files in the main directory
        items.push({
          type: 'file',
          name: 'info.txt',
          path: `${directoryPath}/info.txt`
        });
      }
      
      resolve(items);
    }, 500);
  });
}

// Create a directory row
function createDirectoryRow(dir, series, parentRow, level, parentIndex) {
  try {
    console.log(`Creating directory row for: ${dir.path}`);
    
    const row = document.createElement('tr');
    row.className = 'directory-row';
    row.dataset.parentIndex = parentIndex;
    row.dataset.expanded = 'false';
    row.dataset.level = level;
    row.dataset.path = dir.path;
    
    // Get directory name
    const pathParts = dir.path.split('/');
    const directoryName = pathParts[pathParts.length - 1];
    
    // Calculate indent
    const indentPadding = 20 * level; // 20px per level
    
    row.innerHTML = `
      <td colspan="5" class="px-3 py-2">
        <div class="flex items-center" style="padding-left: ${indentPadding}px;">
          <button class="expand-button mr-2" aria-label="Expand directory">
            <i class="fas fa-chevron-right text-gray-400"></i>
          </button>
          <i class="fas fa-folder text-yellow-500 mr-2"></i>
          <span>${directoryName}</span>
        </div>
      </td>
    `;
    
    // Add event listener for expansion
    const expandButton = row.querySelector('.expand-button');
    if (expandButton) {
      expandButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleSubdirectoryExpansion(row, parentIndex);
      });
    }
    
    // Add click event for the entire row
    row.addEventListener('click', async () => {
      await toggleSubdirectoryExpansion(row, parentIndex);
    });
    
    return row;
  } catch (error) {
    console.error('Error creating directory row:', error);
    // Return a basic row as fallback
    const fallbackRow = document.createElement('tr');
    fallbackRow.innerHTML = `<td colspan="5">Error creating directory row</td>`;
    return fallbackRow;
  }
}

// Create a file row
function createFileRow(file, fileIndex, series, parentRow, level, parentIndex) {
  try {
    console.log(`Creating file row for: ${file.path}`);
    
    const row = document.createElement('tr');
    row.className = 'file-row';
    row.dataset.parentIndex = parentIndex;
    row.dataset.level = level;
    row.dataset.path = file.path;
    row.dataset.fileIndex = fileIndex;
    
    // Get file name
    const pathParts = file.path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Calculate indent
    const indentPadding = 20 * level + 20; // 20px per level + 20px extra for files
    
    // Check if it's a video file
    const isVideoFile = isVideo(fileName);
    
    // Extract season and episode from filename if it's a video
    let seasonEpisodeText = '';
    if (isVideoFile) {
      const seasonEpisode = extractSeasonEpisode(fileName);
      seasonEpisodeText = seasonEpisode 
        ? `<span class="badge badge-info ml-2">S${seasonEpisode.season.toString().padStart(2, '0')}E${seasonEpisode.episode.toString().padStart(2, '0')}</span>` 
        : '';
    }
    
    // Choose appropriate icon based on file type
    let fileIcon = 'fa-file text-gray-500';
    if (isVideoFile) {
      fileIcon = 'fa-file-video text-blue-500';
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.nfo')) {
      fileIcon = 'fa-file-alt text-gray-500';
    } else if (fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg')) {
      fileIcon = 'fa-file-image text-green-500';
    } else if (fileName.endsWith('.srt') || fileName.endsWith('.sub') || fileName.endsWith('.idx')) {
      fileIcon = 'fa-closed-captioning text-purple-500';
    }
    
    row.innerHTML = `
      <td colspan="5" class="px-3 py-2">
        <div class="flex items-center" style="padding-left: ${indentPadding}px;">
          <i class="fas ${fileIcon} mr-2"></i>
          <span class="flex-1 truncate-text">${fileName}</span>
          ${seasonEpisodeText}
          ${isVideoFile ? '<span class="status-cell ml-2">Pending</span>' : ''}
        </div>
      </td>
    `;
    
    return row;
  } catch (error) {
    console.error('Error creating file row:', error);
    // Return a basic row as fallback
    const fallbackRow = document.createElement('tr');
    fallbackRow.innerHTML = `<td colspan="5">Error creating file row</td>`;
    return fallbackRow;
  }
}

// Check if a file is a video file
function isVideo(fileName) {
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.mpg', '.mpeg', '.flv', '.webm'];
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  return videoExtensions.includes(extension);
}

// Toggle subdirectory expansion
async function toggleSubdirectoryExpansion(row, parentIndex) {
  try {
    console.log(`Toggling subdirectory expansion for: ${row.dataset.path}`);
    
    const isExpanded = row.dataset.expanded === 'true';
    const expandButton = row.querySelector('.expand-button i');
    
    if (isExpanded) {
      // Collapse the row
      expandButton.className = 'fas fa-chevron-right text-gray-400';
      
      // Remove all child rows
      const childRows = document.querySelectorAll(`[data-parent-path="${row.dataset.path}"]`);
      childRows.forEach(childRow => childRow.remove());
      
      row.dataset.expanded = 'false';
    } else {
      // Expand the row
      expandButton.className = 'fas fa-chevron-down text-gray-400';
      row.dataset.expanded = 'true';
      
      try {
        // Add spinner to indicate loading
        expandButton.className = 'fas fa-spinner fa-spin text-gray-400';
        
        // Get directory structure
        await expandDirectory(row, row.dataset.path, parseInt(row.dataset.level, 10) + 1, parentIndex);
        
        // Update icon to expanded state
        expandButton.className = 'fas fa-chevron-down text-gray-400';
      } catch (error) {
        console.error('Error expanding directory:', error);
        expandButton.className = 'fas fa-exclamation-circle text-red-600';
        row.dataset.expanded = 'false';
      }
    }
  } catch (error) {
    console.error('Error toggling subdirectory expansion:', error);
  }
}

// Get the last child row of a parent row
function getLastChildRow(parentRow, parentIndex) {
  try {
    console.log(`Getting last child row for parent index: ${parentIndex}`);
    
    let lastChild = null;
    let currentRow = parentRow.nextElementSibling;
    
    while (currentRow) {
      if (currentRow.dataset.parentIndex === parentIndex.toString()) {
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