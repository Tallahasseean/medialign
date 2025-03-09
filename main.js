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

// Get files in a directory
ipcMain.handle('get-directory-files', async (event, { directory }) => {
  try {
    console.log(`Getting files in directory: ${directory}`);
    
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      console.error(`Directory does not exist: ${directory}`);
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Read the directory
    const items = await fs.promises.readdir(directory, { withFileTypes: true });
    
    // Process each item
    const files = items.map(item => {
      try {
        const itemPath = path.join(directory, item.name);
        const stats = fs.statSync(itemPath);
        
        return {
          name: item.name,
          path: itemPath,
          isDirectory: item.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      } catch (itemError) {
        console.error(`Error processing item ${item.name}:`, itemError);
        // Return a minimal object for items we can't fully process
        return {
          name: item.name,
          path: path.join(directory, item.name),
          isDirectory: item.isDirectory(),
          error: itemError.message
        };
      }
    });
    
    console.log(`Found ${files.length} items in directory: ${directory}`);
    return files;
  } catch (error) {
    console.error('Error getting directory files:', error);
    // Include stack trace for better debugging
    console.error(error.stack);
    throw error;
  }
});

// Get analysis results for a series
ipcMain.handle('get-series-analysis', async (event, { seriesId }) => {
  try {
    console.log(`Getting analysis results for series ID: ${seriesId}`);
    
    // Get the analysis results from the processor
    const results = await processor.getSeriesAnalysis(seriesId);
    
    console.log(`Retrieved analysis results for series ID: ${seriesId}`);
    return results;
  } catch (error) {
    console.error('Error getting series analysis:', error);
    throw error;
  }
});

// Get all series from the database
ipcMain.handle('get-all-series', async (event) => {
  try {
    console.log('Getting all series from the database');
    
    // Get all series from the database
    const series = await processor.getAllSeries();
    
    console.log(`Retrieved ${series.length} series from the database`);
    return series;
  } catch (error) {
    console.error('Error getting all series:', error);
    throw error;
  }
});

// Clean up duplicate series in the database
ipcMain.handle('cleanup-duplicate-series', async (event) => {
  try {
    console.log('Cleaning up duplicate series in the database');
    
    // Clean up duplicate series
    const result = await processor.cleanupDuplicateSeries();
    
    console.log(`Cleaned up duplicate series: ${result.removed} series removed`);
    return result;
  } catch (error) {
    console.error('Error cleaning up duplicate series:', error);
    throw error;
  }
});

// Delete a series from the database
ipcMain.handle('delete-series', async (event, { seriesId }) => {
  try {
    console.log(`Deleting series with ID: ${seriesId}`);
    
    // Make sure we have the database module available via processor
    const db = processor.getDatabase();
    
    // Delete the series from the database
    const result = await db.removeSeries(seriesId);
    
    console.log(`Series deleted successfully: ${result.success}`);
    return result;
  } catch (error) {
    console.error('Error deleting series:', error);
    throw error;
  }
});

// Add a new series to the database
ipcMain.handle('add-series', async (event, { directory, name, tmdbId }) => {
  try {
    console.log(`Adding new series: ${name}, Directory: ${directory}, TMDB ID: ${tmdbId}`);
    
    // Validate directory
    if (!fs.existsSync(directory)) {
      console.error(`Directory does not exist: ${directory}`);
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Make sure we have the database module available via processor
    const db = processor.getDatabase();
    
    // Add the series to the database
    const seriesId = await db.addSeries(tmdbId, name, directory);
    
    console.log(`Series added successfully with ID: ${seriesId}`);
    
    // Return the series ID and other details
    return {
      id: seriesId,
      directory,
      name,
      imdb_id: tmdbId,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error adding series:', error);
    throw error;
  }
});

// Handle get-directory-contents request
ipcMain.handle('get-directory-contents', async (event, directoryPath) => {
  try {
    console.log(`Main process: Getting contents of directory: ${directoryPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      console.error(`Directory does not exist: ${directoryPath}`);
      return [];
    }
    
    // Read directory contents
    const items = fs.readdirSync(directoryPath, { withFileTypes: true });
    console.log(`Found ${items.length} items in directory`);
    
    // Convert to array of objects with type, name, and path
    const contents = items.map(item => {
      const itemPath = path.join(directoryPath, item.name);
      const stats = fs.statSync(itemPath);
      
      return {
        type: item.isDirectory() ? 'directory' : 'file',
        name: item.name,
        path: itemPath,
        size: stats.size,
        mtime: stats.mtime.toISOString()
      };
    });
    
    console.log(`Processed ${contents.length} items`);
    return contents;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}); 