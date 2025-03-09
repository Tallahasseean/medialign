const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Create a temporary directory for audio files
const tempDir = path.join(os.tmpdir(), 'medialign-audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create an event emitter for progress updates
const progressEmitter = new EventEmitter();

/**
 * Extract audio from a video file
 * @param {string} videoPath - Path to the video file
 * @param {number} startTime - Start time in seconds (optional)
 * @param {number} duration - Duration in seconds (optional)
 * @param {function} progressCallback - Callback for progress updates
 * @param {number} retryCount - Number of retries (default: 3)
 * @returns {Promise<{path: string, buffer: Buffer}>} - Path to the extracted audio file and audio buffer
 */
function extractAudio(videoPath, startTime = 0, duration = 60, progressCallback = null, retryCount = 3) {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      reject(new Error(`Video file not found: ${videoPath}`));
      return;
    }
    
    const outputFileName = `${path.basename(videoPath, path.extname(videoPath))}-${Date.now()}.mp3`;
    const outputPath = path.join(tempDir, outputFileName);
    
    console.log(`Extracting audio from ${videoPath} (${startTime}s to ${startTime + duration}s)`);
    
    let ffmpegCommand = ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .outputOptions('-ac 1') // Mono audio
      .output(outputPath);
    
    // Add time options if provided
    if (startTime > 0 || duration < Infinity) {
      ffmpegCommand = ffmpegCommand.setStartTime(startTime);
      
      if (duration < Infinity) {
        ffmpegCommand = ffmpegCommand.setDuration(duration);
      }
    }
    
    // Add progress handler if callback provided
    if (progressCallback) {
      ffmpegCommand.on('progress', (progress) => {
        if (progress.percent) {
          progressCallback(Math.round(progress.percent));
        }
      });
    }
    
    ffmpegCommand
      .on('end', () => {
        console.log(`Audio extracted: ${outputPath}`);
        
        // Read the file into a buffer
        fs.readFile(outputPath, (err, buffer) => {
          if (err) {
            console.error('Error reading audio file:', err);
            
            // Clean up the output file if it exists
            if (fs.existsSync(outputPath)) {
              try {
                fs.unlinkSync(outputPath);
              } catch (unlinkErr) {
                console.warn(`Could not delete output file ${outputPath}:`, unlinkErr);
              }
            }
            
            reject(err);
            return;
          }
          
          resolve({
            path: outputPath,
            buffer: buffer
          });
        });
      })
      .on('error', (err) => {
        console.error(`Error extracting audio from ${videoPath}:`, err);
        
        // Clean up the output file if it exists
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath);
          } catch (unlinkErr) {
            console.warn(`Could not delete output file ${outputPath}:`, unlinkErr);
          }
        }
        
        // Retry if we have retries left
        if (retryCount > 0) {
          console.log(`Retrying audio extraction (${retryCount} retries left)...`);
          
          // Wait a bit before retrying
          setTimeout(() => {
            extractAudio(videoPath, startTime, duration, progressCallback, retryCount - 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          reject(err);
        }
      })
      .run();
  });
}

/**
 * Get video duration
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} - Duration in seconds
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Error getting video duration:', err);
        reject(err);
        return;
      }
      
      const durationInSeconds = metadata.format.duration;
      resolve(durationInSeconds);
    });
  });
}

/**
 * Extract audio from multiple segments of a video
 * @param {string} videoPath - Path to the video file
 * @param {Array<{start: number, duration: number}>} segments - Array of segments to extract
 * @param {function} progressCallback - Callback for progress updates
 * @returns {Promise<Array<{path: string, buffer: Buffer, start: number, duration: number}>>} - Array of extracted audio segments
 */
