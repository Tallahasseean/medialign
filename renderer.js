// Add this at the beginning of the file
const { ipcRenderer } = require('electron');
const path = require('path');

console.log('Renderer script loaded');
console.log('electronAPI available:', !!window.electronAPI);

// DOM Elements - Main UI
const addSeriesButton = document.getElementById('add-series-button');
const seriesTable = document.getElementById('series-table');
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

// DOM Elements - Progress Indicator
const progressLabel = document.getElementById('progress-label');
const progressPercentage = document.getElementById('progress-percentage');

// Current series ID (set after analysis)
let currentSeriesId = null;
// Store all series
let seriesList = [];

// Initialize the application
async function init() {
  console.log('Initializing application...');
  
  // Set up IPC listeners
  setupIpcListeners();
  
  // Update the table headers for our tree structure
  updateTableHeaders();
  
  // Load settings
  loadSettings();
  
  // Load series list
  await loadSeriesList();
  
  // Render series list
  renderSeriesTable();
  
  // Set up event listeners
  setupEventListeners();
  
  console.log('Application initialized');
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
      
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'error';
        saveSeriesList();
        renderSeriesTable();
      }
      
      // Show error alert
      alert(`Error analyzing series: ${result.error}`);
      
      // If error is related to API key, show a message to set up the TMDB API key
      if (result.error.includes('API key') || result.error.includes('authentication')) {
        setTimeout(() => {
          settingsModal.showModal();
        }, 1500);
      }
    } else {
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'analyzed';
        saveSeriesList();
        renderSeriesTable();
      }
      
      // Process the results and update the UI
      if (result && result.files && result.files.length > 0) {
        console.log(`Processing ${result.files.length} files from analysis result`);
        
        // Get all file rows
        const fileRows = document.querySelectorAll('tr[data-file-id]');
        console.log(`Found ${fileRows.length} file rows in the table`);
        
        // Create a map of file paths to result objects
        const fileResultMap = new Map();
        result.files.forEach(file => {
          // Create a fileId in the same format as we use in the rows
          const fileId = file.original_filepath.replace(/[\/\\:]/g, '_');
          fileResultMap.set(fileId, file);
          console.log(`Added file ID ${fileId} to result map`);
        });
        
        // Update each row with the analysis result
        fileRows.forEach(row => {
          const fileId = row.dataset.fileId;
          if (!fileId) {
            console.warn('Row missing fileId attribute:', row);
            return;
          }
          
          const fileResult = fileResultMap.get(fileId);
          if (!fileResult) {
            console.warn(`No result found for file ID ${fileId}`);
            return;
          }
          
          console.log(`Updating row for file ID ${fileId} with analysis result`);
          
          // Update the TMDB ID cell with season/episode info
          const tmdbCell = row.querySelector('td:nth-child(3)');
          if (tmdbCell && fileResult.season_number && fileResult.episode_number) {
            tmdbCell.textContent = `S${fileResult.season_number.toString().padStart(2, '0')}E${fileResult.episode_number.toString().padStart(2, '0')}`;
          }
          
          // Update the status cell
          const statusCell = row.querySelector('.status-cell');
          if (statusCell) {
            // Update the main status badge
            const mainBadge = statusCell.querySelector('.badge:not(.extraction-badge)');
            if (mainBadge) {
              if (fileResult.status === 'correct') {
                mainBadge.className = 'badge badge-success';
                mainBadge.textContent = 'Correct';
              } else if (fileResult.status === 'incorrect') {
                mainBadge.className = 'badge badge-error';
                mainBadge.textContent = 'Misnamed';
              } else if (fileResult.status === 'fixed') {
                mainBadge.className = 'badge badge-success';
                mainBadge.textContent = 'Fixed';
              } else {
                mainBadge.className = 'badge badge-warning';
                mainBadge.textContent = 'Unknown';
              }
            }
            
            // Add a checkmark icon for episodes that have been verified as correct
            if (fileResult.is_correct && !statusCell.querySelector('.verified-icon')) {
              const verifiedIcon = document.createElement('span');
              verifiedIcon.className = 'ml-2 text-success verified-icon';
              verifiedIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              `;
              verifiedIcon.title = "Verified by audio analysis";
              statusCell.appendChild(verifiedIcon);
            }
          }
          
          // Update the actions cell for incorrect files
          if (fileResult.status === 'incorrect') {
            const actionCell = row.querySelector('td:last-child');
            if (actionCell) {
              // Add fix button if not already present
              if (!actionCell.querySelector('.fix-button')) {
                const fixButton = document.createElement('button');
                fixButton.textContent = 'Fix';
                fixButton.className = 'btn btn-xs btn-primary fix-button';
                fixButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  fixFile(fileResult.id, fileResult.episode_id);
                });
                
                // Add details about the correct filename
                const detailsSpan = document.createElement('span');
                detailsSpan.textContent = ` → ${fileResult.corrected_filename}`;
                detailsSpan.className = 'text-xs text-base-content opacity-70 ml-2';
                
                // Clear existing buttons
                actionCell.innerHTML = '';
                
                actionCell.appendChild(fixButton);
                actionCell.appendChild(detailsSpan);
              }
            }
          }
        });
      }
      
      // Start audio extraction if there are files to process
      if (result && result.files && result.files.length > 0) {
        // Start audio extraction for the series
        startAudioExtraction(currentSeriesId);
      }
    }
  });

  // Add IPC handler for fetching episode details
  ipcRenderer.on('episode-details-result', (event, result) => {
    console.log('Episode details result:', result);
    
    if (result && result.error) {
      console.error('Error fetching episode details:', result.error);
      alert(`Error fetching episode details: ${result.error}`);
      return;
    }
    
    // Display episode details in a modal
    displayEpisodeDetails(result);
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

// Load series list from local storage and database
async function loadSeriesList() {
  try {
    // Initialize an empty series list
    seriesList = [];
    
    // First try to load from local storage for backward compatibility
  const storedSeries = localStorage.getItem('seriesList');
  if (storedSeries) {
      try {
        const localSeriesList = JSON.parse(storedSeries);
        console.log(`Loaded ${localSeriesList.length} series from local storage:`, localSeriesList);
        
        // Add local series to the list if they're valid
        if (Array.isArray(localSeriesList)) {
          seriesList = localSeriesList.filter(series => series && typeof series === 'object');
          console.log(`Added ${seriesList.length} valid series from local storage`);
        }
      } catch (parseError) {
        console.error('Error parsing series list from local storage:', parseError);
        // Clear the corrupted data
        localStorage.removeItem('seriesList');
      }
    }
    
    // Clean up duplicate series in the database
    console.log('Cleaning up duplicate series in the database...');
    try {
      const cleanupResult = await ipcRenderer.invoke('cleanup-duplicate-series');
      console.log('Cleanup result:', cleanupResult);
    } catch (cleanupError) {
      console.error('Error cleaning up duplicate series:', cleanupError);
    }
    
    // Then try to load from the database
    console.log('Loading series from database...');
    try {
      const dbSeries = await ipcRenderer.invoke('get-all-series');
      console.log(`Loaded ${dbSeries.length} series from database:`, dbSeries);
      
      // If we have series from the database, add them to the list
      if (dbSeries && Array.isArray(dbSeries) && dbSeries.length > 0) {
        // Convert database series to the format expected by the UI
        const dbSeriesConverted = dbSeries.map(series => ({
          id: series.id,
          name: series.title || extractTitleFromPath(series.directory),
          directory: series.directory,
          tmdbId: series.imdb_id, // Note: we're using imdb_id for TMDB ID in the database
          status: 'analyzed', // Assume all series in the database have been analyzed
          created_at: series.created_at
        }));
        
        console.log('Converted database series:', dbSeriesConverted);
        
        // Replace any existing series with the same directory with the database version
        // This ensures we have the correct IDs from the database
        const directoryMap = new Map();
        
        // Add database series to the map first (they take precedence)
        dbSeriesConverted.forEach(series => {
          if (series && series.directory) {
            directoryMap.set(series.directory, series);
          }
        });
        
        // Add local series to the map only if the directory doesn't already exist
        seriesList.forEach(series => {
          if (series && series.directory && !directoryMap.has(series.directory)) {
            directoryMap.set(series.directory, series);
          }
        });
        
        // Convert the map back to an array
        seriesList = Array.from(directoryMap.values());
        
        console.log(`Final series list after merging: ${seriesList.length} series`);
      }
    } catch (dbError) {
      console.error('Error loading series from database:', dbError);
    }
    
    // Log the final series list
    console.log('Final series list:', seriesList);
    
    // Save to local storage for backward compatibility
    if (seriesList.length > 0) {
      saveSeriesList();
    }
    
    // Render the series table
    renderSeriesTable();
  } catch (error) {
    console.error('Error loading series list:', error);
    // If there's an error, just use what we have
    renderSeriesTable();
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
  const apiKey = tmdbApiKeyInput.value.trim();
  const accessToken = tmdbAccessTokenInput.value.trim();
  const maxProcesses = document.getElementById('max-extraction-processes')?.value || '';
  
  localStorage.setItem('tmdbApiKey', apiKey);
  localStorage.setItem('tmdbAccessToken', accessToken);
  
  // Save max processes to database
  if (maxProcesses) {
    ipcRenderer.invoke('update-setting', { 
      key: 'max_extraction_processes', 
      value: maxProcesses 
    }).catch(error => {
      console.error('Error saving max processes setting:', error);
    });
  }
  
  settingsModal.close();
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
  console.log(`Rendering series table with ${seriesList.length} series`);
  
  // Clear the table body first
  const tableBody = document.getElementById('series-table-body');
  tableBody.innerHTML = '';
  
  // Check if we have any series
  if (!seriesList || seriesList.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'text-center';
    emptyRow.innerHTML = `
      <td colspan="3" class="py-8 text-base-content opacity-60">
        No TV series added yet. Click "Add TV Series" to get started.
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  // Loop through each series and create a row
  seriesList.forEach(series => {
    if (!series || !series.directory) {
      console.warn('Invalid series entry:', series);
      return;
    }
    
    // Create a new row for this series
    const row = document.createElement('tr');
    row.className = 'series-row hover:bg-base-200 transition-colors';
    row.dataset.seriesId = series.id;
    row.dataset.directoryPath = series.directory;
    row.dataset.isExpanded = 'false';
    row.dataset.indentLevel = '0';
    
    // Create the cells for the row
    const titleCell = document.createElement('td');
    
    // Create the expand/collapse icon
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon inline-block mr-2 transition-transform duration-200';
    expandIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    `;
    titleCell.appendChild(expandIcon);
    
    // Create folder icon
    const folderIcon = document.createElement('span');
    folderIcon.className = 'text-primary inline-block mr-2';
    folderIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    `;
    titleCell.appendChild(folderIcon);
    
    // Add series title
    const titleText = document.createElement('span');
    titleText.className = 'series-title font-medium';
    titleText.textContent = extractTitleFromPath(series.directory);
    titleCell.appendChild(titleText);
    
    // Create the status cell
    const statusCell = document.createElement('td');
    statusCell.className = 'text-center'; // Center the status
    
    // Create the actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'text-right'; // Right-align the actions
    
    // Add the analyze button
    const analyzeButton = document.createElement('button');
    analyzeButton.className = 'btn btn-primary btn-xs analyze-btn';
    analyzeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
      Analyze
    `;
    
    // Add the delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-error btn-xs ml-2 delete-btn';
    deleteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
      Delete
    `;
    
    actionsCell.appendChild(analyzeButton);
    actionsCell.appendChild(deleteButton);
    
    // Add the cells to the row
    row.appendChild(titleCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    // Add the row to the table
    tableBody.appendChild(row);
    
    // Add status badge if series has a status
    if (series.status) {
      const statusBadge = document.createElement('span');
      
      if (series.status === 'processing') {
        statusBadge.className = 'badge badge-warning';
        statusBadge.textContent = 'Processing';
        statusCell.appendChild(statusBadge);
        
        // Start polling for status updates
        pollAudioExtractionStatus(series.id, row);
      } else if (series.status === 'analyzed') {
        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = 'Analyzed';
        statusCell.appendChild(statusBadge);
      } else if (series.status === 'error') {
        statusBadge.className = 'badge badge-error';
        statusBadge.textContent = 'Error';
        statusCell.appendChild(statusBadge);
      }
    }
    
    // Add click event to expand/collapse the series
    row.addEventListener('click', (event) => {
      // Don't expand if clicking on buttons
      if (event.target.closest('.btn')) {
        return;
      }
      
      console.log("Series row clicked:", {
        seriesId: series.id,
        directory: series.directory, 
        dataset: row.dataset
      });
      
      expandDirectory(series.directory, row);
    });
    
    // Add click event for analyze button
    analyzeButton.addEventListener('click', () => {
      // Show a confirmation dialog
      if (confirm(`Are you sure you want to analyze the series "${extractTitleFromPath(series.directory)}"? This will extract audio from all video files.`)) {
        console.log(`Starting analysis for series ${series.id}`);
        
        // Update the series status
        series.status = 'processing';
        // Add a processing badge
        const statusBadge = document.createElement('span');
        statusBadge.className = 'badge badge-warning';
        statusBadge.textContent = 'Processing';
        statusCell.innerHTML = ''; // Clear the cell
        statusCell.appendChild(statusBadge);
        
        // Save the updated series list
        saveSeriesList();
        
        // Start the audio extraction process
        ipcRenderer.invoke('extract-audio', { seriesId: series.id })
          .then(result => {
            console.log('Audio extraction initiated:', result);
            
            // Start polling for status updates
            pollAudioExtractionStatus(series.id, row);
          })
          .catch(error => {
            console.error('Audio extraction error:', error);
            
            // Update badge to show error
            statusBadge.className = 'badge badge-error';
            statusBadge.textContent = 'Extraction Error';
            
            // Update series status
            series.status = 'error';
            saveSeriesList();
          });
      }
    });
    
    // Add click event for delete button
    deleteButton.addEventListener('click', () => {
      // Show a confirmation dialog
      if (confirm(`Are you sure you want to delete the series "${extractTitleFromPath(series.directory)}" from the database? This will not delete the files.`)) {
        console.log(`Deleting series ${series.id}`);
        
        // Call the delete-series IPC
        ipcRenderer.invoke('delete-series', { seriesId: series.id })
          .then(result => {
            console.log('Series deleted:', result);
            
            // Remove the series from the list
            seriesList = seriesList.filter(s => s.id !== series.id);
            
            // Save the updated series list
            saveSeriesList();
            
            // Remove the row from the table and all its children
            const childRows = document.querySelectorAll(`tr[data-parent-path="${series.directory}"]`);
            childRows.forEach(childRow => childRow.remove());
            row.remove();
          })
          .catch(error => {
            console.error('Error deleting series:', error);
            alert(`Error deleting series: ${error.message}`);
          });
      }
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
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
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
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
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
      } else if (item.isVideo) {
        // For video files, add a fileId attribute for tracking
        // Use the path as a unique identifier
        const fileId = item.path.replace(/[\/\\:]/g, '_');
        itemRow.dataset.fileId = fileId;
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
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
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
      
      // TMDB ID or Season/Episode info
      const tmdbCell = document.createElement('td');
      if (item.isDirectory) {
      tmdbCell.textContent = '-';
      } else {
        // Try to extract season and episode info from filename
        const seasonEpisodeMatch = item.name.match(/S(\d+)E(\d+)/i);
        if (seasonEpisodeMatch) {
          const season = parseInt(seasonEpisodeMatch[1]);
          const episode = parseInt(seasonEpisodeMatch[2]);
          tmdbCell.textContent = `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
        } else {
          tmdbCell.textContent = '-';
        }
      }
      
      // Status/Info cell
      const statusCell = document.createElement('td');
      statusCell.className = 'status-cell';
      
      if (item.isDirectory) {
        // For directories, show a badge indicating it's a directory
        statusCell.innerHTML = '<span class="badge badge-primary">Directory</span>';
      } else {
        // For video files, show status and extraction progress
        // Default status is "Not Analyzed"
        statusCell.innerHTML = '<span class="badge badge-ghost">Not Analyzed</span>';
        
        // Add a placeholder for extraction status that will be updated
        const extractionBadge = document.createElement('span');
        extractionBadge.className = 'badge badge-ghost extraction-badge ml-2';
        extractionBadge.textContent = 'Pending Extraction';
        statusCell.appendChild(extractionBadge);
      }
      
      // Processing step cell (for video files)
      const stepCell = document.createElement('td');
      stepCell.className = 'step-cell text-xs';
      if (item.isDirectory) {
        stepCell.textContent = '-';
      } else {
        stepCell.textContent = 'Pending';
      }
      
      // Actions cell
      const actionsCell = document.createElement('td');
      
      if (item.isDirectory) {
        // For directories, add an analyze button to analyze all videos in the directory
        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = 'Analyze';
        analyzeBtn.className = 'btn btn-xs btn-primary';
        analyzeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Expand the directory if not already expanded
          if (itemRow.dataset.isExpanded !== 'true') {
            toggleSubdirectoryExpansion(itemRow);
          }
          
          // TODO: Implement directory-level analysis
          alert('Directory-level analysis will be implemented in a future update.');
        });
        
        actionsCell.appendChild(analyzeBtn);
      } else if (item.isVideo) {
        // For video files, add an analyze button
        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = 'Analyze';
        analyzeBtn.className = 'btn btn-xs btn-primary';
        analyzeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // TODO: Implement single file analysis
          // For now, we'll just extract audio for this file
          const fileId = itemRow.dataset.fileId;
          
          // Update the UI to show in-progress
          const extractionBadge = itemRow.querySelector('.extraction-badge');
          if (extractionBadge) {
            extractionBadge.className = 'badge badge-info extraction-badge ml-2';
            extractionBadge.textContent = 'Starting extraction...';
            
            // Add a mini progress bar
            const miniProgress = document.createElement('div');
            miniProgress.className = 'mini-progress ml-1';
            miniProgress.style.width = '30px';
            miniProgress.style.height = '4px';
            miniProgress.style.backgroundColor = 'rgba(255,255,255,0.3)';
            miniProgress.style.borderRadius = '2px';
            miniProgress.style.overflow = 'hidden';
            miniProgress.style.display = 'inline-block';
            miniProgress.style.verticalAlign = 'middle';
            
            const miniProgressFill = document.createElement('div');
            miniProgressFill.className = 'mini-progress-fill';
            miniProgressFill.style.width = '0%';
            miniProgressFill.style.height = '100%';
            miniProgressFill.style.backgroundColor = 'white';
            
            miniProgress.appendChild(miniProgressFill);
            extractionBadge.appendChild(miniProgress);
          }
          
          // Add a pulsing effect to the row
          itemRow.classList.add('pulse-animation');
          
          // Set a background color based on progress
          itemRow.style.background = 'linear-gradient(to right, rgba(0, 149, 255, 0.2) 0%, transparent 0%)';
          
          // Update the processing step
          const stepCell = itemRow.querySelector('.step-cell');
          if (stepCell) {
            stepCell.textContent = 'Starting extraction...';
            stepCell.className = 'step-cell text-xs text-info';
          }
          
          // Start audio extraction for this file
          ipcRenderer.invoke('extract-audio-for-file', { 
            seriesId: parentIndex,
            filePath: item.path,
            fileId: fileId
          })
          .then(result => {
            console.log('Started audio extraction for file:', result);
          })
          .catch(error => {
            console.error('Error starting audio extraction:', error);
            
            // Update UI to show error
            if (extractionBadge) {
              extractionBadge.className = 'badge badge-error extraction-badge ml-2';
              extractionBadge.textContent = 'Extraction Error';
            }
            
            itemRow.classList.remove('pulse-animation');
            itemRow.style.background = 'rgba(255, 0, 0, 0.2)';
            
            if (stepCell) {
              stepCell.textContent = 'Error';
              stepCell.className = 'step-cell text-xs text-error';
            }
            
            // Add retry button
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.className = 'btn btn-xs btn-error ml-2';
            retryButton.addEventListener('click', (e) => {
              e.stopPropagation();
              // Remove this button
              retryButton.remove();
              // Click the analyze button again
              analyzeBtn.click();
            });
            
            actionsCell.appendChild(retryButton);
          });
        });
        
        actionsCell.appendChild(analyzeBtn);
        
        // Add extract audio button
        const extractButton = document.createElement('button');
        extractButton.textContent = 'Extract Audio';
        extractButton.className = 'btn btn-xs btn-secondary ml-2';
        extractButton.addEventListener('click', (e) => {
          e.stopPropagation();
          // Click the analyze button to start extraction
          analyzeBtn.click();
        });
        
        actionsCell.appendChild(extractButton);
      }
      
      itemRow.appendChild(nameCell);
      itemRow.appendChild(pathCell);
      itemRow.appendChild(tmdbCell);
      itemRow.appendChild(statusCell);
      itemRow.appendChild(stepCell);
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
  } catch (error) {
    console.error('Error expanding directory:', error);
    throw error;
  }
}

// Show series details for analysis
function showSeriesDetails(index) {
  // Set the current series ID
  currentSeriesId = index;
  
  // Find the series row and expand it if not already expanded
  const seriesRow = document.querySelector(`tr[data-series-index="${index}"]`);
  if (seriesRow && seriesRow.dataset.isExpanded !== 'true') {
    // Simulate a click on the row to expand it
    seriesRow.click();
  }
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
  init().catch(error => {
    console.error('Error initializing application:', error);
  });
  
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
  confirmAddSeries.addEventListener('click', async () => {
    const directory = newSeriesDirectory.value;
    const tmdbId = newTmdbId.value;
    const name = newSeriesTitle.value || extractTitleFromPath(directory);
    
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
    
    try {
      // Check if we're editing or adding
      const editIndex = newSeriesDirectory.dataset.editIndex;
      
      if (editIndex !== undefined) {
        // Update existing series
        seriesList[editIndex].directory = directory;
        seriesList[editIndex].tmdbId = tmdbId;
        seriesList[editIndex].name = name;
        
        // Save to localStorage (we'll implement database update later)
        saveSeriesList();
      } else {
        // Add new series to the database
        console.log(`Adding new series to database: ${name}, Directory: ${directory}`);
        
        try {
          // Call the add-series IPC handler
          const newSeries = await ipcRenderer.invoke('add-series', { 
            directory, 
            name,
            tmdbId 
          });
          
          console.log('New series added to database:', newSeries);
          
          // Add to our local list with the database ID
          seriesList.push({
            id: newSeries.id,
            directory,
            tmdbId,
            status: 'not-analyzed',
            name
          });
          
          // Save to localStorage
          saveSeriesList();
        } catch (dbError) {
          console.error('Error adding series to database:', dbError);
          alert(`Error adding series: ${dbError.message}`);
          
          // Still add to localStorage as a fallback
          seriesList.push({
            directory,
            tmdbId,
            status: 'not-analyzed',
            name
          });
          
          // Save to localStorage
          saveSeriesList();
        }
      }
      
      // Render the updated table
      renderSeriesTable();
      
      // Close the modal
      addSeriesModal.close();
    } catch (error) {
      console.error('Error adding/updating series:', error);
      alert(`Error: ${error.message}`);
    }
  });

  // Event Listeners - Series Details
  browseButton.addEventListener('click', () => {
    ipcRenderer.send('select-directory');
  });

  //Analyze button click handler
  analyzeButton.addEventListener('click', () => {
    // Get the series directory and TMDB ID
    const seriesDirectory = seriesDirectoryInput.value;
    const tmdbId = tmdbIdInput.value;
    
    // Validate inputs
    if (!seriesDirectory) {
      alert('Please select a series directory');
      return;
    }
    
    if (!tmdbId || isNaN(parseInt(tmdbId))) {
      alert('Please enter a valid TMDB ID');
      return;
    }
    
    // Update the current series in the list
    if (currentSeriesId !== null) {
      seriesList[currentSeriesId].tmdbId = tmdbId;
      seriesList[currentSeriesId].name = seriesTitleInput.value;
      seriesList[currentSeriesId].status = 'in-progress';
      saveSeriesList();
      renderSeriesTable();
    }
    
    // Reset the stepper
    resetStepper();
    
    // Show the progress container
    progressContainer.style.display = 'block';
    
    // Initialize the progress bar
    progressBar.style.width = '0%';
    progressBar.className = 'progress-primary';
    progressStatus.textContent = 'Starting analysis...';
    
    // Get the TMDB API key and access token from settings
    const tmdbApiKey = localStorage.getItem('tmdbApiKey') || '';
    const tmdbAccessToken = localStorage.getItem('tmdbAccessToken') || '';
    
    // Send a message to analyze the series
    console.log(`Sending analyze-series request with directory: ${seriesDirectory} and tmdbId: ${tmdbId}`);
    ipcRenderer.invoke('analyze-series', {
      directory: seriesDirectory,
      tmdbId: tmdbId,
      apiKey: tmdbApiKey,
      accessToken: tmdbAccessToken
    });
    
    // The real progress will be handled by the analyze-series-result event handler
  });
});

// Simulate progress for demonstration purposes
function simulateProgress() {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
    progressBar.value = progress;
    
    // Update the stepper based on progress
    if (progress === 20) {
      // Finished fetching TMDB data, moving to scanning files
      progressStatus.textContent = 'Scanning media files...';
    } else if (progress === 40) {
      // Finished scanning files, moving to extracting audio
      progressStatus.textContent = 'Extracting audio from files...';
    } else if (progress === 70) {
      // Finished extracting audio, moving to analyzing content
      progressStatus.textContent = 'Analyzing audio content...';
    } else if (progress === 85) {
      // Finished analyzing content, moving to matching episodes
      progressStatus.textContent = 'Matching episodes with TMDB data...';
    }
    
    if (progress >= 100) {
      clearInterval(interval);
      
      // Complete all steps
      progressStatus.textContent = 'Analysis complete!';
      
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'analyzed';
        saveSeriesList();
        renderSeriesTable();
      }
      
      // Display the real results from the analysis instead of sample data
      if (result && result.files) {
        displayResults(result.files);
      } else {
        console.warn('No files data found in analysis result');
      }
    }
  }, 300);
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

// Reset stepper and show it
function resetStepper() {
  progressContainer.style.display = 'none';
  progressBar.value = 0;
  progressBar.classList.remove('progress-primary');
  progressBar.classList.remove('progress-error');
  progressStatus.textContent = '';
  progressLabel.textContent = '';
  progressPercentage.textContent = '';
}

// Function to fetch episode details
function fetchEpisodeDetails(tmdbId, seasonNumber, episodeNumber) {
  const apiKey = getTmdbApiKey();
  const accessToken = getTmdbAccessToken();
  
  // Show loading indicator
  document.body.classList.add('cursor-wait');
  
  // Request episode details from main process
  ipcRenderer.invoke('get-episode-details', {
    tmdbId,
    seasonNumber,
    episodeNumber,
    apiKey,
    accessToken
  }).then(result => {
    document.body.classList.remove('cursor-wait');
    
    if (result && result.error) {
      console.error('Error fetching episode details:', result.error);
      alert(`Error fetching episode details: ${result.error}`);
    } else {
      // Display episode details
      displayEpisodeDetails(result);
    }
  }).catch(error => {
    document.body.classList.remove('cursor-wait');
    console.error('Error fetching episode details:', error);
    alert(`Error fetching episode details: ${error.message || error}`);
  });
}

// Function to display episode details in a modal
function displayEpisodeDetails(episode) {
  // Create modal if it doesn't exist
  let episodeModal = document.getElementById('episode-details-modal');
  if (!episodeModal) {
    episodeModal = document.createElement('dialog');
    episodeModal.id = 'episode-details-modal';
    episodeModal.className = 'modal';
    document.body.appendChild(episodeModal);
  }
  
  // Format air date
  const airDate = episode.airDate ? new Date(episode.airDate).toLocaleDateString() : 'Unknown';
  
  // Create modal content
  episodeModal.innerHTML = `
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg">S${episode.seasonNumber}E${episode.episodeNumber}: ${episode.name}</h3>
      <div class="py-4">
        <div class="flex flex-col md:flex-row gap-4">
          ${episode.still ? `
            <div class="flex-none md:w-1/3">
              <img src="${episode.still}" alt="${episode.name}" class="rounded-lg w-full">
            </div>
          ` : ''}
          <div class="flex-1">
            <p class="text-sm opacity-70 mb-2">Air Date: ${airDate}</p>
            ${episode.runtime ? `<p class="text-sm opacity-70 mb-2">Runtime: ${episode.runtime} minutes</p>` : ''}
            ${episode.voteAverage ? `<p class="text-sm opacity-70 mb-4">Rating: ${episode.voteAverage.toFixed(1)}/10</p>` : ''}
            <p class="mb-4">${episode.overview || 'No overview available.'}</p>
            
            ${episode.guestStars && episode.guestStars.length > 0 ? `
              <div class="mb-4">
                <h4 class="font-semibold mb-2">Guest Stars</h4>
                <div class="flex flex-wrap gap-2">
                  ${episode.guestStars.slice(0, 5).map(person => `
                    <div class="badge badge-outline">${person.name} ${person.character ? `as ${person.character}` : ''}</div>
                  `).join('')}
                  ${episode.guestStars.length > 5 ? `<div class="badge badge-outline">+${episode.guestStars.length - 5} more</div>` : ''}
                </div>
              </div>
            ` : ''}
            
            ${episode.crew && episode.crew.length > 0 ? `
              <div>
                <h4 class="font-semibold mb-2">Crew</h4>
                <div class="flex flex-wrap gap-2">
                  ${episode.crew.filter(person => ['Director', 'Writer'].includes(person.job)).map(person => `
                    <div class="badge badge-outline">${person.job}: ${person.name}</div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        ${episode.videos && episode.videos.length > 0 ? `
          <div class="mt-6">
            <h4 class="font-semibold mb-2">Videos</h4>
            <div class="flex flex-wrap gap-2">
              ${episode.videos.slice(0, 3).map(video => `
                <a href="https://www.youtube.com/watch?v=${video.key}" target="_blank" class="btn btn-sm btn-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  ${video.name}
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="modal-action">
        <form method="dialog">
          <button class="btn">Close</button>
        </form>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;
  
  // Show the modal
  episodeModal.showModal();
}

// Add these to the settings modal HTML
function addSettingsFields() {
  // Find the settings form
  const settingsForm = document.querySelector('#settings-modal .py-4');
  if (!settingsForm) return;
  
  // Add max processes setting
  const maxProcessesDiv = document.createElement('div');
  maxProcessesDiv.className = 'form-control w-full mt-4';
  maxProcessesDiv.innerHTML = `
    <label class="label">
      <span class="label-text">Maximum Audio Extraction Processes:</span>
    </label>
    <input type="number" id="max-extraction-processes" min="1" max="16" class="input input-bordered w-full" />
    <label class="label">
      <span class="label-text-alt text-info">Higher values may improve speed but increase CPU usage</span>
    </label>
  `;
  
  settingsForm.appendChild(maxProcessesDiv);
  
  // Load the current value
  const maxProcessesInput = document.getElementById('max-extraction-processes');
  if (maxProcessesInput) {
    ipcRenderer.invoke('get-setting', { key: 'max_extraction_processes' })
      .then(result => {
        if (result && result.value) {
          maxProcessesInput.value = result.value;
        }
      })
      .catch(error => {
        console.error('Error loading max processes setting:', error);
      });
  }
}

// Add a function to start audio extraction
function startAudioExtraction(seriesIndex) {
  // Get the series object
  const series = seriesList[seriesIndex];
  if (!series) {
    console.error(`Series with index ${seriesIndex} not found`);
    return;
  }
  
  // Use the actual series ID from the database, not the array index
  const seriesId = series.id || seriesIndex;
  console.log(`Starting audio extraction for series ${seriesId} (index: ${seriesIndex})`);
  
  // Update the series status in the table
  const seriesRow = document.querySelector(`tr[data-series-index="${seriesIndex}"]`);
  if (seriesRow) {
    // Update the status cell
    const statusCell = seriesRow.querySelector('td:nth-child(4)');
    if (statusCell) {
      // Update or add the progress badge
      let progressBadge = statusCell.querySelector('.badge-info');
      if (!progressBadge) {
        progressBadge = document.createElement('span');
        progressBadge.className = 'badge badge-info ml-2';
        statusCell.appendChild(progressBadge);
      }
      progressBadge.textContent = 'Starting...';
    }
  }
  
  // Start the extraction process
  ipcRenderer.invoke('extract-audio', { seriesId })
    .then(result => {
      if (result.status === 'already_processing') {
        console.log('Audio extraction already in progress');
        // Update the series row to show it's in progress
        if (seriesRow && statusCell) {
          const progressBadge = statusCell.querySelector('.badge-info');
          if (progressBadge) {
            progressBadge.textContent = 'In Progress';
          }
        }
      } else {
        console.log('Audio extraction started');
        // Start polling for updates
        pollAudioExtractionStatus(seriesIndex, seriesId);
      }
    })
    .catch(error => {
      console.error('Error starting audio extraction:', error);
      // Update the series row to show the error
      if (seriesRow) {
        const statusCell = seriesRow.querySelector('td:nth-child(4)');
        if (statusCell) {
          // Update or add the error badge
          let errorBadge = statusCell.querySelector('.badge-error');
          if (!errorBadge) {
            errorBadge = document.createElement('span');
            errorBadge.className = 'badge badge-error ml-2';
            statusCell.appendChild(errorBadge);
          }
          errorBadge.textContent = 'Error';
          errorBadge.title = error.message || 'Unknown error';
        }
      }
      
      // Show error alert
      alert(`Error starting audio extraction: ${error.message || 'Unknown error'}`);
    });
}

// Poll for audio extraction status updates
function pollAudioExtractionStatus(seriesIndex, seriesId) {
  console.log(`Starting to poll audio extraction status for series ${seriesId} (index: ${seriesIndex})`);
  
  // Update the series status in the table
  const seriesRow = document.querySelector(`tr[data-series-index="${seriesIndex}"]`);
  if (seriesRow) {
    // Update the status cell
    const statusCell = seriesRow.querySelector('td:nth-child(4)');
    if (statusCell) {
      // Update or add the progress badge
      let progressBadge = statusCell.querySelector('.badge-info');
      if (!progressBadge) {
        progressBadge = document.createElement('span');
        progressBadge.className = 'badge badge-info ml-2';
        statusCell.appendChild(progressBadge);
      }
      progressBadge.textContent = 'Extracting 0%';
    }
  }
  
  const pollInterval = setInterval(() => {
    console.log(`Polling audio extraction status for series ${seriesId} (index: ${seriesIndex})...`);
    
    ipcRenderer.invoke('get-audio-extraction-status', { seriesId })
      .then(status => {
        console.log('Audio extraction status:', status);
        
        // Update series progress in the table
        if (seriesRow) {
          const statusCell = seriesRow.querySelector('td:nth-child(4)');
          if (statusCell) {
            // Update the progress badge
            let progressBadge = statusCell.querySelector('.badge-info');
            if (progressBadge) {
              progressBadge.textContent = `Extracting ${status.overallProgress}%`;
            }
            
            // Store progress in the series list
            if (seriesList[seriesIndex]) {
              seriesList[seriesIndex].progress = status.overallProgress;
            }
          }
        }
        
        // Log the file IDs we're about to update
        console.log('Files to update:', status.files.map(f => f.id));
        
        // Update individual file progress in the results table
        updateFileExtractionProgress(status.files);
        
        // Check if extraction is complete
        if (!status.isProcessing && status.pendingFiles === 0 && status.inProgressFiles === 0) {
          console.log('Audio extraction complete!');
          clearInterval(pollInterval);
          
          // Update series status in the table
          if (seriesRow) {
            const statusCell = seriesRow.querySelector('td:nth-child(4)');
            if (statusCell) {
              // Remove the progress badge
              const progressBadge = statusCell.querySelector('.badge-info');
              if (progressBadge) {
                progressBadge.remove();
              }
              
              // Add a completed badge if not already present
              let completedBadge = statusCell.querySelector('.badge-success');
              if (!completedBadge) {
                completedBadge = document.createElement('span');
                completedBadge.className = 'badge badge-success ml-2';
                completedBadge.textContent = 'Extraction Complete';
                statusCell.appendChild(completedBadge);
              }
            }
          }
          
          // Update the series status in the list
          if (seriesList[seriesIndex]) {
            seriesList[seriesIndex].status = 'analyzed';
            seriesList[seriesIndex].progress = 100;
            saveSeriesList();
          }
          
          // Proceed to the next step (analyze content)
          // analyzeContent(seriesId);
        }
      })
      .catch(error => {
        console.error('Error polling audio extraction status:', error);
        clearInterval(pollInterval);
        
        // Update series status in the table to show error
        if (seriesRow) {
          const statusCell = seriesRow.querySelector('td:nth-child(4)');
          if (statusCell) {
            // Remove the progress badge
            const progressBadge = statusCell.querySelector('.badge-info');
            if (progressBadge) {
              progressBadge.remove();
            }
            
            // Add an error badge if not already present
            let errorBadge = statusCell.querySelector('.badge-error');
            if (!errorBadge) {
              errorBadge = document.createElement('span');
              errorBadge.className = 'badge badge-error ml-2';
              errorBadge.textContent = 'Extraction Error';
              errorBadge.title = error.message || 'Unknown error';
              statusCell.appendChild(errorBadge);
            }
          }
        }
        
        // Update the series status in the list
        if (seriesList[seriesIndex]) {
          seriesList[seriesIndex].status = 'error';
          saveSeriesList();
        }
      });
  }, 2000); // Poll every 2 seconds
}

// Update file extraction progress in the results table
function updateFileExtractionProgress(files) {
  console.log(`Updating file extraction progress for ${files.length} files`);
  
  // Get all file rows from the entire table (not just results-body)
  const fileRows = document.querySelectorAll('tr[data-file-id]');
  console.log(`Found ${fileRows.length} file rows in the table`);
  
  // Debug: Log all row data-fileId attributes
  fileRows.forEach((row, index) => {
    console.log(`Row ${index} has data-fileId: ${row.dataset.fileId}`);
  });
  
  // Create a map of file IDs to status objects
  const fileStatusMap = new Map();
  files.forEach(file => {
    fileStatusMap.set(file.id, file);
    console.log(`Added file ID ${file.id} to status map with status ${file.status} and progress ${file.progress}%`);
  });
  
  // Update each row
  fileRows.forEach(row => {
    const fileId = row.dataset.fileId;
    if (!fileId) {
      console.warn('Row missing fileId attribute:', row);
      console.warn('Row dataset:', JSON.stringify(row.dataset));
      return;
    }
    
    const fileStatus = fileStatusMap.get(fileId);
    if (!fileStatus) {
      console.warn(`No status found for file ID ${fileId}`);
      return;
    }
    
    console.log(`Updating row for file ID ${fileId}, status: ${fileStatus.status}, progress: ${fileStatus.progress}%`);
    
    // Add a visual indicator of progress with a background color
    if (fileStatus.status === 'in_progress') {
      // Set a background color based on progress
      const progressPercent = fileStatus.progress || 0;
      row.style.background = `linear-gradient(to right, rgba(0, 149, 255, 0.2) ${progressPercent}%, transparent ${progressPercent}%)`;
      
      // Add a pulsing effect to the row
      row.classList.add('pulse-animation');
    } else if (fileStatus.status === 'completed') {
      row.style.background = 'rgba(0, 200, 83, 0.2)';
      row.classList.remove('pulse-animation');
    } else if (fileStatus.status === 'error') {
      row.style.background = 'rgba(255, 0, 0, 0.2)';
      row.classList.remove('pulse-animation');
    } else {
      row.style.background = '';
      row.classList.remove('pulse-animation');
    }
    
    // Update the status cell
    const statusCell = row.querySelector('.status-cell');
    if (statusCell) {
      // Keep existing status badges
      const existingBadges = statusCell.querySelectorAll('.badge:not(.extraction-badge)');
      
      // Add or update extraction status badge
      let extractionBadge = statusCell.querySelector('.extraction-badge');
      if (!extractionBadge) {
        extractionBadge = document.createElement('span');
        extractionBadge.className = 'badge extraction-badge ml-2';
        statusCell.appendChild(extractionBadge);
      }
      
      // Update badge based on status
      if (fileStatus.status === 'completed') {
        extractionBadge.className = 'badge badge-success extraction-badge ml-2';
        extractionBadge.textContent = 'Audio Extracted';
      } else if (fileStatus.status === 'in_progress') {
        extractionBadge.className = 'badge badge-info extraction-badge ml-2';
        extractionBadge.textContent = `Extracting ${fileStatus.progress || 0}%`;
        
        // Add a mini progress bar inside the badge
        if (!extractionBadge.querySelector('.mini-progress')) {
          const miniProgress = document.createElement('div');
          miniProgress.className = 'mini-progress ml-1';
          miniProgress.style.width = '30px';
          miniProgress.style.height = '4px';
          miniProgress.style.backgroundColor = 'rgba(255,255,255,0.3)';
          miniProgress.style.borderRadius = '2px';
          miniProgress.style.overflow = 'hidden';
          miniProgress.style.display = 'inline-block';
          miniProgress.style.verticalAlign = 'middle';
          
          const miniProgressFill = document.createElement('div');
          miniProgressFill.className = 'mini-progress-fill';
          miniProgressFill.style.width = `${fileStatus.progress || 0}%`;
          miniProgressFill.style.height = '100%';
          miniProgressFill.style.backgroundColor = 'white';
          
          miniProgress.appendChild(miniProgressFill);
          extractionBadge.appendChild(miniProgress);
        } else {
          const miniProgressFill = extractionBadge.querySelector('.mini-progress-fill');
          if (miniProgressFill) {
            miniProgressFill.style.width = `${fileStatus.progress || 0}%`;
          }
        }
      } else if (fileStatus.status === 'error') {
        extractionBadge.className = 'badge badge-error extraction-badge ml-2';
        extractionBadge.textContent = 'Extraction Error';
        
        // Add retry button for error files
        const actionCell = row.querySelector('td:last-child');
        if (actionCell && !actionCell.querySelector('.retry-button')) {
          const retryButton = document.createElement('button');
          retryButton.textContent = 'Retry';
          retryButton.className = 'btn btn-xs btn-error retry-button ml-2';
          retryButton.addEventListener('click', () => {
            // Reset the file's extraction status
            ipcRenderer.invoke('reset-file-extraction', { fileId })
              .then(() => {
                // Start audio extraction again
                // Find the analyze button and click it
                const analyzeBtn = actionCell.querySelector('button');
                if (analyzeBtn) {
                  analyzeBtn.click();
                } else {
                  // Fallback to starting extraction for the whole series
                  const seriesId = row.dataset.parentIndex;
                  if (seriesId) {
                    startAudioExtraction(parseInt(seriesId));
                  }
                }
              })
              .catch(error => {
                console.error('Error resetting file extraction:', error);
                alert(`Error: ${error.message || 'Unknown error'}`);
              });
          });
          
          actionCell.appendChild(retryButton);
        }
      } else {
        extractionBadge.className = 'badge badge-ghost extraction-badge ml-2';
        extractionBadge.textContent = 'Pending Extraction';
      }
    }
    
    // Update the processing step
    const stepCell = row.querySelector('.step-cell');
    if (stepCell && fileStatus.processingStep) {
      stepCell.textContent = formatProcessingStep(fileStatus.processingStep);
      
      // Add a color indicator based on the processing step
      if (fileStatus.processingStep === 'error') {
        stepCell.className = 'step-cell text-xs text-error';
      } else if (fileStatus.processingStep === 'audio_extracted') {
        stepCell.className = 'step-cell text-xs text-success';
      } else if (fileStatus.processingStep === 'extracting_audio') {
        stepCell.className = 'step-cell text-xs text-info';
      } else {
        stepCell.className = 'step-cell text-xs';
      }
    }
  });
}

// Format processing step for display
function formatProcessingStep(step) {
  switch (step) {
    case 'pending': return 'Pending';
    case 'analyzing_filename': return 'Analyzing Filename';
    case 'filename_analyzed': return 'Filename Analyzed';
    case 'extracting_audio': return 'Extracting Audio';
    case 'audio_extracted': return 'Audio Extracted';
    case 'transcribing_audio': return 'Transcribing Audio';
    case 'audio_transcribed': return 'Audio Transcribed';
    case 'matching_content': return 'Matching Content';
    case 'content_matched': return 'Content Matched';
    case 'error': return 'Error';
    default: return step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

// This function is no longer needed as we've integrated everything into the main table
// Keeping it as a stub for backward compatibility
function displayResults(results) {
  console.log('displayResults is deprecated - results are now shown directly in the table');
  // No longer need to do anything here as results are displayed in the table
}

// This function is no longer needed as we've integrated everything into the main table
// Keeping it as a stub for backward compatibility
function displaySampleResults() {
  console.log('displaySampleResults is deprecated - results are now shown directly in the table');
  // No longer need to do anything here as results are displayed in the table
}

// Expand a directory to show files
function expandDirectory(directory, seriesRow) {
  console.log(`Expanding directory: ${directory}`);
  
  // Get the series ID from the row
  const seriesId = seriesRow.dataset.seriesId;
  console.log(`Series ID from row: ${seriesId}`);
  
  // Find the series object in the seriesList
  const series = seriesList.find(s => s.id === parseInt(seriesId) || s.id === seriesId);
  if (!series) {
    console.error(`No series found with ID ${seriesId}`);
    return;
  }
  
  console.log(`Found series:`, series);
  
  // Find the directory row if we're expanding a subdirectory
  const directoryRow = directory !== series.directory 
    ? document.querySelector(`tr[data-directory-path="${directory}"]`)
    : seriesRow;
  
  if (!directoryRow) {
    console.error(`No row found for directory ${directory}`);
    return;
  }
  
  // Check if we're expanding or collapsing
  const isExpanding = directoryRow.dataset.isExpanded !== 'true';
  directoryRow.dataset.isExpanded = isExpanding ? 'true' : 'false';
  
  // Update the expand icon if it exists
  const expandIcon = directoryRow.querySelector('.expand-icon');
  if (expandIcon) {
    expandIcon.style.transform = isExpanding ? 'rotate(90deg)' : '';
  }
  
  // If we're collapsing, remove all child rows
  if (!isExpanding) {
    // Remove all child rows
    const childRows = document.querySelectorAll(`tr[data-parent-path="${directory}"]`);
    childRows.forEach(row => {
      // If this row is expanded, we need to remove its children too (recursive collapse)
      if (row.dataset.isExpanded === 'true' && row.dataset.directoryPath) {
        const childrenOfChild = document.querySelectorAll(`tr[data-parent-path="${row.dataset.directoryPath}"]`);
        childrenOfChild.forEach(childRow => childRow.remove());
      }
      row.remove();
    });
    return;
  }
  
  // We're expanding - show a loading indicator row
  const loadingRow = document.createElement('tr');
  loadingRow.className = 'loading-row';
  loadingRow.dataset.parentPath = directory;
  
  // Create the loading cell
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 3; // Match the colspan from your table
  loadingCell.className = 'px-4 py-2';
  loadingCell.innerHTML = `
    <div class="flex items-center">
      <span class="loading loading-spinner loading-xs text-primary mr-2"></span>
      <span>Loading...</span>
    </div>
  `;
  
  // Add the loading cell to the row
  loadingRow.appendChild(loadingCell);
  
  // Insert after the directory row
  if (directoryRow.nextSibling) {
    directoryRow.parentNode.insertBefore(loadingRow, directoryRow.nextSibling);
  } else {
    directoryRow.parentNode.appendChild(loadingRow);
  }
  
  // Get the files in the directory
  console.log(`Requesting files for directory: ${directory}`);
  ipcRenderer.invoke('get-directory-files', { directory })
    .then(files => {
      console.log(`Found ${files.length} files in directory: ${directory}`, files);
      
      // Remove the loading row
      loadingRow.remove();
      
      // Separate directories and video files
      const directories = files.filter(file => file.isDirectory);
      const videoFiles = files.filter(file => !file.isDirectory && file.name.match(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i));
      
      // Sort the directories and files
      directories.sort((a, b) => a.name.localeCompare(b.name));
      videoFiles.sort((a, b) => a.name.localeCompare(b.name));
      
      // The indentation level
      const isRootDir = directory === series.directory;
      const indentLevel = isRootDir ? 0 : directory.replace(series.directory, '').split(/[\/\\]/).filter(Boolean).length;
      
      // Process directory rows first
      directories.forEach(dir => {
        const dirRow = createDirectoryRow(dir, series, directoryRow, indentLevel);
        
        // Insert after the directory row (or after the last added row)
        const lastRow = document.querySelector(`tr[data-parent-path="${directory}"]:last-child`) || directoryRow;
        if (lastRow.nextSibling) {
          lastRow.parentNode.insertBefore(dirRow, lastRow.nextSibling);
        } else {
          lastRow.parentNode.appendChild(dirRow);
        }
      });
      
      // Process video files after directories
      videoFiles.forEach((file, fileIndex) => {
        const fileRow = createFileRow(file, fileIndex, series, directoryRow, indentLevel);
        
        // Insert after the last added row
        const lastRow = document.querySelector(`tr[data-parent-path="${directory}"]:last-child`) || directoryRow;
        if (lastRow.nextSibling) {
          lastRow.parentNode.insertBefore(fileRow, lastRow.nextSibling);
        } else {
          lastRow.parentNode.appendChild(fileRow);
        }
      });
      
      // If we have files but no directories, check for analysis results
      if (directories.length === 0 && videoFiles.length > 0) {
        updateFileRowsWithAnalysis(videoFiles, series.id);
      }
    })
    .catch(error => {
      console.error('Error getting directory files:', error);
      loadingRow.innerHTML = `
        <td colspan="3" class="px-4 py-2">
          <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 fixed-size inline-block mr-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Error getting directory files: ${error.message}
          </div>
        </td>
      `;
    });
}

// Helper function to create a directory row
function createDirectoryRow(dir, series, parentRow, indentLevel) {
  const dirRow = document.createElement('tr');
  dirRow.className = 'directory-row hover:bg-base-300 transition-colors cursor-pointer';
  dirRow.dataset.directoryPath = dir.path;
  dirRow.dataset.parentPath = parentRow.dataset.directoryPath || series.directory;
  dirRow.dataset.isExpanded = 'false';
  dirRow.dataset.indentLevel = indentLevel;
  
  // Is this a season directory?
  const seasonMatch = dir.name.match(/season\s*(\d+)/i);
  const isSeason = !!seasonMatch;
  const seasonNumber = isSeason ? parseInt(seasonMatch[1]) : null;
  
  // Title cell with icon and name
  const titleCell = document.createElement('td');
  
  // Create indent based on level
  if (indentLevel > 0) {
    const indentSpan = document.createElement('span');
    indentSpan.className = 'inline-block';
    indentSpan.style.width = `${indentLevel * 1.5}rem`;
    titleCell.appendChild(indentSpan);
  }
  
  // Create folder icon
  const folderIcon = document.createElement('span');
  folderIcon.className = 'text-primary inline-block mr-2';
  folderIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    </svg>
  `;
  titleCell.appendChild(folderIcon);
  
  // Create expand/collapse icon
  const expandIcon = document.createElement('span');
  expandIcon.className = 'expand-icon inline-block mr-2 transition-transform duration-200';
  expandIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  `;
  titleCell.appendChild(expandIcon);
  
  // Add directory name
  const nameSpan = document.createElement('span');
  nameSpan.className = 'font-medium';
  nameSpan.textContent = isSeason ? `Season ${seasonNumber}` : dir.name;
  titleCell.appendChild(nameSpan);
  
  // Status cell
  const statusCell = document.createElement('td');
  statusCell.className = 'text-center';
  
  // Actions cell
  const actionsCell = document.createElement('td');
  actionsCell.className = 'text-right';
  
  // Add cells to row
  dirRow.appendChild(titleCell);
  dirRow.appendChild(statusCell);
  dirRow.appendChild(actionsCell);
  
  // Add click event to expand/collapse
  dirRow.addEventListener('click', () => {
    expandDirectory(dir.path, parentRow);
  });
  
  return dirRow;
}

// Helper function to create a file row
function createFileRow(file, fileIndex, series, parentRow, indentLevel) {
  const fileRow = document.createElement('tr');
  fileRow.className = 'file-row hover:bg-base-200 transition-colors';
  fileRow.dataset.filePath = file.path;
  fileRow.dataset.fileId = fileIndex;
  fileRow.dataset.parentPath = parentRow.dataset.directoryPath || series.directory;
  fileRow.dataset.indentLevel = indentLevel;
  
  // Extract season and episode from filename
  const { season, episode } = extractSeasonEpisode(file.name);
  
  // Title cell with icon and name
  const titleCell = document.createElement('td');
  
  // Create indent based on level
  const indentSpan = document.createElement('span');
  indentSpan.className = 'inline-block';
  indentSpan.style.width = `${(indentLevel + 0.5) * 1.5}rem`; // Extra indent for files
  titleCell.appendChild(indentSpan);
  
  // Create file icon
  const fileIcon = document.createElement('span');
  fileIcon.className = 'text-accent inline-block mr-2';
  fileIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
    </svg>
  `;
  titleCell.appendChild(fileIcon);
  
  // Add filename
  const fileNameSpan = document.createElement('span');
  fileNameSpan.className = 'truncate max-w-xs inline-block';
  fileNameSpan.title = file.name; // Show full name on hover
  fileNameSpan.textContent = file.name;
  titleCell.appendChild(fileNameSpan);
  
  // Add season/episode badge if available
  if (season && episode) {
    const episodeBadge = document.createElement('span');
    episodeBadge.className = 'badge badge-sm badge-ghost ml-2';
    episodeBadge.textContent = `S${season}E${episode}`;
    titleCell.appendChild(episodeBadge);
  }
  
  // Status cell
  const statusCell = document.createElement('td');
  statusCell.className = 'status-cell text-center';
  statusCell.innerHTML = '<span class="badge badge-ghost">Pending Analysis</span>';
  
  // Actions cell
  const actionsCell = document.createElement('td');
  actionsCell.className = 'text-right';
  
  // Add analyze button to file row
  const analyzeBtn = document.createElement('button');
  analyzeBtn.className = 'btn btn-xs btn-primary';
  analyzeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
    Analyze
  `;
  analyzeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent row click
    // TODO: Implement single file analysis
    console.log(`Analyze file: ${file.path}`);
  });
  actionsCell.appendChild(analyzeBtn);
  
  // Add cells to row
  fileRow.appendChild(titleCell);
  fileRow.appendChild(statusCell);
  fileRow.appendChild(actionsCell);
  
  return fileRow;
}

// Update file rows with analysis data
function updateFileRowsWithAnalysis(videoFiles, seriesId) {
  console.log(`Getting analysis for series ${seriesId}`);
  
  // Get analysis results for this series
  ipcRenderer.invoke('get-series-analysis', { seriesId })
    .then(analysis => {
      console.log(`Got analysis for series ${seriesId}:`, analysis);
      if (analysis && analysis.files) {
        // Update status for each file
        document.querySelectorAll('.file-row').forEach(fileRow => {
          const filePath = fileRow.dataset.filePath;
          if (!filePath) return;
          
          // Find the file in the analysis
          const file = videoFiles.find(f => f.path === filePath);
          if (!file) return;
          
          const relativePath = path.relative(analysis.directory, filePath).replace(/\\/g, '/');
          const fileAnalysis = analysis.files.find(f => f.path === relativePath);
          
          if (fileAnalysis) {
            // Update status
            const statusCell = fileRow.querySelector('.status-cell');
            if (statusCell) {
              if (fileAnalysis.status === 'analyzed') {
                statusCell.innerHTML = '<span class="badge badge-success">Analyzed</span>';
              } else if (fileAnalysis.status === 'error') {
                statusCell.innerHTML = '<span class="badge badge-error">Error</span>';
              } else if (fileAnalysis.status === 'processing') {
                statusCell.innerHTML = '<span class="badge badge-warning">Processing</span>';
              }
            }
          }
        });
      }
    })
    .catch(error => {
      console.error('Error getting series analysis:', error);
    });
}

/**
 * Extract season and episode numbers from a filename
 * @param {string} filename - The filename to parse
 * @returns {Object} An object with season and episode properties
 */
function extractSeasonEpisode(filename) {
  // Common patterns:
  // S01E02, s01e02, S1E2, s1e2
  // 1x02, 1X02
  // Season 1 Episode 2, Season1Episode2
  // 101, 1.01 (Season 1, Episode 01)
  
  let season = null;
  let episode = null;
  
  // Try S01E02 pattern (most common)
  const seasonEpisodeMatch = filename.match(/[Ss](\d+)[Ee](\d+)/);
  if (seasonEpisodeMatch) {
    season = parseInt(seasonEpisodeMatch[1]);
    episode = parseInt(seasonEpisodeMatch[2]);
    return { season, episode };
  }
  
  // Try 1x02 pattern
  const xMatch = filename.match(/(\d+)[xX](\d+)/);
  if (xMatch) {
    season = parseInt(xMatch[1]);
    episode = parseInt(xMatch[2]);
    return { season, episode };
  }
  
  // Try "Season 1 Episode 2" pattern
  const textMatch = filename.match(/[Ss]eason\s*(\d+)\s*[Ee]pisode\s*(\d+)/i);
  if (textMatch) {
    season = parseInt(textMatch[1]);
    episode = parseInt(textMatch[2]);
    return { season, episode };
  }
  
  // Try 101 pattern (Season 1, Episode 01)
  const combinedMatch = filename.match(/^(\d)(\d{2})/);
  if (combinedMatch) {
    season = parseInt(combinedMatch[1]);
    episode = parseInt(combinedMatch[2]);
    return { season, episode };
  }
  
  // Try 1.01 pattern
  const dotMatch = filename.match(/^(\d+)\.(\d{2})/);
  if (dotMatch) {
    season = parseInt(dotMatch[1]);
    episode = parseInt(dotMatch[2]);
    return { season, episode };
  }
  
  return { season, episode };
}

/**
 * Extract a title from a file path
 * @param {string} filePath - The file path to parse
 * @returns {string} The extracted title
 */
function extractTitleFromPath(filePath) {
  // Get the last directory name
  const parts = filePath.split(/[\/\\]/);
  return parts[parts.length - 1];
}

// Note: DOM elements are already declared at the top of the file

// Add CSS styles for the tree view
const styleElement = document.createElement('style');
styleElement.textContent = `
  /* Tree view styles */
  .directory-row .expand-icon {
    transition: transform 0.2s ease;
  }
  
  .directory-row[data-is-expanded="true"] .expand-icon {
    transform: rotate(90deg);
  }
  
  /* Indentation for hierarchical tree */
  [data-indent-level] {
    transition: background-color 0.2s ease;
  }
  
  /* Alternating row colors for better readability */
  tr.file-row:nth-child(even) {
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  /* Hover effects */
  .file-row:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .directory-row:hover {
    background-color: rgba(59, 130, 246, 0.1);
  }
  
  /* Badges for episode status */
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }
`;
document.head.appendChild(styleElement);

// Update the table headers
function updateTableHeaders() {
  const seriesTableHeader = document.querySelector('#series-table thead tr');
  if (seriesTableHeader) {
    seriesTableHeader.innerHTML = `
      <th>Name</th>
      <th class="w-32 text-center">Status</th>
      <th class="w-32 text-right">Actions</th>
    `;
  }
}