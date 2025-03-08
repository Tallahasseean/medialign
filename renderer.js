// DOM Elements
const seriesDirectoryInput = document.getElementById('series-directory');
const browseButton = document.getElementById('browse-button');
const imdbIdInput = document.getElementById('imdb-id');
const analyzeButton = document.getElementById('analyze-button');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const resultsTable = document.getElementById('results-table');
const resultsBody = document.getElementById('results-body');

// Current series ID (set after analysis)
let currentSeriesId = null;

// Event Listeners
browseButton.addEventListener('click', async () => {
  try {
    const selectedDirectory = await window.api.selectDirectory();
    if (selectedDirectory) {
      seriesDirectoryInput.value = selectedDirectory;
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
    alert('Failed to select directory. Please try again.');
  }
});

analyzeButton.addEventListener('click', async () => {
  const seriesDirectory = seriesDirectoryInput.value;
  const imdbId = imdbIdInput.value;
  
  // Validate inputs
  if (!seriesDirectory) {
    alert('Please select a TV series directory.');
    return;
  }
  
  if (!imdbId) {
    alert('Please enter an IMDB ID.');
    return;
  }
  
  if (!imdbId.match(/^tt\d+$/)) {
    alert('Please enter a valid IMDB ID (format: tt0123456).');
    return;
  }
  
  // Show progress UI
  progressContainer.style.display = 'block';
  resultsTable.style.display = 'none';
  progressBar.value = 0;
  progressStatus.textContent = 'Initializing...';
  
  try {
    // In a real implementation, this would call the backend to process the series
    // For now, we'll just simulate progress and then show sample results
    simulateProgress();
    
    // This is where we would actually call the API
    /*
    const result = await window.api.analyzeSeries(seriesDirectory, imdbId);
    currentSeriesId = result.seriesId;
    displayResults(result.files);
    */
  } catch (error) {
    console.error('Error analyzing series:', error);
    progressStatus.textContent = `Error: ${error.message}`;
    progressBar.value = 100;
    progressBar.classList.remove('progress-primary');
    progressBar.classList.add('progress-error');
  }
});

// Simulate progress for demonstration purposes
function simulateProgress() {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
    progressBar.value = progress;
    
    if (progress < 20) {
      progressStatus.textContent = 'Downloading IMDB data...';
    } else if (progress < 40) {
      progressStatus.textContent = 'Scanning media files...';
    } else if (progress < 70) {
      progressStatus.textContent = 'Extracting audio from files...';
    } else if (progress < 90) {
      progressStatus.textContent = 'Analyzing audio and matching episodes...';
    } else {
      progressStatus.textContent = 'Finalizing results...';
    }
    
    if (progress >= 100) {
      clearInterval(interval);
      progressStatus.textContent = 'Analysis complete!';
      displaySampleResults();
    }
  }, 300);
}

// Display sample results for demonstration
function displaySampleResults() {
  // Clear previous results
  resultsBody.innerHTML = '';
  
  // Sample data
  const sampleResults = [
    { 
      id: 1,
      season_number: 1, 
      episode_number: 1, 
      original_filename: 'S01E01 - Winter Is Coming.mkv', 
      status: 'correct',
      episode_title: 'Winter Is Coming'
    },
    { 
      id: 2,
      season_number: 1, 
      episode_number: 2, 
      original_filename: 'S01E03 - Lord Snow.mkv', 
      status: 'incorrect',
      episode_title: 'The Kingsroad',
      corrected_filename: 'S01E02 - The Kingsroad.mkv'
    },
    { 
      id: 3,
      season_number: 1, 
      episode_number: 3, 
      original_filename: 'S01E02 - The Kingsroad.mkv', 
      status: 'incorrect',
      episode_title: 'Lord Snow',
      corrected_filename: 'S01E03 - Lord Snow.mkv'
    },
    { 
      id: 4,
      season_number: 2, 
      episode_number: 1, 
      original_filename: 'S02E01 - The North Remembers.mkv', 
      status: 'correct',
      episode_title: 'The North Remembers'
    }
  ];
  
  displayResults(sampleResults);
}

// Display results in the table
function displayResults(results) {
  // Clear previous results
  resultsBody.innerHTML = '';
  
  // Add rows to the table
  results.forEach(result => {
    const row = document.createElement('tr');
    
    const seasonCell = document.createElement('td');
    seasonCell.textContent = result.season_number;
    
    const episodeCell = document.createElement('td');
    episodeCell.textContent = result.episode_number;
    
    const filenameCell = document.createElement('td');
    filenameCell.textContent = result.original_filename;
    
    const statusCell = document.createElement('td');
    if (result.status === 'correct') {
      statusCell.innerHTML = '<span class="badge badge-success">Correct</span>';
    } else if (result.status === 'incorrect') {
      statusCell.innerHTML = '<span class="badge badge-error">Misnamed</span>';
    } else if (result.status === 'fixed') {
      statusCell.innerHTML = '<span class="badge badge-success">Fixed</span>';
    } else {
      statusCell.innerHTML = '<span class="badge badge-warning">Unknown</span>';
    }
    
    const actionCell = document.createElement('td');
    if (result.status === 'incorrect') {
      const fixButton = document.createElement('button');
      fixButton.textContent = 'Fix';
      fixButton.className = 'btn btn-xs btn-primary';
      fixButton.addEventListener('click', () => {
        fixFile(result.id, result.episode_id);
      });
      
      const detailsSpan = document.createElement('span');
      detailsSpan.textContent = ` → ${result.corrected_filename}`;
      detailsSpan.className = 'text-xs text-base-content opacity-70 ml-2';
      
      actionCell.appendChild(fixButton);
      actionCell.appendChild(detailsSpan);
    }
    
    row.appendChild(seasonCell);
    row.appendChild(episodeCell);
    row.appendChild(filenameCell);
    row.appendChild(statusCell);
    row.appendChild(actionCell);
    
    resultsBody.appendChild(row);
  });
  
  // Show the results table
  resultsTable.style.display = 'table';
}

// Fix a misnamed file
async function fixFile(fileId, episodeId) {
  try {
    // In a real implementation, this would call the API to fix the file
    // For now, we'll just show an alert
    alert(`This would rename the file to the correct episode name.`);
    
    // This is where we would actually call the API
    /*
    await window.api.fixFile(fileId, episodeId);
    
    // Refresh the results
    if (currentSeriesId) {
      const status = await window.api.getProcessingStatus(currentSeriesId);
      displayResults(status.files);
    }
    */
  } catch (error) {
    console.error('Error fixing file:', error);
    alert(`Error fixing file: ${error.message}`);
  }
} 