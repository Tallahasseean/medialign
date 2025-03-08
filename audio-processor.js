const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Create a temporary directory for audio files
const tempDir = path.join(os.tmpdir(), 'medialign-audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Extract audio from a video file
 * @param {string} videoPath - Path to the video file
 * @param {number} startTime - Start time in seconds (optional)
 * @param {number} duration - Duration in seconds (optional)
 * @returns {Promise<string>} - Path to the extracted audio file
 */
function extractAudio(videoPath, startTime = 0, duration = 60) {
  return new Promise((resolve, reject) => {
    const outputFileName = `${path.basename(videoPath, path.extname(videoPath))}-${Date.now()}.mp3`;
    const outputPath = path.join(tempDir, outputFileName);
    
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
    
    ffmpegCommand
      .on('end', () => {
        console.log(`Audio extracted: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error extracting audio:', err);
        reject(err);
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
 * @returns {Promise<Array<string>>} - Array of paths to extracted audio files
 */
async function extractAudioSegments(videoPath, segments = []) {
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
    
    // Extract audio for each segment
    const extractionPromises = segments.map(segment => 
      extractAudio(videoPath, segment.start, segment.duration)
    );
    
    return Promise.all(extractionPromises);
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
  getMediaInfo
}; 