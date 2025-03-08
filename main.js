const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const processor = require('./processor');
const axios = require('axios');

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
    
    if (!apiKey) {
      throw new Error('TMDB API key is required');
    }
    
    console.log(`Searching TMDB for: ${title}`);
    
    // This is where you would make an actual API call to TMDB
    // For demonstration purposes, we'll use a mock response
    // In a real application, you'd use axios or another HTTP client
    
    try {
      // Example API call using axios (uncomment and adjust for your actual API)
      /*
      // Headers for the request, including the access token if provided
      const headers = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const response = await axios.get('https://api.themoviedb.org/3/search/tv', {
        params: {
          api_key: apiKey,
          query: title
        },
        headers
      });
      
      const results = response.data.results.map(item => ({
        id: `tt${item.id}`, // Convert TMDB id to IMDB-like format for compatibility
        title: item.name,
        year: item.first_air_date ? item.first_air_date.substring(0, 4) : null
      }));
      */
      
      // Mock response for testing
      const mockResults = [
        { id: 'tt1399', title: 'Game of Thrones', year: '2011' },
        { id: 'tt1520', title: 'The Walking Dead', year: '2010' },
        { id: 'tt0455', title: 'Prison Break', year: '2005' }
      ];
      
      // Simulate search by filtering mock results that include the title (case insensitive)
      const filteredResults = mockResults.filter(
        item => item.title.toLowerCase().includes(title.toLowerCase())
      );
      
      event.reply('tmdb-search-result', filteredResults);
    } catch (apiError) {
      console.error('TMDB API error:', apiError);
      throw new Error(`TMDB API error: ${apiError.message}`);
    }
  } catch (error) {
    console.error('Error searching TMDB:', error);
    event.reply('tmdb-search-result', { error: error.message });
  }
}); 