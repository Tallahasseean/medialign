// Add this at the beginning of the file
const { ipcRenderer } = require('electron');
const path = require('path');

console.log('Renderer script loaded');
console.log('electronAPI available:', !!window.electronAPI);

// DOM Elements - Main UI
const addSeriesButton = document.getElementById('add-series-button');
const seriesTableBody = document.getElementById('series-table-body');
const seriesDetails = document.getElementById('series-details');

// DOM Elements - Add Series Modal
const addSeriesModal = document.getElementById('add-series-modal');
const newSeriesDirectory = document.getElementById('new-series-directory');
const newBrowseButton = document.getElementById('new-browse-button');
const newImdbId = document.getElementById('new-imdb-id');
const cancelAddSeries = document.getElementById('cancel-add-series');
const confirmAddSeries = document.getElementById('confirm-add-series');

// DOM Elements - Series Details
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
// Store all series
let seriesList = [];

// Initialize the application
function init() {
  // Load series from local storage
  loadSeriesList();
  // Render the series table
  renderSeriesTable();
  // Set up IPC listeners
  setupIpcListeners();
}

// Set up IPC listeners
function setupIpcListeners() {
  // Directory selection response
  ipcRenderer.on('directory-selected', (event, result) => {
    console.log('Directory selected:', result);
    
    // Check if we're in the add series modal or the series details
    if (addSeriesModal.open) {
      if (result && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      } else if (result) {
        newSeriesDirectory.value = result;
      }
    } else {
      if (result && result.error) {
        alert(`Error selecting directory: ${result.error}`);
      } else if (result) {
        seriesDirectoryInput.value = result;
        
        // Update the current series
        if (currentSeriesId !== null) {
          seriesList[currentSeriesId].directory = result;
          saveSeriesList();
          renderSeriesTable();
        }
      }
    }
  });
  
  // Analyze series response
  ipcRenderer.on('analyze-series-result', (event, result) => {
    console.log('Analyze series result:', result);
    
    if (result && result.error) {
      console.error('Error analyzing series:', result.error);
      progressStatus.textContent = `Error: ${result.error}`;
      progressBar.value = 100;
      progressBar.classList.remove('progress-primary');
      progressBar.classList.add('progress-error');
      
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'error';
        saveSeriesList();
        renderSeriesTable();
      }
    } else {
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'analyzed';
        saveSeriesList();
        renderSeriesTable();
      }
      
      // Display the results
      displayResults(result.files);
    }
  });
}

// Load series list from local storage
function loadSeriesList() {
  const storedSeries = localStorage.getItem('seriesList');
  if (storedSeries) {
    seriesList = JSON.parse(storedSeries);
  }
}

// Save series list to local storage
function saveSeriesList() {
  localStorage.setItem('seriesList', JSON.stringify(seriesList));
}

