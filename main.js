const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const processor = require('./processor');
const axios = require('axios');
const tmdbApi = require('./tmdb-api');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
    console.log('DevTools opened');
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  console.log('Window created');
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  initialize();
});

// Initialize the application
async function initialize() {
  try {
    // Initialize the processor
    await processor.initialize();
    console.log('Processor initialized');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Clean up resources before quitting
app.on('will-quit', async (event) => {
  try {
    await processor.cleanup();
    console.log('Application cleanup complete');
  } catch (error) {
    console.error('Error cleaning up application:', error);
  }
});

// IPC handlers for communication with renderer process
ipcMain.on('select-directory', async (event) => {
  console.log('select-directory called in main process');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    console.log('Dialog result:', result);
    
    if (!result.canceled) {
      event.reply('directory-selected', result.filePaths[0]);
    } else {
      event.reply('directory-selected', null);
    }
  } catch (error) {
    console.error('Error in select-directory:', error);
    event.reply('directory-selected', { error: error.message });
  }
});

// Process a TV series
ipcMain.on('analyze-series', async (event, data) => {
  try {
    const { directory, tmdbId, apiKey, accessToken } = data;
    
    // Validate inputs
    if (!directory) {
      throw new Error('Directory is required');
    }
    
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Process the series
    const result = await processor.processSeries(directory, tmdbId, apiKey, accessToken);
    event.reply('analyze-series-result', result);
  } catch (error) {
    console.error('Error analyzing series:', error);
    event.reply('analyze-series-result', { error: error.message });
  }
});

// Search TMDB for TV shows
ipcMain.on('search-tmdb', async (event, data) => {
  try {
    const { title, apiKey, accessToken } = data;
    
    // Validate inputs
    if (!title) {
      throw new Error('Title is required');
    }
    
    if (!apiKey && !accessToken) {
      throw new Error('Either TMDB API key or Read Access Token is required');
    }
    
    console.log(`Searching TMDB for: ${title}`);
    
    try {
      // Use our tmdb-api module to search
      const results = await tmdbApi.searchSeries(title, apiKey, accessToken);
      
      // Format results for the UI
      const formattedResults = results.map(item => ({
        id: item.id.toString(), // Convert to string for consistency
        tmdbId: item.id,
        title: item.title,
        year: item.year,
        overview: item.overview,
        poster: item.poster,
        popularity: item.popularity,
        voteAverage: item.voteAverage
      }));
      
      // Sort by popularity (highest first)
      formattedResults.sort((a, b) => b.popularity - a.popularity);
      
      // Return top 10 results
      event.reply('tmdb-search-result', formattedResults.slice(0, 10));
    } catch (apiError) {
      console.error('TMDB API error:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('Error searching TMDB:', error);
    event.reply('tmdb-search-result', { error: error.message });
  }
});

// Validate TMDB credentials
ipcMain.handle('validate-tmdb-credentials', async (event, { apiKey, accessToken }) => {
  try {
    // Validate credentials with our tmdb-api module
    await tmdbApi.validateCredentials(apiKey, accessToken);
    return { valid: true };
  } catch (error) {
    console.error('TMDB credential validation error:', error);
    return { 
      valid: false, 
      error: error.message || 'Unknown error'
    };
  }
}); 