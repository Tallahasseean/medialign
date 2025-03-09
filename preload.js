const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Log for debugging
console.log('Preload script executing');

// Create an event emitter for IPC events
const eventEmitter = {
  // Store event listeners
  listeners: {},
  
  // Register an event listener
  on: function(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Set up actual IPC listener for this event if it's the first listener
    if (this.listeners[event].length === 1) {
      ipcRenderer.on(event, (event, ...args) => {
        this.listeners[event].forEach(cb => cb(...args));
      });
    }
  },
  
  // Remove an event listener
  removeListener: function(event, callback) {
    if (!this.listeners[event]) return;
    
    const index = this.listeners[event].indexOf(callback);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC invoke methods
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  analyzeSeries: (directory, tmdbId) => ipcRenderer.invoke('analyze-series', { directory, tmdbId }),
  fixFile: (fileId, episodeId) => ipcRenderer.invoke('fix-file', { fileId, episodeId }),
  getProcessingStatus: (seriesId) => ipcRenderer.invoke('get-processing-status', { seriesId }),
  getDirectoryContents: (directoryPath) => ipcRenderer.invoke('get-directory-contents', directoryPath),
  
  // Path utilities
  path: {
    basename: path.basename,
    dirname: path.dirname,
    join: path.join,
    extname: path.extname
  },
  
  // Event system
  on: (event, callback) => eventEmitter.on(event, callback),
  removeListener: (event, callback) => eventEmitter.removeListener(event, callback)
}); 