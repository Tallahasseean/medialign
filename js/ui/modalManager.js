// Modal Manager - Handles modal dialogs for the application

// Import dependencies
const seriesService = require('../services/seriesService');
const tmdbService = require('../services/tmdbService');
const fileService = require('../services/fileService');
const extractors = require('../utils/extractors');
const tableRenderer = require('./tableRenderer');

/**
 * Initialize all modal dialogs
 */
function initializeModals() {
  console.log('Initializing modals...');
  
  try {
    // Ensure all modals exist
    const modals = [
      { id: 'settings-modal', name: 'Settings' },
      { id: 'add-series-modal', name: 'Add Series' },
      { id: 'edit-series-modal', name: 'Edit Series' },
      { id: 'details-modal', name: 'Details' }
    ];
    
    modals.forEach(modal => {
      const modalElement = document.getElementById(modal.id);
      if (!modalElement) {
        console.warn(`${modal.name} modal (${modal.id}) not found in the document`);
      } else {
        console.log(`${modal.name} modal found`);
      }
    });
    
    // Settings modal
    initializeSettingsModal();
    
    // Add series modal
    initializeAddSeriesModal();
    
    // Edit series modal
    initializeEditSeriesModal();
    
    console.log('Modals initialized successfully');
  } catch (error) {
    console.error('Error initializing modals:', error);
  }
}

/**
 * Initialize settings modal
 */
function initializeSettingsModal() {
  const settingsButton = document.getElementById('settings-button');
  const settingsModal = document.getElementById('settings-modal');
  const tmdbApiKeyInput = document.getElementById('tmdb-api-key');
  const tmdbAccessTokenInput = document.getElementById('tmdb-access-token');
  const cancelSettingsButton = document.getElementById('cancel-settings');
  const saveSettingsButton = document.getElementById('save-settings');
  
  if (!settingsModal) {
    console.error('Settings modal element not found');
    return;
  }
  
  if (!tmdbApiKeyInput) console.warn('TMDB API key input not found');
  if (!tmdbAccessTokenInput) console.warn('TMDB access token input not found');
  
  // Load settings
  if (tmdbApiKeyInput) tmdbApiKeyInput.value = localStorage.getItem('tmdbApiKey') || '';
  if (tmdbAccessTokenInput) tmdbAccessTokenInput.value = localStorage.getItem('tmdbAccessToken') || '';
  
  // Open settings modal
  if (settingsButton) {
    console.log('Adding click listener to settings button');
    settingsButton.addEventListener('click', () => {
      console.log('Settings button clicked, opening modal');
      settingsModal.showModal();
    });
  } else {
    console.warn('Settings button not found');
  }
  
  // Cancel settings
  if (cancelSettingsButton) {
    cancelSettingsButton.addEventListener('click', () => {
      console.log('Canceling settings changes');
      settingsModal.close();
    });
  } else {
    console.warn('Cancel settings button not found');
  }
  
  // Save settings
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', () => {
      console.log('Saving settings');
      // Save settings to local storage
      if (tmdbApiKeyInput) localStorage.setItem('tmdbApiKey', tmdbApiKeyInput.value);
      if (tmdbAccessTokenInput) localStorage.setItem('tmdbAccessToken', tmdbAccessTokenInput.value);
      
      // Close modal
      settingsModal.close();
    });
  } else {
    console.warn('Save settings button not found');
  }
  
  console.log('Settings modal initialized');
}

/**
 * Initialize add series modal
 */
