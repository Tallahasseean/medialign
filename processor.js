const path = require('path');
const db = require('./database');
const tmdbApi = require('./tmdb-api');
const fileScanner = require('./file-scanner');
const audioProcessor = require('./audio-processor');
const speechToText = require('./speech-to-text');
const textMatcher = require('./text-matcher');
const { ipcMain } = require('electron');
const { Worker } = require('worker_threads');
const os = require('os');
const fs = require('fs');

// Track active extraction workers
const activeWorkers = new Map();
// Track series being processed
let currentlyProcessingSeries = null;

// Initialize the processor
async function initialize() {
  try {
    console.log('Initializing database...');
    await db.initDatabase();
    console.log('Database initialized successfully');
    
    // Clear expired cache entries
    await db.clearExpiredCache();
    console.log('Cleared expired cache entries');
    
    // Set up IPC handlers
    setupIpcHandlers();
    console.log('IPC handlers set up');
    
    // Set up audio progress listener
    audioProcessor.progressEmitter.on('progress', async (progressData) => {
      // Find the file ID from the video path
      const fileId = activeWorkers.get(progressData.videoPath);
      if (fileId) {
        await db.updateAudioExtractionStatus(fileId, 'in_progress', progressData.overallProgress);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing processor:', error);
    // Try to recover by setting up IPC handlers anyway
    try {
      setupIpcHandlers();
      console.log('IPC handlers set up despite database error');
    } catch (handlerError) {
      console.error('Error setting up IPC handlers:', handlerError);
    }
    return false;
  }
}

// Set up IPC handlers for renderer process communication
function setupIpcHandlers() {
  // Process a TV series
  ipcMain.handle('process-series', async (event, { directory, tmdbId, apiKey, accessToken }) => {
    try {
      return await processSeries(directory, tmdbId, apiKey, accessToken);
    } catch (error) {
      console.error('Error processing series:', error);
      throw error;
    }
  });
  
  // Fix a misnamed file
  ipcMain.handle('fix-file', async (event, { fileId, episodeId }) => {
    try {
      return await fixFile(fileId, episodeId);
    } catch (error) {
      console.error('Error fixing file:', error);
      throw error;
    }
  });
  
  // Get processing status
  ipcMain.handle('get-processing-status', async (event, { seriesId }) => {
    try {
      return await db.getProcessingSummary(seriesId);
    } catch (error) {
      console.error('Error getting processing status:', error);
      throw error;
    }
  });
  
  // Get episode details
  ipcMain.handle('get-episode-details', async (event, { tmdbId, seasonNumber, episodeNumber, apiKey, accessToken }) => {
    try {
      return await tmdbApi.getEpisodeDetails(tmdbId, seasonNumber, episodeNumber, apiKey, accessToken);
    } catch (error) {
      console.error('Error getting episode details:', error);
      throw error;
    }
  });
  
  // Extract audio for a series
  ipcMain.handle('extract-audio', async (event, { seriesId }) => {
    try {
      // Check if already processing this series
      if (currentlyProcessingSeries === seriesId) {
        return { status: 'already_processing' };
      }
      
      // Start audio extraction in the background
      extractAudioForSeries(seriesId);
      
      return { status: 'started' };
    } catch (error) {
      console.error('Error starting audio extraction:', error);
      throw error;
    }
  });
  
  // Reset file extraction status
  ipcMain.handle('reset-file-extraction', async (event, { fileId }) => {
    try {
      console.log(`Resetting extraction status for file ID ${fileId}`);
      
      // Reset the file's extraction status
      await db.updateAudioExtractionStatus(fileId, 'pending', 0);
      await db.updateFileProcessingStep(fileId, 'pending');
      
      // Get the file to remove it from active workers if needed
      const file = await db.getFile(fileId);
      if (file && activeWorkers.has(file.original_path)) {
        activeWorkers.delete(file.original_path);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error resetting file extraction status for file ID ${fileId}:`, error);
      throw error;
    }
  });
  
  // Get audio extraction status
  ipcMain.handle('get-audio-extraction-status', async (event, { seriesId }) => {
    try {
      const files = await db.getFiles(seriesId);
      
      // Calculate overall progress
      const totalFiles = files.length;
      const completedFiles = files.filter(f => f.audio_extraction_status === 'completed').length;
      const inProgressFiles = files.filter(f => f.audio_extraction_status === 'in_progress').length;
      const pendingFiles = files.filter(f => f.audio_extraction_status === 'pending').length;
      const errorFiles = files.filter(f => f.audio_extraction_status === 'error').length;
      
      // Calculate overall progress percentage
      let overallProgress = 0;
      if (totalFiles > 0) {
        // Count completed files as 100%, in-progress files by their progress percentage
        const progressSum = completedFiles * 100 + 
          files.filter(f => f.audio_extraction_status === 'in_progress')
            .reduce((sum, file) => sum + (file.audio_extraction_progress || 0), 0);
        
        overallProgress = Math.round(progressSum / totalFiles);
      }
      
      return {
        totalFiles,
        completedFiles,
        inProgressFiles,
        pendingFiles,
        errorFiles,
        overallProgress,
        isProcessing: currentlyProcessingSeries === seriesId,
        files: files.map(f => ({
          id: f.id,
          filename: f.original_filename,
          status: f.audio_extraction_status,
          progress: f.audio_extraction_progress,
          processingStep: f.processing_step
        }))
      };
    } catch (error) {
      console.error('Error getting audio extraction status:', error);
      throw error;
    }
  });
  
  // Update settings
  ipcMain.handle('update-setting', async (event, { key, value }) => {
    try {
      await db.updateSetting(key, value);
      return { success: true };
    } catch (error) {
      console.error(`Error updating setting ${key}:`, error);
      throw error;
    }
  });
  
  // Get settings
  ipcMain.handle('get-setting', async (event, { key }) => {
    try {
      const value = await db.getSetting(key);
      return { key, value };
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      throw error;
    }
  });
}

/**
 * Process a TV series
 * @param {string} directory - Path to the TV series directory
 * @param {string} tmdbId - TMDB ID of the TV series
 * @param {string} [apiKey] - TMDB API key
 * @param {string} [accessToken] - TMDB access token
 * @returns {Promise<Object>} - Processing results
 */
async function processSeries(directory, tmdbId, apiKey, accessToken) {
  try {
    // Step 1: Get series info from TMDB
    const seriesInfo = await tmdbApi.getSeriesInfo(tmdbId, apiKey, accessToken);
    console.log(`Processing series: ${seriesInfo.title}`);
    
    // Step 2: Add series to database
    const seriesId = await db.addSeries(tmdbId, seriesInfo.title, directory);
    
    // Step 3: Get all episodes from TMDB
    const episodes = await tmdbApi.getAllEpisodes(tmdbId, apiKey, accessToken);
    console.log(`Found ${episodes.length} episodes for ${seriesInfo.title}`);
    
    // Step 4: Add episodes to database
    for (const episode of episodes) {
      await db.addEpisode(
        seriesId,
        episode.seasonNumber,
        episode.episodeNumber,
        episode.title,
        episode.plot || '',
        episode.tmdbId || episode.id
      );
    }
    
    // Step 5: Scan directory for video files
    const videoFiles = await fileScanner.scanDirectory(directory);
    console.log(`Found ${videoFiles.length} video files in ${directory}`);
    
    // Step 6: Add files to database
    for (const filePath of videoFiles) {
      const fileName = path.basename(filePath);
      await db.addFile(seriesId, filePath, fileName);
    }
    
    // Step 7: Process each file
    const dbEpisodes = await db.getEpisodes(seriesId);
    const files = await db.getFiles(seriesId);
    
    for (const file of files) {
      await processFile(file, dbEpisodes);
    }
    
    // Step 8: Automatically start audio extraction
    // Start in the background so we don't block the response
    setTimeout(() => {
      extractAudioForSeries(seriesId)
        .catch(error => console.error(`Background audio extraction error: ${error.message}`));
    }, 100);
    
    // Step 9: Return processing summary and files with extraction status
    const summary = await db.getProcessingSummary(seriesId);
    const updatedFiles = await db.getFiles(seriesId);
    
    return {
      ...summary,
      files: updatedFiles
    };
  } catch (error) {
    console.error('Error processing series:', error);
    throw error;
  }
}

/**
 * Extract audio for all files in a series
 * @param {number} seriesId - Series ID
 * @returns {Promise<void>}
 */
async function extractAudioForSeries(seriesId) {
  try {
    // Set the current processing series
    currentlyProcessingSeries = seriesId;
    
    // Get max concurrent processes from settings
    let maxProcesses = await db.getSetting('max_extraction_processes');
    maxProcesses = maxProcesses ? parseInt(maxProcesses) : Math.max(1, Math.floor(os.cpus().length / 2));
    
    console.log(`Starting audio extraction for series ${seriesId} with ${maxProcesses} concurrent processes`);
    
    // Get all files for the series
    const files = await db.getFiles(seriesId);
    
    // Process files in batches
    const pendingFiles = files.filter(f => 
      f.audio_extraction_status === 'pending' || 
      f.audio_extraction_status === 'in_progress'
    );
    
    console.log(`Found ${pendingFiles.length} files pending audio extraction`);
    
    // Process files in batches of maxProcesses
    for (let i = 0; i < pendingFiles.length; i += maxProcesses) {
      const batch = pendingFiles.slice(i, i + maxProcesses);
      
      // Process batch concurrently
      await Promise.all(batch.map(file => extractAudioForFile(file)));
      
      console.log(`Completed batch ${Math.floor(i / maxProcesses) + 1} of ${Math.ceil(pendingFiles.length / maxProcesses)}`);
    }
    
    console.log(`Audio extraction completed for series ${seriesId}`);
    currentlyProcessingSeries = null;
  } catch (error) {
    console.error(`Error extracting audio for series ${seriesId}:`, error);
    currentlyProcessingSeries = null;
    throw error;
  }
}

/**
 * Extract audio for a single file
 * @param {Object} file - File object from database
 * @returns {Promise<void>}
 */
async function extractAudioForFile(file) {
  try {
    console.log(`Extracting audio for file: ${file.original_filename}`);
    
    // Skip if already completed
    if (file.audio_extraction_status === 'completed') {
      console.log(`Audio already extracted for file: ${file.original_filename}`);
      return;
    }
    
    // Update status to in_progress
    await db.updateAudioExtractionStatus(file.id, 'in_progress', 0);
    await db.updateFileProcessingStep(file.id, 'extracting_audio');
    
    // Track this file in active workers
    activeWorkers.set(file.original_path, file.id);
    
    // Check if file exists
    if (!fs.existsSync(file.original_path)) {
      console.error(`File not found: ${file.original_path}`);
      await db.updateAudioExtractionStatus(file.id, 'error', 0);
      await db.updateFileProcessingStep(file.id, 'error');
      activeWorkers.delete(file.original_path);
      return;
    }
    
    // Create a progress callback that updates the database
    const progressCallback = async (progress) => {
      console.log(`File ${file.original_filename} extraction progress: ${progress}%`);
      await db.updateAudioExtractionStatus(file.id, 'in_progress', progress);
    };
    
    // Extract audio segments
    const segments = await audioProcessor.extractAudioSegments(
      file.original_path, 
      [], // Use default segments
      progressCallback
    );
    
    // If no segments were extracted, mark as error
    if (!segments || segments.length === 0) {
      console.error(`No audio segments extracted for file: ${file.original_filename}`);
      await db.updateAudioExtractionStatus(file.id, 'error', 0);
      await db.updateFileProcessingStep(file.id, 'error');
      activeWorkers.delete(file.original_path);
      return;
    }
    
    // Save audio segments to database
    for (const segment of segments) {
      await db.saveAudioSegment(
        file.id,
        segment.segmentNumber,
        segment.start,
        segment.duration,
        segment.buffer
      );
    }
    
    // Update status to completed
    await db.updateAudioExtractionStatus(file.id, 'completed', 100);
    await db.updateFileProcessingStep(file.id, 'audio_extracted');
    
    // Clean up temporary files
    await audioProcessor.cleanupAudioFiles(segments.map(s => s.path));
    
    // Remove from active workers
    activeWorkers.delete(file.original_path);
    
    console.log(`Audio extraction completed for file: ${file.original_filename}`);
  } catch (error) {
    console.error(`Error extracting audio for file ${file.original_filename}:`, error);
    
    // Update status to error
    await db.updateAudioExtractionStatus(file.id, 'error', 0);
    await db.updateFileProcessingStep(file.id, 'error');
    
    // Remove from active workers
    activeWorkers.delete(file.original_path);
  }
}

/**
 * Process a single file
 * @param {Object} file - File object from database
 * @param {Array<Object>} episodes - Array of episode objects from database
 * @returns {Promise<void>}
 */
async function processFile(file, episodes) {
  try {
    console.log(`Processing file: ${file.original_filename}`);
    
    // Update processing step
    await db.updateFileProcessingStep(file.id, 'analyzing_filename');
    
    // Extract season and episode from filename
    const extractedInfo = fileScanner.extractEpisodeInfo(file.original_filename);
    
    // Find matching episode by season and episode number
    const matchingEpisode = extractedInfo ? 
      episodes.find(e => 
        e.season_number === extractedInfo.season && 
        e.episode_number === extractedInfo.episode
      ) : null;
    
    if (matchingEpisode) {
      // Filename matches an episode, mark as correct
      await db.updateFileStatus(
        file.id,
        matchingEpisode.id,
        'correct',
        null,
        1.0,
        1
      );
      console.log(`File ${file.original_filename} is correctly named`);
    } else {
      // Filename doesn't match, will need audio analysis
      await db.updateFileStatus(
        file.id,
        null,
        'pending',
        null,
        0,
        0
      );
      console.log(`File ${file.original_filename} needs audio analysis`);
    }
    
    // Update processing step
    await db.updateFileProcessingStep(file.id, 'filename_analyzed');
  } catch (error) {
    console.error(`Error processing file ${file.original_filename}:`, error);
    
    // Update file status to error
    await db.updateFileStatus(
      file.id,
      null,
      'error',
      null,
      0,
      0 // isCorrect = false
    );
    
    // Update processing step
    await db.updateFileProcessingStep(file.id, 'error');
  }
}

/**
 * Fix a misnamed file
 * @param {number} fileId - File ID
 * @param {number} episodeId - Episode ID
 * @returns {Promise<Object>} - Result of the fix operation
 */
async function fixFile(fileId, episodeId) {
  try {
    // Get file and episode details
    const file = await db.getFile(fileId);
    const episode = await db.getEpisode(episodeId);
    
    if (!file || !episode) {
      throw new Error('File or episode not found');
    }
    
    // Generate new filename
    const newFilename = fileScanner.generateFilename(file.original_path, {
      season: episode.season_number,
      episode: episode.episode_number,
      title: episode.title
    });
    
    // Rename the file
    const newPath = await fileScanner.renameFile(file.original_path, newFilename);
    
    // Update database
    await db.updateFileStatus(
      fileId,
      episodeId,
      'fixed',
      newFilename,
      1.0,
      1 // isCorrect = true
    );
    
    return {
      success: true,
      oldPath: file.original_path,
      newPath,
      oldFilename: file.original_filename,
      newFilename
    };
  } catch (error) {
    console.error(`Error fixing file ${fileId}:`, error);
    throw error;
  }
}

/**
 * Clean up resources
 * @returns {Promise<void>}
 */
async function cleanup() {
  try {
    // Close the database connection
    await db.closeDatabase();
    console.log('Database closed');
    
    // Clean up any temporary files
    await audioProcessor.cleanupTempFiles();
    console.log('Temporary files cleaned up');
    
    return true;
  } catch (error) {
    console.error('Error cleaning up processor:', error);
    return false;
  }
}

/**
 * Get the database module
 * @returns {Object} - The database module
 */
function getDatabase() {
  return db;
}

// Get analysis results for a series
async function getSeriesAnalysis(seriesId) {
  try {
    console.log(`Getting analysis results for series ID: ${seriesId}`);
    
    // Get the series from the database
    const series = await db.getSeries(seriesId);
    if (!series) {
      console.warn(`Series with ID ${seriesId} not found, trying to find by directory`);
      
      // Try to get all series and find one with a matching directory
      const allSeries = await db.getAllSeries();
      console.log(`Found ${allSeries.length} series in the database`);
      
      // If we have no series, return an empty result
      if (allSeries.length === 0) {
        return { series: null, files: [] };
      }
      
      // Use the first series as a fallback
      const fallbackSeries = allSeries[0];
      console.log(`Using fallback series with ID ${fallbackSeries.id}`);
      
      // Get all files for the fallback series
      const files = await db.getFilesForSeries(fallbackSeries.directory);
      
      // Return the results
      return {
        series: fallbackSeries,
        files
      };
    }
    
    // Get all files for the series
    const files = await db.getFilesForSeries(series.directory);
    
    // Return the results
    return {
      series,
      files
    };
  } catch (error) {
    console.error('Error getting series analysis:', error);
    throw error;
  }
}

// Get all series from the database
async function getAllSeries() {
  try {
    console.log('Getting all series from the database');
    
    // Get all series from the database
    const series = await db.getAllSeries();
    
    return series;
  } catch (error) {
    console.error('Error getting all series:', error);
    throw error;
  }
}

// Reset a file's extraction status
async function resetFileExtractionStatus(fileId) {
  try {
    console.log(`Resetting extraction status for file ID: ${fileId}`);
    
    // Reset the file's extraction status in the database
    await db.updateAudioExtractionStatus(fileId, null, 0);
    
    return true;
  } catch (error) {
    console.error('Error resetting file extraction status:', error);
    throw error;
  }
}

// Clean up duplicate series in the database
async function cleanupDuplicateSeries() {
  try {
    console.log('Cleaning up duplicate series in the database');
    
    // Get all series from the database
    const allSeries = await db.getAllSeries();
    console.log(`Found ${allSeries.length} total series in the database`);
    
    // Group series by directory
    const seriesByDirectory = {};
    allSeries.forEach(series => {
      if (!seriesByDirectory[series.directory]) {
        seriesByDirectory[series.directory] = [];
      }
      seriesByDirectory[series.directory].push(series);
    });
    
    // Find directories with multiple series
    const duplicateDirectories = Object.keys(seriesByDirectory).filter(dir => 
      seriesByDirectory[dir].length > 1
    );
    
    console.log(`Found ${duplicateDirectories.length} directories with duplicate series`);
    
    // For each directory with duplicates, keep only the most recent one
    let removedCount = 0;
    for (const dir of duplicateDirectories) {
      const seriesInDir = seriesByDirectory[dir];
      
      // Sort by ID (assuming higher ID means more recent)
      seriesInDir.sort((a, b) => b.id - a.id);
      
      // Keep the first one (highest ID), remove the rest
      const seriesToKeep = seriesInDir[0];
      const seriesToRemove = seriesInDir.slice(1);
      
      console.log(`For directory ${dir}, keeping series ID ${seriesToKeep.id} and removing ${seriesToRemove.length} duplicates`);
      
      // Remove the duplicates
      for (const series of seriesToRemove) {
        await db.removeSeries(series.id);
        removedCount++;
      }
    }
    
    return {
      removed: removedCount,
      success: true
    };
  } catch (error) {
    console.error('Error cleaning up duplicate series:', error);
    throw error;
  }
}

module.exports = {
  initialize,
  processSeries,
  processFile,
  fixFile,
  extractAudioForSeries,
  cleanup,
  getSeriesAnalysis,
  getAllSeries,
  resetFileExtractionStatus,
  cleanupDuplicateSeries,
  getDatabase
}; 