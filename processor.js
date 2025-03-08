const path = require('path');
const db = require('./database');
const tmdbApi = require('./tmdb-api');
const fileScanner = require('./file-scanner');
const audioProcessor = require('./audio-processor');
const speechToText = require('./speech-to-text');
const textMatcher = require('./text-matcher');
const { ipcMain } = require('electron');

// Initialize the processor
async function initialize() {
  try {
    await db.initDatabase();
    console.log('Database initialized');
    
    // Set up IPC handlers
    setupIpcHandlers();
    
    return true;
  } catch (error) {
    console.error('Error initializing processor:', error);
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
    
    // Step 8: Return processing summary
    return await db.getProcessingSummary(seriesId);
  } catch (error) {
    console.error('Error processing series:', error);
    throw error;
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
    
    // Step 1: Extract episode info from filename
    const extractedInfo = fileScanner.extractEpisodeInfo(file.original_path);
    
    // Step 2: If we can extract info, check if it matches an episode
    if (extractedInfo) {
      const matchingEpisode = episodes.find(
        episode => episode.season_number === extractedInfo.season && 
                  episode.episode_number === extractedInfo.episode
      );
      
      if (matchingEpisode) {
        // Filename matches an episode, mark as correct
        await db.updateFileStatus(
          file.id,
          matchingEpisode.id,
          'correct',
          null,
          1.0
        );
        console.log(`File ${file.original_filename} is correctly named`);
        return;
      }
    }
    
    // Step 3: If we can't extract info or it doesn't match, analyze audio
    const audioSegments = await audioProcessor.extractAudioSegments(file.original_path);
    console.log(`Extracted ${audioSegments.length} audio segments from ${file.original_filename}`);
    
    // Step 4: Transcribe audio
    const transcriptions = await speechToText.transcribeMultipleAudio(audioSegments);
    console.log(`Transcribed ${transcriptions.length} audio segments from ${file.original_filename}`);
    
    // Step 5: Match transcriptions with episodes
    const { episode: matchedEpisode, score } = textMatcher.matchTranscriptionsWithEpisodes(
      transcriptions,
      episodes
    );
    
    // Step 6: Update file status based on match
    if (matchedEpisode && score > 0.3) { // Threshold can be adjusted
      const status = extractedInfo && 
                    extractedInfo.season === matchedEpisode.season_number && 
                    extractedInfo.episode === matchedEpisode.episode_number
                    ? 'correct' : 'incorrect';
      
      const newFilename = status === 'incorrect' 
        ? fileScanner.generateFilename(file.original_path, {
            season: matchedEpisode.season_number,
            episode: matchedEpisode.episode_number,
            title: matchedEpisode.title
          })
        : null;
      
      await db.updateFileStatus(
        file.id,
        matchedEpisode.id,
        status,
        newFilename,
        score
      );
      
      console.log(`File ${file.original_filename} matched with ${matchedEpisode.title} (${status})`);
    } else {
      // No good match found
      await db.updateFileStatus(
        file.id,
        null,
        'unknown',
        null,
        score
      );
      
      console.log(`No good match found for ${file.original_filename}`);
    }
    
    // Clean up audio files
    await audioProcessor.cleanupAudioFiles(audioSegments);
  } catch (error) {
    console.error(`Error processing file ${file.original_filename}:`, error);
    
    // Update file status to error
    await db.updateFileStatus(
      file.id,
      null,
      'error',
      null,
      0
    );
  }
}

/**
 * Fix a misnamed file
 * @param {number} fileId - ID of the file to fix
 * @param {number} episodeId - ID of the correct episode
 * @returns {Promise<Object>} - Updated file object
 */
async function fixFile(fileId, episodeId) {
  try {
    // Get file and episode info
    const files = await db.getFiles(null);
    const file = files.find(f => f.id === fileId);
    
    const episodes = await db.getEpisodes(null);
    const episode = episodes.find(e => e.id === episodeId);
    
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
      1.0
    );
    
    // Return updated file
    const updatedFiles = await db.getFiles(null);
    return updatedFiles.find(f => f.id === fileId);
  } catch (error) {
    console.error('Error fixing file:', error);
    throw error;
  }
}

// Clean up resources
async function cleanup() {
  try {
    await db.closeDatabase();
    console.log('Database closed');
    return true;
  } catch (error) {
    console.error('Error cleaning up processor:', error);
    return false;
  }
}

module.exports = {
  initialize,
  processSeries,
  fixFile,
  cleanup
}; 