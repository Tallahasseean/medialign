const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const processor = require('./processor');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  initialize();
});

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
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

// Process a TV series
ipcMain.handle('analyze-series', async (event, { directory, imdbId }) => {
  try {
    // Validate inputs
    if (!directory || !imdbId) {
      throw new Error('Directory and IMDB ID are required');
    }
    
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Process the series
    return await processor.processSeries(directory, imdbId);
  } catch (error) {
    console.error('Error analyzing series:', error);
    throw error;
  }
}); 