async function extractAudioSegments(videoPath, segments = [], progressCallback = null) {
  try {
    // If no segments provided, create default segments
    if (segments.length === 0) {
      const duration = await getVideoDuration(videoPath);
      
      // Create 3 segments: beginning, middle, and end
      segments = [
        { start: 0, duration: 60 }, // First minute
        { start: Math.floor(duration / 2) - 30, duration: 60 }, // Middle minute
        { start: Math.max(0, duration - 60), duration: 60 } // Last minute
      ];
    }
    
    const results = [];
    const totalSegments = segments.length;
    let failedSegments = 0;
    
    // Extract audio for each segment sequentially to avoid overwhelming the system
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Calculate overall progress
      const segmentProgressCallback = progressCallback ? 
        (percent) => {
          const overallPercent = Math.round((i * 100 + percent) / totalSegments);
          progressCallback(overallPercent);
          
          // Emit progress event
          progressEmitter.emit('progress', {
            videoPath,
            segmentIndex: i,
            segmentProgress: percent,
            overallProgress: overallPercent
          });
        } : null;
      
      try {
        const result = await extractAudio(
          videoPath, 
          segment.start, 
          segment.duration, 
          segmentProgressCallback
        );
        
        results.push({
          path: result.path,
          buffer: result.buffer,
          start: segment.start,
          duration: segment.duration,
          segmentNumber: i
        });
      } catch (error) {
        console.error(`Error extracting segment ${i} (${segment.start}s to ${segment.start + segment.duration}s):`, error);
        failedSegments++;
        
        // Emit progress event for the failed segment
        progressEmitter.emit('progress', {
          videoPath,
          segmentIndex: i,
          segmentProgress: 0,
          overallProgress: Math.round((i * 100) / totalSegments),
          error: error.message
        });
        
        // Continue with the next segment
        continue;
      }
    }
    
    // If all segments failed, throw an error
    if (failedSegments === totalSegments) {
      throw new Error(`Failed to extract any audio segments from ${videoPath}`);
    }
    
    // If some segments failed, log a warning
    if (failedSegments > 0) {
      console.warn(`${failedSegments} out of ${totalSegments} segments failed to extract from ${videoPath}`);
    }
    
    return results;
  } catch (error) {
    console.error('Error extracting audio segments:', error);
    throw error;
  }
}

/**
 * Clean up temporary audio files
 * @param {string|Array<string>} filePaths - Path or array of paths to audio files to delete
 * @returns {Promise<void>}
 */
function cleanupAudioFiles(filePaths) {
  return new Promise((resolve, reject) => {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    
    const deletePromises = paths.map(filePath => 
      new Promise((resolveDelete, rejectDelete) => {
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.warn(`Warning: Could not delete file ${filePath}:`, err);
              rejectDelete(err);
            } else {
              console.log(`Deleted temporary file: ${filePath}`);
              resolveDelete();
            }
          });
        } else {
          resolveDelete();
        }
      })
    );
    
    Promise.all(deletePromises)
      .then(() => resolve())
      .catch(err => reject(err));
  });
}

/**
 * Clean up all temporary audio files in the temp directory
 * @returns {Promise<void>}
 */
function cleanupTempFiles() {
  return new Promise((resolve, reject) => {
    try {
      // Check if temp directory exists
      if (!fs.existsSync(tempDir)) {
        console.log('Temp directory does not exist, nothing to clean up');
        resolve();
        return;
      }
      
      // Read all files in the temp directory
      fs.readdir(tempDir, (err, files) => {
        if (err) {
          console.error('Error reading temp directory:', err);
          reject(err);
          return;
        }
        
        // If no files, resolve immediately
        if (files.length === 0) {
          console.log('No temporary files to clean up');
          resolve();
          return;
        }
        
        console.log(`Cleaning up ${files.length} temporary files...`);
        
        // Create full paths for all files
        const filePaths = files.map(file => path.join(tempDir, file));
        
        // Clean up all files
        cleanupAudioFiles(filePaths)
          .then(() => {
            console.log('All temporary files cleaned up');
            resolve();
          })
          .catch(err => {
            console.error('Error cleaning up temporary files:', err);
            reject(err);
          });
      });
    } catch (error) {
      console.error('Error in cleanupTempFiles:', error);
      reject(error);
    }
  });
}

/**
 * Get media file information
 * @param {string} filePath - Path to the media file
 * @returns {Promise<Object>} - Media file information
 */
function getMediaInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error getting media info:', err);
        reject(err);
        return;
      }
      
      resolve({
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate,
        format: metadata.format.format_name,
        hasVideo: metadata.streams.some(stream => stream.codec_type === 'video'),
        hasAudio: metadata.streams.some(stream => stream.codec_type === 'audio'),
        videoCodec: metadata.streams.find(stream => stream.codec_type === 'video')?.codec_name,
        audioCodec: metadata.streams.find(stream => stream.codec_type === 'audio')?.codec_name,
        width: metadata.streams.find(stream => stream.codec_type === 'video')?.width,
        height: metadata.streams.find(stream => stream.codec_type === 'video')?.height
      });
    });
  });
}

module.exports = {
  extractAudio,
  getVideoDuration,
  extractAudioSegments,
  cleanupAudioFiles,
  cleanupTempFiles,
  getMediaInfo,
  progressEmitter
}; 