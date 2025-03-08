// Add this at the beginning of the file
const { ipcRenderer } = require('electron');
const path = require('path');

console.log('Renderer script loaded');
console.log('electronAPI available:', !!window.electronAPI);

// DOM Elements - Main UI
const addSeriesButton = document.getElementById('add-series-button');
const seriesTableBody = document.getElementById('series-table-body');
const seriesDetails = document.getElementById('series-details');

// DOM Elements - Settings
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const tmdbApiKeyInput = document.getElementById('tmdb-api-key');
const tmdbAccessTokenInput = document.getElementById('tmdb-access-token');
const cancelSettingsButton = document.getElementById('cancel-settings');
const saveSettingsButton = document.getElementById('save-settings');

// DOM Elements - Add Series Modal
const addSeriesModal = document.getElementById('add-series-modal');
const newSeriesDirectory = document.getElementById('new-series-directory');
const newSeriesTitle = document.getElementById('new-series-title');
const newBrowseButton = document.getElementById('new-browse-button');
const newLookupButton = document.getElementById('new-lookup-button');
const newTmdbId = document.getElementById('new-tmdb-id');
const newTmdbResults = document.getElementById('new-tmdb-results');
const newResultsList = document.getElementById('new-results-list');
const cancelAddSeries = document.getElementById('cancel-add-series');
const confirmAddSeries = document.getElementById('confirm-add-series');

// DOM Elements - Series Details
const seriesDirectoryInput = document.getElementById('series-directory');
const seriesTitleInput = document.getElementById('series-title');
const browseButton = document.getElementById('browse-button');
const lookupButton = document.getElementById('lookup-button');
const tmdbIdInput = document.getElementById('tmdb-id');
const tmdbResults = document.getElementById('tmdb-results');
const resultsList = document.getElementById('results-list');
const analyzeButton = document.getElementById('analyze-button');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const resultsTable = document.getElementById('results-table');
const resultsBody = document.getElementById('results-body');

// Current series ID (set after analysis)
let currentSeriesId = null;
// Store all series
let seriesList = [];

// Initialize the application
function init() {
  // Load series from local storage
  loadSeriesList();
  // Load settings
  loadSettings();
  // Render the series table
  renderSeriesTable();
  // Set up IPC listeners
  setupIpcListeners();
}

// Set up IPC listeners
function setupIpcListeners() {
  // Directory selection response
  ipcRenderer.on('directory-selected', (event, result) => {
    console.log('Directory selected:', result);
    
    // Check if we're in the add series modal or the series details
    if (addSeriesModal.open) {
      if (result && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      } else if (result) {
        newSeriesDirectory.value = result;
        // Extract title from directory path
        newSeriesTitle.value = extractTitleFromPath(result);
      }
    } else {
      if (result && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      } else if (result) {
        seriesDirectoryInput.value = result;
        // Extract title from directory path
        seriesTitleInput.value = extractTitleFromPath(result);
        
        // Update the current series
        if (currentSeriesId !== null) {
          seriesList[currentSeriesId].directory = result;
          saveSeriesList();
          renderSeriesTable();
        }
      }
    }
  });
  
  // TMDB search response
  ipcRenderer.on('tmdb-search-result', (event, result) => {
    console.log('TMDB search result:', result);
    
    if (result && result.error) {
      console.error('Error searching TMDB:', result.error);
      alert(`Error searching TMDB: ${result.error}`);
      return;
    }
    
    // Check which search results to display
    if (addSeriesModal.open) {
      // Display in Add Series modal
      displaySearchResults(result, newResultsList, newTmdbResults, newTmdbId);
    } else {
      // Display in Series Details
      displaySearchResults(result, resultsList, tmdbResults, tmdbIdInput);
    }
  });
  
  // Analyze series response
  ipcRenderer.on('analyze-series-result', (event, result) => {
    console.log('Analyze series result:', result);
    
    if (result && result.error) {
      console.error('Error analyzing series:', result.error);
      progressStatus.textContent = `Error: ${result.error}`;
      progressBar.value = 100;
      progressBar.classList.remove('progress-primary');
      progressBar.classList.add('progress-error');
      
      // If error is related to API key, show a message to set up the TMDB API key
      if (result.error.includes('API key') || result.error.includes('authentication')) {
        progressStatus.textContent = `Error: Invalid or missing TMDB API key. Please check your settings.`;
        setTimeout(() => {
          settingsModal.showModal();
        }, 1500);
      }
      
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'error';
        saveSeriesList();
        renderSeriesTable();
      }
    } else {
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'analyzed';
        saveSeriesList();
        renderSeriesTable();
      }
      
      // Display the results
      displayResults(result.files);
    }
  });
}

