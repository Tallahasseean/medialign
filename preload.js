const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Directory selection
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    
    // Series processing
    analyzeSeries: (directory, imdbId) => 
      ipcRenderer.invoke('analyze-series', { directory, imdbId }),
    
    // File operations
    fixFile: (fileId, episodeId) => 
      ipcRenderer.invoke('fix-file', { fileId, episodeId }),
    
    // Status operations
    getProcessingStatus: (seriesId) => 
      ipcRenderer.invoke('get-processing-status', { seriesId })
  }
); 