// Diagnostic script to help identify issues with the application
// This will run automatically when included in the HTML

console.log('==========================================');
console.log('DIAGNOSTIC SCRIPT RUNNING');
console.log('==========================================');

// Check if we're running in Electron
console.log('Running in Electron:', typeof window.electronAPI !== 'undefined');

// Check localStorage
try {
  const seriesList = localStorage.getItem('seriesList');
  console.log('Series list in localStorage:', seriesList ? 'Found' : 'Not found');
  if (seriesList) {
    try {
      const parsed = JSON.parse(seriesList);
      console.log('Series count:', Array.isArray(parsed) ? parsed.length : 'Not an array');
      console.log('First series:', parsed[0] || 'None');
    } catch (e) {
      console.error('Error parsing series list:', e);
    }
  }
} catch (e) {
  console.error('Error accessing localStorage:', e);
}

// Check DOM elements
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, checking elements...');
  
  // Check important elements
  const elements = {
    'series-table-body': document.getElementById('series-table-body'),
    'add-series-button': document.getElementById('add-series-button'),
    'settings-button': document.getElementById('settings-button'),
    'add-series-modal': document.getElementById('add-series-modal'),
    'settings-modal': document.getElementById('settings-modal'),
    'new-series-directory': document.getElementById('new-series-directory'),
    'new-series-title': document.getElementById('new-series-title'),
    'new-browse-button': document.getElementById('new-browse-button'),
    'confirm-add-series': document.getElementById('confirm-add-series'),
    'cancel-add-series': document.getElementById('cancel-add-series')
  };
  
  // Log element status
  console.log('Element check:');
  Object.entries(elements).forEach(([id, element]) => {
    console.log(`- ${id}: ${element ? 'Found' : 'NOT FOUND'}`);
  });
  
  // Add click listeners to buttons for testing
  if (elements['add-series-button']) {
    console.log('Adding test click listener to Add Series button');
    elements['add-series-button'].addEventListener('click', () => {
      console.log('DIAGNOSTIC: Add Series button clicked');
    });
  }
  
  if (elements['settings-button']) {
    console.log('Adding test click listener to Settings button');
    elements['settings-button'].addEventListener('click', () => {
      console.log('DIAGNOSTIC: Settings button clicked');
    });
  }
  
  // Check if electronAPI is available
  if (window.electronAPI) {
    console.log('electronAPI methods:', Object.keys(window.electronAPI));
  } else {
    console.error('electronAPI not available!');
  }
  
  console.log('==========================================');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('==========================================');
}); 