// Extract title from directory path (last directory name)
function extractTitleFromPath(dirPath) {
  // Remove trailing slashes
  const cleanPath = dirPath.replace(/[\/\\]+$/, '');
  // Split by slashes (handle both forward and backslashes)
  const parts = cleanPath.split(/[\/\\]/);
  // Get last part
  const lastPart = parts[parts.length - 1];
  // Replace underscores and dots with spaces, and capitalize words
  return lastPart
    .replace(/[_\.]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

// Display TMDB search results
function displaySearchResults(results, resultsListElement, resultsContainer, tmdbIdInput) {
  // Clear previous results
  resultsListElement.innerHTML = '';
  
  if (!results || !results.length) {
    // No results
    const noResults = document.createElement('li');
    noResults.textContent = 'No results found';
    noResults.className = 'text-error p-2';
    resultsListElement.appendChild(noResults);
  } else {
    // Add each result
    results.forEach(result => {
      const li = document.createElement('li');
      
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'flex items-start gap-3 p-2 hover:bg-base-300 rounded';
      
      // Add poster image if available
      if (result.poster) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'flex-none w-12';
        
        const img = document.createElement('img');
        img.src = result.poster;
        img.alt = result.title;
        img.className = 'rounded';
        
        imgContainer.appendChild(img);
        link.appendChild(imgContainer);
      }
      
      // Content container
      const contentDiv = document.createElement('div');
      contentDiv.className = 'flex-1';
      
      // Title container
      const titleContainer = document.createElement('div');
      titleContainer.className = 'flex justify-between items-start';
      
      // Title and year
      const titleDiv = document.createElement('div');
      titleDiv.className = 'pr-2';
      
      const title = document.createElement('span');
      title.textContent = result.title;
      title.className = 'font-medium';
      
      const year = document.createElement('span');
      year.textContent = result.year ? ` (${result.year})` : '';
      year.className = 'text-sm opacity-70';
      
      titleDiv.appendChild(title);
      titleDiv.appendChild(year);
      
      // ID badge
      const idBadge = document.createElement('span');
      idBadge.textContent = `ID: ${result.id}`;
      idBadge.className = 'badge badge-sm badge-neutral';
      
      titleContainer.appendChild(titleDiv);
      titleContainer.appendChild(idBadge);
      
      contentDiv.appendChild(titleContainer);
      
      // Add overview if available
      if (result.overview) {
        const overview = document.createElement('p');
        overview.textContent = result.overview.length > 120 ? 
          result.overview.substring(0, 120) + '...' : 
          result.overview;
        overview.className = 'text-xs mt-1 text-base-content opacity-70';
        contentDiv.appendChild(overview);
      }
      
      link.appendChild(contentDiv);
      
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // Set the TMDB ID input
        tmdbIdInput.value = result.id;
        // Hide the results
        resultsContainer.style.display = 'none';
        
        // Trigger a change event on the input to ensure other handlers are aware
        const event = new Event('change', { bubbles: true });
        tmdbIdInput.dispatchEvent(event);
      });
      
      li.appendChild(link);
      resultsListElement.appendChild(li);
    });
  }
  
  // Show the results container
  resultsContainer.style.display = 'block';
}

// Load series list from local storage
function loadSeriesList() {
  const storedSeries = localStorage.getItem('seriesList');
  if (storedSeries) {
    seriesList = JSON.parse(storedSeries);
  }
}

// Save series list to local storage
function saveSeriesList() {
  localStorage.setItem('seriesList', JSON.stringify(seriesList));
}

// Load settings from local storage
function loadSettings() {
  const tmdbApiKey = localStorage.getItem('tmdbApiKey');
  if (tmdbApiKey) {
    tmdbApiKeyInput.value = tmdbApiKey;
  }
  
  const tmdbAccessToken = localStorage.getItem('tmdbAccessToken');
  if (tmdbAccessToken) {
    tmdbAccessTokenInput.value = tmdbAccessToken;
  }
}

