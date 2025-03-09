// Logger utility for the application

// Enable debug mode - set to false to reduce console output
const DEBUG_MODE = true;

/**
 * Log a message to the console if debug mode is enabled
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error, debug)
 */
function log(message, level = 'info') {
  if (!DEBUG_MODE && level !== 'error') return;
  
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  switch (level.toLowerCase()) {
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'error':
      console.error(formattedMessage);
      break;
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'info':
    default:
      console.log(formattedMessage);
  }
}

/**
 * Log an informational message
 * @param {string} message - Message to log
 */
function info(message) {
  log(message, 'info');
}

/**
 * Log a warning message
 * @param {string} message - Message to log
 */
function warn(message) {
  log(message, 'warn');
}

/**
 * Log an error message
 * @param {string} message - Message to log
 */
function error(message) {
  log(message, 'error');
}

/**
 * Log a debug message
 * @param {string} message - Message to log
 */
function debug(message) {
  log(message, 'debug');
}

module.exports = {
  log,
  info,
  warn,
  error,
  debug
}; 