function initializeAddSeriesModal() {
  const addSeriesButton = document.getElementById('add-series-button');
  const addSeriesModal = document.getElementById('add-series-modal');
  
  if (!addSeriesModal) {
    console.error('Add series modal not found');
    return;
  }
  
  console.log('Add series modal found');
  
  // Find all elements for the add series modal
  const elements = {
    directory: document.getElementById('new-series-directory'),
    title: document.getElementById('new-series-title'),
    browse: document.getElementById('new-browse-button'),
    lookup: document.getElementById('new-lookup-button'),
    tmdbId: document.getElementById('new-tmdb-id'),
    results: document.getElementById('new-tmdb-results'),
    resultsList: document.getElementById('new-results-list'),
    cancel: document.getElementById('cancel-add-series'),
    confirm: document.getElementById('confirm-add-series')
  };
  
  // Log missing elements
  Object.entries(elements).forEach(([key, element]) => {
    if (!element) console.warn(`Add series modal: ${key} element not found`);
  });
  
  // Open add series modal
  if (addSeriesButton) {
    console.log('Adding click listener to add series button');
    addSeriesButton.addEventListener('click', () => {
      console.log('Add series button clicked, opening modal');
      
      // Reset fields
      if (elements.directory) elements.directory.value = '';
      if (elements.title) elements.title.value = '';
      if (elements.tmdbId) elements.tmdbId.value = '';
      if (elements.results) elements.results.classList.add('hidden');
      if (elements.resultsList) elements.resultsList.innerHTML = '';
      
      // Show modal
      addSeriesModal.showModal();
    });
  } else {
    console.warn('Add series button not found');
  }
  
  // Browse button in add series modal
  if (elements.browse && elements.directory && elements.title) {
    elements.browse.addEventListener('click', async () => {
      try {
        console.log('Browsing for directory in add series modal');
        const selectedDirectory = await fileService.selectDirectory();
        if (selectedDirectory) {
          elements.directory.value = selectedDirectory;
          
          // Extract title from directory path
          const title = extractors.extractTitleFromPath(selectedDirectory);
          elements.title.value = title;
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    });
  }
  
  // Lookup button in add series modal
  if (elements.lookup && elements.title && elements.resultsList && elements.results && elements.tmdbId) {
    elements.lookup.addEventListener('click', async () => {
      const title = elements.title.value.trim();
      
      if (!title) {
        alert('Please enter a series title to search');
        return;
      }
      
      try {
        // Show loading state
        elements.lookup.disabled = true;
        elements.lookup.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        
        // Search TMDB
        const results = await tmdbService.searchTmdb(title);
        
        // Display results
        displaySearchResults(results, elements.resultsList, elements.results, elements.tmdbId);
      } catch (error) {
        console.error('Error searching TMDB:', error);
        alert(`Error searching TMDB: ${error.message}`);
      } finally {
        // Restore button state
        elements.lookup.disabled = false;
        elements.lookup.innerHTML = '<i class="fas fa-search"></i> Search';
      }
    });
  }
  
  // Cancel add series
  if (elements.cancel) {
    elements.cancel.addEventListener('click', () => {
      console.log('Canceling add series');
      addSeriesModal.close();
    });
  }
  
  // Confirm add series
  if (elements.confirm && elements.directory && elements.title && elements.tmdbId) {
    elements.confirm.addEventListener('click', () => {
      const directory = elements.directory.value.trim();
      const title = elements.title.value.trim();
      const tmdbId = elements.tmdbId.value.trim();
      
      if (!directory) {
        alert('Please select a directory');
        return;
      }
      
      if (!title) {
        alert('Please enter a series title');
        return;
      }
      
      console.log(`Adding new series: ${title} (${directory})`);
      
      // Add series to list
      const newSeries = {
        directory,
        title,
        tmdbId: tmdbId || null,
        id: Date.now().toString() // Generate a unique ID
      };
      
      seriesService.addSeries(newSeries);
      
      // Close modal
      addSeriesModal.close();
      
      // Refresh series table
      tableRenderer.renderSeriesTable();
    });
  }
  
  console.log('Add series modal initialized');
}

/**
 * Initialize edit series modal
 */
function initializeEditSeriesModal() {
  const editSeriesModal = document.getElementById('edit-series-modal');
  const editSeriesDirectory = document.getElementById('edit-series-directory');
  const editSeriesTitle = document.getElementById('edit-series-title');
  const editBrowseButton = document.getElementById('edit-browse-button');
  const editLookupButton = document.getElementById('edit-lookup-button');
  const editTmdbId = document.getElementById('edit-tmdb-id');
  const editTmdbResults = document.getElementById('edit-tmdb-results');
  const editResultsList = document.getElementById('edit-results-list');
  const cancelEditSeries = document.getElementById('cancel-edit-series');
  const confirmEditSeries = document.getElementById('confirm-edit-series');
  
  if (!editSeriesModal) {
    console.error('Edit series modal not found');
    return;
  }
  
  // Browse button in edit series modal
  if (editBrowseButton && editSeriesDirectory && editSeriesTitle) {
    editBrowseButton.addEventListener('click', async () => {
      try {
        console.log('Browsing for directory in edit series modal');
        const selectedDirectory = await fileService.selectDirectory();
        if (selectedDirectory) {
          editSeriesDirectory.value = selectedDirectory;
          
          // Extract title from directory path
          const title = extractors.extractTitleFromPath(selectedDirectory);
          editSeriesTitle.value = title;
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    });
  }
  
  // Lookup button in edit series modal
  if (editLookupButton && editSeriesTitle && editResultsList && editTmdbResults && editTmdbId) {
    editLookupButton.addEventListener('click', async () => {
      const title = editSeriesTitle.value.trim();
      
      if (!title) {
        alert('Please enter a series title to search');
        return;
      }
      
      try {
        // Show loading state
        editLookupButton.disabled = true;
        editLookupButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        
        // Search TMDB
        const results = await tmdbService.searchTmdb(title);
        
        // Display results
        displaySearchResults(results, editResultsList, editTmdbResults, editTmdbId);
      } catch (error) {
        console.error('Error searching TMDB:', error);
        alert(`Error searching TMDB: ${error.message}`);
      } finally {
        // Restore button state
        editLookupButton.disabled = false;
        editLookupButton.innerHTML = '<i class="fas fa-search"></i> Search';
      }
    });
  }
  
  // Cancel edit series
  if (cancelEditSeries) {
    cancelEditSeries.addEventListener('click', () => {
      console.log('Canceling edit series');
      editSeriesModal.close();
    });
  }
  
  console.log('Edit series modal initialized');
}

/**
 * Display search results in a list
 * @param {Array} results - Search results from TMDB
 * @param {HTMLElement} resultsListElement - Element to display results in
 * @param {HTMLElement} resultsContainer - Container to show/hide
 * @param {HTMLElement} tmdbIdInput - Input to set TMDB ID
 */
function displaySearchResults(results, resultsListElement, resultsContainer, tmdbIdInput) {
  if (!resultsListElement || !resultsContainer || !tmdbIdInput) {
    console.error('Missing elements for displaying search results');
    return;
  }
  
  resultsListElement.innerHTML = '';
  
  if (!results || results.length === 0) {
    resultsListElement.innerHTML = '<li class="p-3 text-center">No results found</li>';
    resultsContainer.classList.remove('hidden');
    return;
  }
  
  console.log(`Displaying ${results.length} search results`);
  
  results.forEach(show => {
    const li = document.createElement('li');
    li.className = 'result-item p-3 border-b hover:bg-gray-100 cursor-pointer flex items-center';
    
    const posterUrl = show.poster_path 
      ? `https://image.tmdb.org/t/p/w92${show.poster_path}` 
      : 'https://via.placeholder.com/92x138?text=No+Image';
    
    const year = show.first_air_date 
      ? new Date(show.first_air_date).getFullYear() 
      : 'Unknown';
    
    li.innerHTML = `
      <img src="${posterUrl}" alt="${show.name}" class="w-12 h-18 object-cover mr-3">
      <div>
        <h3 class="font-medium">${show.name} (${year})</h3>
        <p class="text-sm text-gray-600">${show.overview ? show.overview.substring(0, 100) + '...' : 'No overview available'}</p>
      </div>
    `;
    
    li.addEventListener('click', () => {
      tmdbIdInput.value = show.id;
      
      // Highlight the selected item
      document.querySelectorAll('.result-item').forEach(item => {
        item.classList.remove('bg-blue-50', 'border-blue-300');
      });
      
      li.classList.add('bg-blue-50', 'border-blue-300');
    });
    
    resultsListElement.appendChild(li);
  });
  
  resultsContainer.classList.remove('hidden');
}

/**
 * Show series details modal
 * @param {number} index - Series index
 */
function showSeriesDetails(index) {
  try {
    console.log(`Showing details for series at index ${index}`);
    const series = seriesService.getSeriesByIndex(index);
    if (!series) {
      console.error(`Series not found at index ${index}`);
      return;
    }
    
    const seriesDetails = document.getElementById('series-details');
    if (!seriesDetails) {
      console.error('Series details element not found');
      return;
    }
    
    seriesDetails.innerHTML = `
      <div class="p-4">
        <h2 class="text-xl font-bold mb-4">${series.title}</h2>
        <div class="mb-4">
          <p><strong>Directory:</strong> ${series.directory}</p>
          <p><strong>TMDB ID:</strong> ${series.tmdbId || 'N/A'}</p>
        </div>
        <button id="close-details" class="btn btn-primary">Close</button>
      </div>
    `;
    
    // Show modal
    const detailsModal = document.getElementById('details-modal');
    if (detailsModal) {
      detailsModal.showModal();
      
      // Close button
      const closeButton = document.getElementById('close-details');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          detailsModal.close();
        });
      }
    }
  } catch (error) {
    console.error('Error showing series details:', error);
  }
}

/**
 * Edit a series
 * @param {number} index - Series index
 */
function editSeries(index) {
  try {
    console.log(`Editing series at index ${index}`);
    const series = seriesService.getSeriesByIndex(index);
    if (!series) {
      console.error(`Series not found at index ${index}`);
      return;
    }
    
    const editSeriesModal = document.getElementById('edit-series-modal');
    const editSeriesDirectory = document.getElementById('edit-series-directory');
    const editSeriesTitle = document.getElementById('edit-series-title');
    const editTmdbId = document.getElementById('edit-tmdb-id');
    const editTmdbResults = document.getElementById('edit-tmdb-results');
    const editResultsList = document.getElementById('edit-results-list');
    const confirmEditSeries = document.getElementById('confirm-edit-series');
    
    if (!editSeriesModal || !editSeriesDirectory || !editSeriesTitle || !editTmdbId) {
      console.error('Edit series modal elements not found');
      return;
    }
    
    // Set current values
    editSeriesDirectory.value = series.directory || '';
    editSeriesTitle.value = series.title || '';
    editTmdbId.value = series.tmdbId || '';
    
    if (editTmdbResults) editTmdbResults.classList.add('hidden');
    if (editResultsList) editResultsList.innerHTML = '';
    
    // Store the series index
    editSeriesModal.dataset.seriesIndex = index;
    
    // Set up confirm edit button
    if (confirmEditSeries) {
      confirmEditSeries.onclick = () => {
        console.log(`Confirming edit for series at index ${index}`);
        const updatedSeries = {
          ...series,
          directory: editSeriesDirectory.value.trim(),
          title: editSeriesTitle.value.trim(),
          tmdbId: editTmdbId.value.trim() || null
        };
        
        seriesService.updateSeries(index, updatedSeries);
        
        // Close modal
        editSeriesModal.close();
        
        // Refresh series table
        tableRenderer.renderSeriesTable();
      };
    }
    
    // Show modal
    editSeriesModal.showModal();
  } catch (error) {
    console.error('Error editing series:', error);
  }
}

/**
 * Delete a series
 * @param {number} index - Series index
 */
function deleteSeries(index) {
  try {
    console.log(`Deleting series at index ${index}`);
    const series = seriesService.getSeriesByIndex(index);
    if (!series) {
      console.error(`Series not found at index ${index}`);
      return;
    }
    
    const confirmDelete = confirm(`Are you sure you want to delete "${series.title}"? This will not delete any files on disk.`);
    
    if (confirmDelete) {
      seriesService.deleteSeries(index);
      tableRenderer.renderSeriesTable();
    }
  } catch (error) {
    console.error('Error deleting series:', error);
  }
}

module.exports = {
  initializeModals,
  displaySearchResults,
  showSeriesDetails,
  editSeries,
  deleteSeries
}; 