// Save settings to local storage
function saveSettings() {
  localStorage.setItem('tmdbApiKey', tmdbApiKeyInput.value);
  localStorage.setItem('tmdbAccessToken', tmdbAccessTokenInput.value);
}

// Get TMDB API key
function getTmdbApiKey() {
  return localStorage.getItem('tmdbApiKey') || '';
}

// Get TMDB Access Token
function getTmdbAccessToken() {
  return localStorage.getItem('tmdbAccessToken') || '';
}

// Search TMDB for TV show
function searchTmdb(title) {
  const apiKey = getTmdbApiKey();
  const accessToken = getTmdbAccessToken();
  
  if (!apiKey && !accessToken) {
    alert('Please set your TMDB API key or Read Access Token in Settings first.');
    settingsModal.showModal();
    return;
  }
  
  if (!title) {
    alert('Please enter a TV show title to search.');
    return;
  }
  
  // Determine which result containers to use based on current context
  let resultsContainer, resultsListElement;
  if (addSeriesModal.open) {
    resultsContainer = newTmdbResults;
    resultsListElement = newResultsList;
  } else {
    resultsContainer = tmdbResults;
    resultsListElement = resultsList;
  }
  
  // Show loading indicator
  resultsContainer.style.display = 'block';
  resultsListElement.innerHTML = '<li class="p-4 text-center"><span class="loading loading-spinner loading-md"></span><p class="mt-2">Searching...</p></li>';
  
  // Send IPC message to search TMDB
  ipcRenderer.send('search-tmdb', {
    title,
    apiKey,
    accessToken
  });
}

// Render the series table
function renderSeriesTable() {
  // Clear the table
  seriesTableBody.innerHTML = '';
  
  // If no series, show the empty message
  if (seriesList.length === 0) {
    seriesTableBody.innerHTML = `
      <tr class="text-center">
        <td colspan="5" class="py-8 text-base-content opacity-60">No TV series added yet. Click "Add TV Series Root Directory" to get started.</td>
      </tr>
    `;
    return;
  }
  
  // Add each series to the table
  seriesList.forEach((series, index) => {
    const row = document.createElement('tr');
    row.dataset.seriesIndex = index;
    row.dataset.isExpanded = 'false';
    row.classList.add('series-row');
    
    // Series Name
    const nameCell = document.createElement('td');
    const dirParts = series.directory.split(/[\/\\]/);
    const dirName = dirParts[dirParts.length - 1] || 'Unknown';
    
    // Add expand/collapse indicator
    const nameContent = document.createElement('div');
    nameContent.className = 'flex items-center gap-2';
    
    const expandIcon = document.createElement('svg');
    expandIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    expandIcon.setAttribute('fill', 'none');
    expandIcon.setAttribute('viewBox', '0 0 24 24');
    expandIcon.setAttribute('stroke-width', '1.5');
    expandIcon.setAttribute('stroke', 'currentColor');
    expandIcon.setAttribute('class', 'w-4 h-4 fixed-size transform transition-transform');
    expandIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />';
    
    nameContent.appendChild(expandIcon);
    
    // Add the series name with truncation
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('truncate-text');
    nameSpan.textContent = series.name || dirName;
    nameContent.appendChild(nameSpan);
    
    nameCell.appendChild(nameContent);
    
    // Directory
    const dirCell = document.createElement('td');
    dirCell.textContent = series.directory;
    dirCell.className = 'text-xs';
    
    // TMDB ID
    const tmdbCell = document.createElement('td');
    tmdbCell.textContent = series.tmdbId || 'Not set';
    
    // Status
    const statusCell = document.createElement('td');
    if (series.status === 'analyzed') {
      statusCell.innerHTML = '<span class="badge badge-success">Analyzed</span>';
    } else if (series.status === 'in-progress') {
      statusCell.innerHTML = '<span class="badge badge-warning">In Progress</span>';
    } else {
      statusCell.innerHTML = '<span class="badge badge-ghost">Not Analyzed</span>';
    }
    
    // Actions
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex space-x-2';
    
    // Analyze button
    const analyzeBtn = document.createElement('button');
    analyzeBtn.className = 'btn btn-xs btn-primary';
    analyzeBtn.textContent = 'Analyze';
    analyzeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSeriesDetails(index);
    });
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-xs btn-ghost';
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 fixed-size">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    `;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editSeries(index);
    });
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-xs btn-ghost text-error';
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 fixed-size">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSeries(index);
    });
    
    actionsDiv.appendChild(analyzeBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    actionsCell.appendChild(actionsDiv);
    
    row.appendChild(nameCell);
    row.appendChild(dirCell);
    row.appendChild(tmdbCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    seriesTableBody.appendChild(row);
    
    // Add click event to expand/collapse the row
    row.addEventListener('click', () => {
      toggleSeriesExpansion(row, series);
    });
  });
}

