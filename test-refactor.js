// Test script for validating the refactored code
const fs = require('fs');
const path = require('path');

console.log('Testing refactored code structure...');

// Check if directories exist
const directories = [
  'js',
  'js/services',
  'js/ui',
  'js/utils'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory ${dir} does not exist!`);
    process.exit(1);
  }
  console.log(`✅ Directory ${dir} exists`);
});

// Check if files exist
const files = [
  'js/main.js',
  'js/services/fileService.js',
  'js/services/seriesService.js',
  'js/services/tmdbService.js',
  'js/ui/tableRenderer.js',
  'js/ui/modalManager.js',
  'js/ui/uiManager.js',
  'js/utils/extractors.js'
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`❌ File ${file} does not exist!`);
    process.exit(1);
  }
  console.log(`✅ File ${file} exists`);
});

// Verify the file contents
const requiredFunctions = {
  'js/services/fileService.js': ['selectDirectory', 'updateFileRowsWithAnalysis'],
  'js/services/seriesService.js': ['loadSeriesList', 'saveSeriesList', 'getAllSeries', 'getSeriesByIndex', 'addSeries', 'updateSeries', 'deleteSeries'],
  'js/services/tmdbService.js': ['getTmdbApiKey', 'getTmdbAccessToken', 'searchTmdb', 'fetchEpisodeDetails'],
  'js/ui/tableRenderer.js': ['renderSeriesTable', 'createSeriesRow', 'toggleSeriesExpansion', 'createDirectoryRow', 'updateTableHeaders'],
  'js/ui/modalManager.js': ['initializeModals', 'displaySearchResults', 'showSeriesDetails', 'editSeries', 'deleteSeries'],
  'js/ui/uiManager.js': ['initializeUI', 'updateProgress', 'resetProgress', 'showAlert'],
  'js/utils/extractors.js': ['extractTitleFromPath', 'extractSeasonEpisode']
};

Object.entries(requiredFunctions).forEach(([file, functions]) => {
  const content = fs.readFileSync(file, 'utf8');
  
  functions.forEach(func => {
    if (!content.includes(`function ${func}`)) {
      console.error(`❌ Function ${func} not found in ${file}!`);
      process.exit(1);
    }
    console.log(`✅ Function ${func} found in ${file}`);
  });
});

// Check the main entry point
const mainContent = fs.readFileSync('js/main.js', 'utf8');
if (!mainContent.includes('async function init(')) {
  console.error('❌ init function not found in main.js!');
  process.exit(1);
}
console.log('✅ init function found in main.js');

// Check if index.html was updated
const indexContent = fs.readFileSync('index.html', 'utf8');
if (!indexContent.includes('<script src="js/main.js"></script>')) {
  console.error('❌ index.html does not include the new main.js script!');
  process.exit(1);
}
console.log('✅ index.html includes the new main.js script');

console.log('\n✅ All checks passed! The refactoring appears successful.');
console.log('\nNext steps:');
console.log('1. Test the application to ensure all functionality works as expected');
console.log('2. Fix any issues that might arise during testing');
console.log('3. Delete the original renderer.js file once you\'re confident the refactored code works correctly'); 