// Render the series table
function renderSeriesTable() {
  // Clear the table
  seriesTableBody.innerHTML = '';
  
  // If no series, show the empty message
  if (seriesList.length === 0) {
    seriesTableBody.innerHTML = `
      <tr class="text-center">
        <td colspan="5" class="py-8 text-base-content opacity-60">No TV series added yet. Click "Add TV Series Root Directory" to get started.</td>
      </tr>
    `;
    return;
  }
  
  // Add each series to the table
  seriesList.forEach((series, index) => {
    const row = document.createElement('tr');
    
    // Series Name
    const nameCell = document.createElement('td');
    const dirParts = series.directory.split(/[\/\\]/);
    const dirName = dirParts[dirParts.length - 1] || 'Unknown';
    nameCell.textContent = series.name || dirName;
    
    // Directory
    const dirCell = document.createElement('td');
    dirCell.textContent = series.directory;
    dirCell.className = 'text-xs';
    
    // IMDB ID
    const imdbCell = document.createElement('td');
    imdbCell.textContent = series.imdbId || 'Not set';
    
    // Status
    const statusCell = document.createElement('td');
    if (series.status === 'analyzed') {
      statusCell.innerHTML = '<span class="badge badge-success">Analyzed</span>';
    } else if (series.status === 'in-progress') {
      statusCell.innerHTML = '<span class="badge badge-warning">In Progress</span>';
    } else {
      statusCell.innerHTML = '<span class="badge badge-ghost">Not Analyzed</span>';
    }
    
    // Actions
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex space-x-2';
    
    // Analyze button
    const analyzeBtn = document.createElement('button');
    analyzeBtn.className = 'btn btn-xs btn-primary';
    analyzeBtn.textContent = 'Analyze';
    analyzeBtn.addEventListener('click', () => {
      showSeriesDetails(index);
    });
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-xs btn-ghost';
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    `;
    editBtn.addEventListener('click', () => {
      editSeries(index);
    });
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-xs btn-ghost text-error';
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    `;
    deleteBtn.addEventListener('click', () => {
      deleteSeries(index);
    });
    
    actionsDiv.appendChild(analyzeBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    actionsCell.appendChild(actionsDiv);
    
    row.appendChild(nameCell);
    row.appendChild(dirCell);
    row.appendChild(imdbCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    seriesTableBody.appendChild(row);
  });
}

// Show series details for analysis
function showSeriesDetails(index) {
  const series = seriesList[index];
  currentSeriesId = index;
  
  // Set the form values
  seriesDirectoryInput.value = series.directory;
  imdbIdInput.value = series.imdbId || '';
  
  // Show the series details section
  seriesDetails.style.display = 'grid';
  
  // Scroll to the series details
  seriesDetails.scrollIntoView({ behavior: 'smooth' });
}

// Edit a series
function editSeries(index) {
  const series = seriesList[index];
  
  // Set the modal values
  newSeriesDirectory.value = series.directory;
  newImdbId.value = series.imdbId || '';
  
  // Store the index for later use
  newSeriesDirectory.dataset.editIndex = index;
  
  // Show the modal
  addSeriesModal.showModal();
}

// Delete a series
function deleteSeries(index) {
  if (confirm('Are you sure you want to delete this series?')) {
    seriesList.splice(index, 1);
    saveSeriesList();
    renderSeriesTable();
  }
}

// Event Listeners - Main UI
addSeriesButton.addEventListener('click', () => {
  // Clear the modal values
  newSeriesDirectory.value = '';
  newImdbId.value = '';
  
  // Remove any edit index
  delete newSeriesDirectory.dataset.editIndex;
  
  // Show the modal
  addSeriesModal.showModal();
});

// Event Listeners - Add Series Modal
newBrowseButton.addEventListener('click', () => {
  console.log('Browse button clicked');
  ipcRenderer.send('select-directory');
});

cancelAddSeries.addEventListener('click', () => {
  addSeriesModal.close();
});

confirmAddSeries.addEventListener('click', () => {
  const directory = newSeriesDirectory.value;
  const imdbId = newImdbId.value;
  
  // Validate directory
  if (!directory) {
    alert('Please select a directory.');
    return;
  }
  
  // Validate IMDB ID if provided
  if (imdbId && !imdbId.match(/^tt\d+$/)) {
    alert('Please enter a valid IMDB ID (format: tt0123456) or leave it empty.');
    return;
  }
  
  // Check if we're editing or adding
  const editIndex = newSeriesDirectory.dataset.editIndex;
  if (editIndex !== undefined) {
    // Update existing series
    seriesList[editIndex].directory = directory;
    seriesList[editIndex].imdbId = imdbId;
  } else {
    // Add new series
    const dirParts = directory.split(/[\/\\]/);
    const dirName = dirParts[dirParts.length - 1] || 'Unknown Series';
    
    seriesList.push({
      directory,
      imdbId,
      status: 'not-analyzed',
      name: dirName
    });
  }
  
  // Save and render
  saveSeriesList();
  renderSeriesTable();
  
  // Close the modal
  addSeriesModal.close();
});

// Event Listeners - Series Details
browseButton.addEventListener('click', () => {
  ipcRenderer.send('select-directory');
});

analyzeButton.addEventListener('click', () => {
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
  
  // Update the current series
  if (currentSeriesId !== null) {
    seriesList[currentSeriesId].imdbId = imdbId;
    seriesList[currentSeriesId].status = 'in-progress';
    saveSeriesList();
    renderSeriesTable();
  }
  
  // Show progress UI
  progressContainer.style.display = 'block';
  resultsTable.style.display = 'none';
  progressBar.value = 0;
  progressStatus.textContent = 'Initializing...';
  
  // In a real implementation, this would call the backend to process the series
  // For now, we'll just simulate progress and then show sample results
  simulateProgress();
  
  // This is where we would actually call the API
  /*
  ipcRenderer.send('analyze-series', {
    directory: seriesDirectory,
    imdbId: imdbId
  });
  */
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
      
      // Update the series status
      if (currentSeriesId !== null) {
        seriesList[currentSeriesId].status = 'analyzed';
        saveSeriesList();
        renderSeriesTable();
      }
      
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
function fixFile(fileId, episodeId) {
  // In a real implementation, this would call the API to fix the file
  // For now, we'll just show an alert
  alert(`This would rename the file to the correct episode name.`);
  
  // This is where we would actually call the API
  /*
  ipcRenderer.send('fix-file', {
    fileId: fileId,
    episodeId: episodeId
  });
  */
}

// Initialize the application
init(); 