// Toggle series expansion to show subdirectories and files
async function toggleSeriesExpansion(row, series) {
  const isExpanded = row.dataset.isExpanded === 'true';
  const seriesIndex = parseInt(row.dataset.seriesIndex);
  const expandIcon = row.querySelector('svg');
  
  // Remove any existing expanded content
  const existingExpandedRows = document.querySelectorAll(`tr[data-parent-index="${seriesIndex}"][data-level="1"]`);
  existingExpandedRows.forEach(row => {
    // Also remove any child rows
    const childRows = document.querySelectorAll(`tr[data-parent-path^="${row.dataset.path}"]`);
    childRows.forEach(childRow => childRow.remove());
    row.remove();
  });
  
  if (!isExpanded) {
    // Set to expanded
    row.dataset.isExpanded = 'true';
    expandIcon.classList.add('rotate-90');
    
    try {
      // Show loading indicator
      const loadingRow = document.createElement('tr');
      loadingRow.dataset.parentIndex = seriesIndex;
      loadingRow.dataset.level = '1';
      
      const loadingCell = document.createElement('td');
      loadingCell.colSpan = 5;
      loadingCell.innerHTML = `
        <div class="flex justify-center items-center py-2">
          <span class="loading loading-spinner loading-sm mr-2"></span>
          <span>Loading directory contents...</span>
        </div>
      `;
      
      loadingRow.appendChild(loadingCell);
      row.after(loadingRow);
      
      // Scan the directory
      await expandDirectory(row, series.directory, 1, seriesIndex);
      
      // Remove loading indicator
      loadingRow.remove();
    } catch (error) {
      console.error('Error expanding directory:', error);
      
      // Show error message
      const errorRow = document.createElement('tr');
      errorRow.dataset.parentIndex = seriesIndex;
      errorRow.dataset.level = '1';
      
      const errorCell = document.createElement('td');
      errorCell.colSpan = 5;
      errorCell.innerHTML = `
        <div class="text-error p-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 fixed-size inline-block mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Error loading directory: ${error.message}
        </div>
      `;
      
      errorRow.appendChild(errorCell);
      row.after(errorRow);
    }
  } else {
    // Set to collapsed
    row.dataset.isExpanded = 'false';
    expandIcon.classList.remove('rotate-90');
  }
}

// Toggle subdirectory expansion
async function toggleSubdirectoryExpansion(row) {
  const isExpanded = row.dataset.isExpanded === 'true';
  const currentPath = row.dataset.path;
  const currentLevel = parseInt(row.dataset.level);
  const expandIcon = row.querySelector('.directory-icon');
  
  // Remove any existing expanded content
  const existingExpandedRows = document.querySelectorAll(`tr[data-parent-path="${currentPath}"]`);
  existingExpandedRows.forEach(row => {
    // Also remove any child rows
    const childRows = document.querySelectorAll(`tr[data-parent-path^="${row.dataset.path}"]`);
    childRows.forEach(childRow => childRow.remove());
    row.remove();
  });
  
  if (!isExpanded) {
    // Set to expanded
    row.dataset.isExpanded = 'true';
    expandIcon.classList.add('rotate-90');
    
    try {
      // Show loading indicator
      const loadingRow = document.createElement('tr');
      loadingRow.dataset.parentPath = currentPath;
      loadingRow.dataset.level = (currentLevel + 1).toString();
      
      const loadingCell = document.createElement('td');
      loadingCell.colSpan = 5;
      loadingCell.innerHTML = `
        <div class="flex justify-center items-center py-2">
          <span class="loading loading-spinner loading-sm mr-2"></span>
          <span>Loading directory contents...</span>
        </div>
      `;
      
      loadingRow.appendChild(loadingCell);
      row.after(loadingRow);
      
      // Scan the directory
      await expandDirectory(row, currentPath, currentLevel + 1, row.dataset.parentIndex);
      
      // Remove loading indicator
      loadingRow.remove();
    } catch (error) {
      console.error('Error expanding subdirectory:', error);
      
      // Show error message
      const errorRow = document.createElement('tr');
      errorRow.dataset.parentPath = currentPath;
      errorRow.dataset.level = (currentLevel + 1).toString();
      
      const errorCell = document.createElement('td');
      errorCell.colSpan = 5;
      errorCell.innerHTML = `
        <div class="text-error p-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 fixed-size inline-block mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Error loading subdirectory: ${error.message}
        </div>
      `;
      
      errorRow.appendChild(errorCell);
      row.after(errorRow);
    }
  } else {
    // Set to collapsed
    row.dataset.isExpanded = 'false';
    expandIcon.classList.remove('rotate-90');
  }
}

