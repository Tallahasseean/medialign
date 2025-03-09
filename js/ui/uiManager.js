// UI Manager - Handles general UI functions and event listeners

// Import dependencies
const modalManager = require('./modalManager');
const tableRenderer = require('./tableRenderer');

/**
 * Initialize all UI components
 */
function initializeUI() {
  // Set up event listeners
  setupEventListeners();
  
  // Initialize modals
  modalManager.initializeModals();
  
  // Update table headers
  tableRenderer.updateTableHeaders();
  
  console.log('UI initialized');
}

/**
 * Set up global event listeners
 */
function setupEventListeners() {
  // Example of a global event listener
  document.addEventListener('keydown', (event) => {
    // Close modals on Escape key
    if (event.key === 'Escape') {
      document.querySelectorAll('dialog[open]').forEach(dialog => {
        dialog.close();
      });
    }
  });
  
  // Add any other global event listeners here
}

/**
 * Add settings fields to the settings modal
 */
function addSettingsFields() {
  const settingsFields = document.getElementById('settings-fields');
  
  // Add additional settings fields if needed
  const additionalFields = `
    <div class="form-control w-full max-w-lg mb-4">
      <label class="label">
        <span class="label-text">FFmpeg Path (optional)</span>
      </label>
      <input type="text" id="ffmpeg-path" class="input input-bordered w-full max-w-lg" placeholder="Leave empty to use system FFmpeg">
    </div>
  `;
  
  if (settingsFields) {
    settingsFields.insertAdjacentHTML('beforeend', additionalFields);
  }
}

/**
 * Handle progress updates for audio extraction
 * @param {Object} progress - Progress information
 */
function updateProgress(progress) {
  if (!progress) return;
  
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  const progressPercentage = document.getElementById('progress-percentage');
  
  if (progressBar && progressLabel && progressPercentage) {
    // Update progress bar
    const percentage = Math.round(progress.percentage || 0);
    progressBar.style.width = `${percentage}%`;
    progressBar.ariaValueNow = percentage;
    
    // Update label
    progressLabel.textContent = progress.message || 'Processing...';
    
    // Update percentage
    progressPercentage.textContent = `${percentage}%`;
  }
}

/**
 * Reset progress bar
 */
function resetProgress() {
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  const progressPercentage = document.getElementById('progress-percentage');
  
  if (progressBar && progressLabel && progressPercentage) {
    // Reset progress bar
    progressBar.style.width = '0%';
    progressBar.ariaValueNow = 0;
    
    // Reset label
    progressLabel.textContent = 'Ready';
    
    // Reset percentage
    progressPercentage.textContent = '0%';
  }
}

/**
 * Show an alert message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, warning, error, info)
 * @param {number} duration - How long to display the message in ms
 */
function showAlert(message, type = 'info', duration = 3000) {
  // Create alert element
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} fixed bottom-4 right-4 shadow-lg z-50 max-w-sm`;
  alert.innerHTML = `
    <div>
      <i class="fas ${getAlertIcon(type)} mr-2"></i>
      <span>${message}</span>
    </div>
  `;
  
  // Add to body
  document.body.appendChild(alert);
  
  // Remove after duration
  setTimeout(() => {
    alert.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(alert);
    }, 300);
  }, duration);
}

/**
 * Get icon class for alert type
 * @param {string} type - Alert type
 * @returns {string} - Icon class
 */
function getAlertIcon(type) {
  switch (type) {
    case 'success':
      return 'fa-check-circle';
    case 'warning':
      return 'fa-exclamation-triangle';
    case 'error':
      return 'fa-exclamation-circle';
    case 'info':
    default:
      return 'fa-info-circle';
  }
}

/**
 * Format a processing step for display
 * @param {string} step - Processing step
 * @returns {string} - Formatted step
 */
function formatProcessingStep(step) {
  if (!step) return '';
  
  // Replace underscores with spaces and capitalize each word
  return step
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = {
  initializeUI,
  addSettingsFields,
  updateProgress,
  resetProgress,
  showAlert,
  formatProcessingStep
}; 