// Main entry point for the renderer process

// Import modules
const seriesService = require('./services/seriesService');
const tmdbService = require('./services/tmdbService');
const fileService = require('./services/fileService');
const extractors = require('./utils/extractors');
const uiManager = require('./ui/uiManager');
const tableRenderer = require('./ui/tableRenderer');
const modalManager = require('./ui/modalManager');
const logger = require('./utils/logger');

// Global variables
let currentSeriesId = null;

// Log initialization
console.log('==========================================');
console.log('Renderer script loaded');
console.log('electronAPI available:', !!window.electronAPI);
if (window.electronAPI) {
  console.log('electronAPI methods:', Object.keys(window.electronAPI));
}
console.log('==========================================');

// Initialize the application
async function init() {
  try {
    console.log('Initializing application...');
    
    // Set up IPC listeners
    setupIpcListeners();
    
    // Initialize the UI
    uiManager.initializeUI();
    
    // Load settings
    loadSettings();
    
    // Load series list
    const seriesList = await seriesService.loadSeriesList();
    console.log(`Loaded ${seriesList.length} series from local storage`);
    
    // Render series table
    tableRenderer.renderSeriesTable();
    
    // Set up event listeners for buttons
    setupButtonEventListeners();
    
    console.log('Application initialized');
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

// Set up button event listeners
function setupButtonEventListeners() {
  console.log('Setting up button event listeners...');
  
  // Find all buttons that should have event listeners
  const buttons = {
    addSeries: document.getElementById('add-series-button'),
    settings: document.getElementById('settings-button'),
    browse: document.getElementById('browse-button'),
    analyze: document.getElementById('analyze-button')
  };
  
  // Log button elements found
  Object.entries(buttons).forEach(([key, element]) => {
    if (!element) {
      console.warn(`${key} button not found`);
    } else {
      console.log(`${key} button found`);
    }
  });
  
  // Add Series button
  if (buttons.addSeries) {
    console.log('Adding click listener to Add Series button');
    buttons.addSeries.addEventListener('click', () => {
      console.log('Add Series button clicked');
      const addSeriesModal = document.getElementById('add-series-modal');
      if (addSeriesModal) {
        console.log('Opening Add Series modal');
        addSeriesModal.showModal();
      } else {
        console.error('Add Series modal not found');
      }
    });
  }
  
  // Settings button
  if (buttons.settings) {
    console.log('Adding click listener to Settings button');
    buttons.settings.addEventListener('click', () => {
      console.log('Settings button clicked');
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) {
        console.log('Opening Settings modal');
        settingsModal.showModal();
      } else {
        console.error('Settings modal not found');
      }
    });
  }
  
  // Browse button
  if (buttons.browse) {
    console.log('Adding click listener to Browse button');
    buttons.browse.addEventListener('click', async () => {
      console.log('Browse button clicked');
      try {
        const selectedDirectory = await fileService.selectDirectory();
        const directoryInput = document.getElementById('series-directory');
        if (directoryInput && selectedDirectory) {
          directoryInput.value = selectedDirectory;
          
          // Try to extract title from directory path
          const titleInput = document.getElementById('series-title');
          if (titleInput) {
            titleInput.value = extractors.extractTitleFromPath(selectedDirectory);
          }
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    });
  }
  
  // Analyze button
  if (buttons.analyze) {
    console.log('Adding click listener to Analyze button');
    buttons.analyze.addEventListener('click', () => {
      console.log('Analyze button clicked');
      const directoryInput = document.getElementById('series-directory');
      const titleInput = document.getElementById('series-title');
      const tmdbIdInput = document.getElementById('tmdb-id');
      
      if (directoryInput && titleInput) {
        const directory = directoryInput.value.trim();
        const title = titleInput.value.trim();
        const tmdbId = tmdbIdInput ? tmdbIdInput.value.trim() : '';
        
        if (directory && title) {
          console.log(`Analyzing series: ${title} (${directory})`);
          
          // Create progress container
          const progressContainer = document.getElementById('progress-container');
          if (progressContainer) {
            progressContainer.style.display = 'block';
          }
          
          // Add to series list
          const seriesIndex = seriesService.addSeries({
            directory,
            title,
            tmdbId: tmdbId || null,
            id: Date.now().toString()
          });
          
          // Start audio extraction
          seriesService.startAudioExtraction(seriesIndex);
        } else {
          console.error('Missing directory or title');
          alert('Please enter both a directory and title');
        }
      } else {
        console.error('Directory or title input not found');
      }
    });
  }
  
  console.log('Button event listeners set up');
}

// Set up IPC listeners
function setupIpcListeners() {
  // Directory selection response
  window.electronAPI.on('directory-selected', (result) => {
    console.log('Directory selected:', result);
    
    // Check if we're in the add series modal or the series details
    const addSeriesModal = document.getElementById('add-series-modal');
    const newSeriesDirectory = document.getElementById('new-series-directory');
    const newSeriesTitle = document.getElementById('new-series-title');
    
    if (addSeriesModal && addSeriesModal.open) {
      if (result && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      } else if (result) {
        newSeriesDirectory.value = result;
        // Extract title from directory path
        newSeriesTitle.value = extractors.extractTitleFromPath(result);
      }
    } else {
      if (result && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      }
    }
  });
  
  // Analyze series response
  window.electronAPI.on('analysis-update', (data) => {
    console.log('Analysis update:', data);
    
    if (data.progress) {
      // Update progress bar
      uiManager.updateProgress(data.progress);
    }
    
    if (data.videoFiles && data.seriesId) {
      // Update file rows with analysis results
      fileService.updateFileRowsWithAnalysis(data.videoFiles, data.seriesId);
    }
  });
  
  // Fix file response
  window.electronAPI.on('fix-file-response', (result) => {
    console.log('Fix file response:', result);
    
    if (result.success) {
      // Show success message
      uiManager.showAlert('File fixed successfully', 'success');
      
      // Update file row
      if (result.file && result.seriesId) {
        fileService.updateFileRowsWithAnalysis([result.file], result.seriesId);
      }
    } else {
      // Show error message
      uiManager.showAlert(`Error fixing file: ${result.error}`, 'error');
    }
  });
}

// Load settings from local storage
function loadSettings() {
  // Check if we have TMDB API key and access token
  const tmdbApiKey = localStorage.getItem('tmdbApiKey');
  const tmdbAccessToken = localStorage.getItem('tmdbAccessToken');
  
  console.log('TMDB API Key exists:', !!tmdbApiKey);
  console.log('TMDB Access Token exists:', !!tmdbAccessToken);
  
  if (!tmdbApiKey && !tmdbAccessToken) {
    console.log('No TMDB API key or access token found, showing settings modal');
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
      settingsModal.showModal();
    }
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
  init().catch(error => {
    console.error('Error initializing application:', error);
    alert(`Error initializing application: ${error.message}`);
  });
});

// Make functions available globally for HTML event handlers
window.showSeriesDetails = modalManager.showSeriesDetails;
window.editSeries = modalManager.editSeries;
window.deleteSeries = modalManager.deleteSeries; 