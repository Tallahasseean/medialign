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
    const { directory, imdbId } = data;
    
    // Validate inputs
    if (!directory || !imdbId) {
      throw new Error('Directory and IMDB ID are required');
    }
    
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }
    
    // Process the series
    const result = await processor.processSeries(directory, imdbId);
    event.reply('analyze-series-result', result);
  } catch (error) {
    console.error('Error analyzing series:', error);
    event.reply('analyze-series-result', { error: error.message });
  }
}); 