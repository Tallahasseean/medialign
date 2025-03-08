const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Log for debugging
console.log('Preload script executing');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  analyzeSeries: (directory, imdbId) => ipcRenderer.invoke('analyze-series', { directory, imdbId }),
  fixFile: (fileId, episodeId) => ipcRenderer.invoke('fix-file', { fileId, episodeId }),
  getProcessingStatus: (seriesId) => ipcRenderer.invoke('get-processing-status', { seriesId }),
  path: {
    basename: path.basename,
    dirname: path.dirname,
    join: path.join,
    extname: path.extname
  }
}); 