// Generic function to expand a directory at any level
async function expandDirectory(parentRow, directoryPath, level, parentIndex) {
  try {
    // Don't go too deep
    if (level > 4) {
      console.warn('Maximum directory depth reached');
      return;
    }
    
    // Get the next row after parent row
    let nextRow = parentRow.nextElementSibling;
    
    // Use file-scanner.js functionality to scan the directory
    const fs = require('fs');
    const path = require('path');
    const util = require('util');
    const { isVideoFile } = require('./file-scanner');
    
    const readdir = util.promisify(fs.readdir);
    const stat = util.promisify(fs.stat);
    
    // Scan the directory
    const dirItems = await readdir(directoryPath);
    
    // Get stats for all items
    const itemsWithStats = await Promise.all(
      dirItems.map(async (item) => {
        const itemPath = path.join(directoryPath, item);
        const itemStat = await stat(itemPath);
        return {
          name: item,
          path: itemPath,
          isDirectory: itemStat.isDirectory(),
          isVideo: !itemStat.isDirectory() && isVideoFile(itemPath),
          size: itemStat.size,
          mtime: itemStat.mtime
        };
      })
    );
    
    // Filter and sort: directories first, then video files
    const sortedItems = itemsWithStats
      .filter(item => item.isDirectory || item.isVideo)
      .sort((a, b) => {
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
      if (level === 1) {
        // First level items are children of the series
        itemRow.dataset.parentIndex = parentIndex;
        itemRow.dataset.level = level.toString();
      } else {
        // Deeper level items are children of a directory
        itemRow.dataset.parentPath = directoryPath;
        itemRow.dataset.level = level.toString();
        itemRow.dataset.parentIndex = parentIndex;
      }
      
      // Set the item's own path
      itemRow.dataset.path = item.path;
      
      // If it's a directory, add expandable state
      if (item.isDirectory) {
        itemRow.dataset.isExpanded = 'false';
        itemRow.classList.add('directory-row');
      }
      
      // Indented name with icon
      const nameCell = document.createElement('td');
      const nameContent = document.createElement('div');
      nameContent.className = 'flex items-center gap-2';
      
      // Calculate padding based on level
      const padding = 12 * level;
      nameContent.style.paddingLeft = `${padding}px`;
      
      // Icon based on type
      if (item.isDirectory) {
        nameContent.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 fixed-size text-primary transform transition-transform directory-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 fixed-size text-primary ml-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        `;
      } else {
        nameContent.innerHTML = `
          <span class="w-4 fixed-size"></span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 fixed-size text-secondary ml-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
          </svg>
        `;
      }
      
      // Add the filename with truncation
      const textSpan = document.createElement('span');
      textSpan.classList.add('truncate-text');
      textSpan.textContent = item.name;
      nameContent.appendChild(textSpan);
      
      nameCell.appendChild(nameContent);
      
      // Path
      const pathCell = document.createElement('td');
      pathCell.textContent = item.path;
      pathCell.className = 'text-xs';
      
      // Empty TMDB ID cell
      const tmdbCell = document.createElement('td');
      tmdbCell.textContent = '-';
      
      // Type/Info
      const typeCell = document.createElement('td');
      if (item.isDirectory) {
        typeCell.innerHTML = '<span class="badge badge-primary">Directory</span>';
      } else {
        // Format file size
        const sizeInMB = (item.size / (1024 * 1024)).toFixed(2);
        typeCell.innerHTML = `<span class="badge badge-secondary">Video (${sizeInMB} MB)</span>`;
      }
      
      // Actions cell (empty for now, could add actions later)
      const actionsCell = document.createElement('td');
      
      itemRow.appendChild(nameCell);
      itemRow.appendChild(pathCell);
      itemRow.appendChild(tmdbCell);
      itemRow.appendChild(typeCell);
      itemRow.appendChild(actionsCell);
      
      nextRow = nextRow ? nextRow.after(itemRow) : parentRow.after(itemRow);
      nextRow = itemRow;
      
      // Add click event for directories to make them expandable
      if (item.isDirectory) {
        itemRow.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleSubdirectoryExpansion(itemRow);
        });
      }
    }
    
    // If no items found
    if (sortedItems.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.classList.add('expanded-row');
      
      if (level === 1) {
        emptyRow.dataset.parentIndex = parentIndex;
        emptyRow.dataset.level = level.toString();
      } else {
        emptyRow.dataset.parentPath = directoryPath;
        emptyRow.dataset.level = level.toString();
        emptyRow.dataset.parentIndex = parentIndex;
      }
      
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5;
      
      // Add appropriate indentation
      const padding = 12 * level;
      
      emptyCell.innerHTML = `
        <div class="text-center py-2 text-base-content opacity-60" style="padding-left: ${padding}px">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 fixed-size inline-block mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
          No subdirectories or video files found in this directory
        </div>
      `;
      
      emptyRow.appendChild(emptyCell);
      nextRow = nextRow ? nextRow.after(emptyRow) : parentRow.after(emptyRow);
    }
  } catch (error) {
    console.error('Error expanding directory:', error);
    throw error;
  }
}

// Show series details for analysis
function showSeriesDetails(index) {
  const series = seriesList[index];
  currentSeriesId = index;
  
  // Set the form values
  seriesDirectoryInput.value = series.directory;
  seriesTitleInput.value = series.name || extractTitleFromPath(series.directory);
  tmdbIdInput.value = series.tmdbId || '';
  
  // Hide any previous results
  tmdbResults.style.display = 'none';
  
  // Show the series details section
  seriesDetails.style.display = 'grid';
  
  // Scroll to the series details
  seriesDetails.scrollIntoView({ behavior: 'smooth' });
}

// Edit a series
function editSeries(index) {
  const series = seriesList[index];
  
  // Set the modal values
  newSeriesDirectory.value = series.directory;
  newSeriesTitle.value = series.name || extractTitleFromPath(series.directory);
  newTmdbId.value = series.tmdbId || '';
  
  // Store the index for later use
  newSeriesDirectory.dataset.editIndex = index;
  
  // Change the confirm button text to indicate editing
  confirmAddSeries.textContent = 'Update Series';
  
  // Show the modal
  addSeriesModal.showModal();
}

// Delete a series
function deleteSeries(index) {
  if (confirm('Are you sure you want to delete this series?')) {
    seriesList.splice(index, 1);
    saveSeriesList();
    renderSeriesTable();
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the application
  init();
  
  // Add Series button
  addSeriesButton.addEventListener('click', () => {
    // Clear the form
    newSeriesDirectory.value = '';
    newSeriesTitle.value = '';
    newTmdbId.value = '';
    newTmdbResults.style.display = 'none';
    delete newSeriesDirectory.dataset.editIndex;
    
    // Reset the confirm button text to indicate adding
    confirmAddSeries.textContent = 'Add Series';
    
    // Show the modal
    addSeriesModal.showModal();
  });
  
  // Settings button
  settingsButton.addEventListener('click', () => {
    settingsModal.showModal();
  });
  
  // Cancel Settings button
  cancelSettingsButton.addEventListener('click', () => {
    settingsModal.close();
  });
  
  // Save Settings button
  saveSettingsButton.addEventListener('click', async () => {
    const apiKey = tmdbApiKeyInput.value.trim();
    const accessToken = tmdbAccessTokenInput.value.trim();
    
    // At least one credential must be provided
    if (!apiKey && !accessToken) {
      alert('Please provide either a TMDB API key or a Read Access Token.');
      return;
    }
    
    // Show loading state
    saveSettingsButton.disabled = true;
    saveSettingsButton.innerHTML = '<span class="loading loading-spinner loading-xs mr-2"></span> Validating...';
    
    try {
      // Validate the credentials with TMDB
      const response = await ipcRenderer.invoke('validate-tmdb-credentials', { apiKey, accessToken });
      
      if (response.valid) {
        // Save valid credentials to localStorage
        saveSettings();
        settingsModal.close();
        alert('TMDB API credentials validated and saved successfully!');
      } else {
        alert(`TMDB API validation failed: ${response.error}`);
      }
    } catch (error) {
      alert(`Error validating TMDB credentials: ${error.message || 'Unknown error'}`);
    } finally {
      // Reset button state
      saveSettingsButton.disabled = false;
      saveSettingsButton.innerHTML = 'Save Settings';
    }
  });
  
  // New Series Title Lookup button
  newLookupButton.addEventListener('click', () => {
    const title = newSeriesTitle.value;
    searchTmdb(title);
  });
  
  // Series Title Lookup button
  lookupButton.addEventListener('click', () => {
    const title = seriesTitleInput.value;
    searchTmdb(title);
  });
  
  // Event Listeners - Add Series Modal
  newBrowseButton.addEventListener('click', () => {
    console.log('Browse button clicked');
    ipcRenderer.send('select-directory');
  });

  cancelAddSeries.addEventListener('click', () => {
    addSeriesModal.close();
  });

  //Confirm Add Series button click handler
  confirmAddSeries.addEventListener('click', () => {
    const directory = newSeriesDirectory.value;
    const tmdbId = newTmdbId.value;
    
    // Validate directory
    if (!directory) {
      alert('Please select a directory.');
      return;
    }
    
    // Validate TMDB ID if provided
    if (tmdbId && !tmdbId.match(/^\d+$/)) {
      alert('Please enter a valid TMDB ID (numeric format) or use the search feature to select a show.');
      return;
    }
    
    // Check if we're editing or adding
    const editIndex = newSeriesDirectory.dataset.editIndex;
    if (editIndex !== undefined) {
      // Update existing series
      seriesList[editIndex].directory = directory;
      seriesList[editIndex].tmdbId = tmdbId;
      seriesList[editIndex].name = newSeriesTitle.value || extractTitleFromPath(directory);
    } else {
      // Add new series
      const seriesName = newSeriesTitle.value || extractTitleFromPath(directory);
      
      seriesList.push({
        directory,
        tmdbId,
        status: 'not-analyzed',
        name: seriesName
      });
    }
    
    // Save and render
    saveSeriesList();
    renderSeriesTable();
    
    // Close the modal
    addSeriesModal.close();
  });

  // Event Listeners - Series Details
  browseButton.addEventListener('click', () => {
    ipcRenderer.send('select-directory');
  });

  //Analyze button click handler
  analyzeButton.addEventListener('click', () => {
    const seriesDirectory = seriesDirectoryInput.value;
    const tmdbId = tmdbIdInput.value;
    
    // Validate inputs
    if (!seriesDirectory) {
      alert('Please select a TV series directory.');
      return;
    }
    
    // Validate TMDB ID if provided
    if (!tmdbId) {
      alert('Please enter a TMDB ID or use the search feature to select a show.');
      return;
    }
    
    if (tmdbId && !tmdbId.match(/^\d+$/)) {
      alert('Please enter a valid TMDB ID (numeric format) or use the search feature to select a show.');
      return;
    }
    
    // Update the current series
    if (currentSeriesId !== null) {
      seriesList[currentSeriesId].tmdbId = tmdbId;
      seriesList[currentSeriesId].name = seriesTitleInput.value || extractTitleFromPath(seriesDirectory);
      seriesList[currentSeriesId].status = 'in-progress';
      saveSeriesList();
      renderSeriesTable();
    }
    
    // Show progress
    progressContainer.style.display = 'block';
    progressBar.value = 0;
    progressBar.classList.add('progress-primary');
    progressBar.classList.remove('progress-error');
    progressStatus.textContent = 'Analyzing files...';
    resultsTable.style.display = 'none';
    
    // Use the TMDB API key and access token from settings if available
    const apiKey = getTmdbApiKey();
    const accessToken = getTmdbAccessToken();
    
    // Call the API to analyze the series
    // In a real implementation, this would be an API call
    // For now, we'll simulate it with a timeout
    ipcRenderer.send('analyze-series', {
      directory: seriesDirectory,
      tmdbId,
      apiKey,
      accessToken
    });
    
    // Simulate progress
    simulateProgress();
  });
});

// Simulate progress for demonstration purposes
function simulateProgress() {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
    progressBar.value = progress;
    
    if (progress < 20) {
      progressStatus.textContent = 'Downloading TMDB data...';
    } else if (progress < 40) {
      progressStatus.textContent = 'Scanning media files...';
    } else if (progress < 70) {
      progressStatus.textContent = 'Extracting audio from files...';
    } else if (progress < 90) {
      progressStatus.textContent = 'Analyzing audio and matching episodes...';
    } else {
      progressStatus.textContent = 'Finalizing results...';
    }
    
    if (progress >= 100) {
      clearInterval(interval);
      progressStatus.textContent = 'Analysis complete!';
      
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'analyzed';
        saveSeriesList();
        renderSeriesTable();
      }
      
      displaySampleResults();
    }
  }, 300);
}

// Display sample results for demonstration
function displaySampleResults() {
  // Clear previous results
  resultsBody.innerHTML = '';
  
  // Sample data
  const sampleResults = [
    { 
      id: 1,
      season_number: 1, 
      episode_number: 1, 
      original_filename: 'S01E01 - Winter Is Coming.mkv', 
      status: 'correct',
      episode_title: 'Winter Is Coming'
    },
    { 
      id: 2,
      season_number: 1, 
      episode_number: 2, 
      original_filename: 'S01E03 - Lord Snow.mkv', 
      status: 'incorrect',
      episode_title: 'The Kingsroad',
      corrected_filename: 'S01E02 - The Kingsroad.mkv'
    },
    { 
      id: 3,
      season_number: 1, 
      episode_number: 3, 
      original_filename: 'S01E02 - The Kingsroad.mkv', 
      status: 'incorrect',
      episode_title: 'Lord Snow',
      corrected_filename: 'S01E03 - Lord Snow.mkv'
    },
    { 
      id: 4,
      season_number: 2, 
      episode_number: 1, 
      original_filename: 'S02E01 - The North Remembers.mkv', 
      status: 'correct',
      episode_title: 'The North Remembers'
    }
  ];
  
  displayResults(sampleResults);
}

// Display results in the table
function displayResults(results) {
  // Clear previous results
  resultsBody.innerHTML = '';
  
  // Add rows to the table
  results.forEach(result => {
    const row = document.createElement('tr');
    
    const seasonCell = document.createElement('td');
    seasonCell.textContent = result.season_number;
    
    const episodeCell = document.createElement('td');
    episodeCell.textContent = result.episode_number;
    
    const filenameCell = document.createElement('td');
    filenameCell.textContent = result.original_filename;
    
    const statusCell = document.createElement('td');
    if (result.status === 'correct') {
      statusCell.innerHTML = '<span class="badge badge-success">Correct</span>';
    } else if (result.status === 'incorrect') {
      statusCell.innerHTML = '<span class="badge badge-error">Misnamed</span>';
    } else if (result.status === 'fixed') {
      statusCell.innerHTML = '<span class="badge badge-success">Fixed</span>';
    } else {
      statusCell.innerHTML = '<span class="badge badge-warning">Unknown</span>';
    }
    
    const actionCell = document.createElement('td');
    if (result.status === 'incorrect') {
      const fixButton = document.createElement('button');
      fixButton.textContent = 'Fix';
      fixButton.className = 'btn btn-xs btn-primary';
      fixButton.addEventListener('click', () => {
        fixFile(result.id, result.episode_id);
      });
      
      const detailsSpan = document.createElement('span');
      detailsSpan.textContent = ` → ${result.corrected_filename}`;
      detailsSpan.className = 'text-xs text-base-content opacity-70 ml-2';
      
      actionCell.appendChild(fixButton);
      actionCell.appendChild(detailsSpan);
    }
    
    row.appendChild(seasonCell);
    row.appendChild(episodeCell);
    row.appendChild(filenameCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);
    
    resultsBody.appendChild(row);
  });
  
  // Show the results table
  resultsTable.style.display = 'table';
}

// Fix a misnamed file
function fixFile(fileId, episodeId) {
  // In a real implementation, this would call the API to fix the file
  // For now, we'll just show an alert
  alert(`This would rename the file to the correct episode name.`);
  
  // This is where we would actually call the API
  /*
  ipcRenderer.send('fix-file', {
    fileId: fileId,
    episodeId: episodeId
  });
  */
} 