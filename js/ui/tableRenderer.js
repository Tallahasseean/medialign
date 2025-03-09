// Table Renderer - Handles rendering of series and file tables

// Import dependencies
const seriesService = require('../services/seriesService');
const extractors = require('../utils/extractors');

/**
 * Render series table with all series
 */
function renderSeriesTable() {
  try {
    console.log('Rendering series table...');
    
    const seriesTableBody = document.getElementById('series-table-body');
    if (!seriesTableBody) {
      console.error('Series table body element not found');
      return;
    }
    
    // Clear existing content
    seriesTableBody.innerHTML = '';
    
    // Get series list
    const seriesList = seriesService.getAllSeries();
    console.log(`Found ${seriesList.length} series to render`, seriesList);
    
    if (!seriesList || seriesList.length === 0) {
      // Show empty state
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="5" class="text-center py-8">
          <div class="flex flex-col items-center justify-center">
            <i class="fas fa-tv text-4xl mb-4 text-gray-400"></i>
            <p class="text-lg font-medium text-gray-600">No series added yet</p>
            <p class="text-sm text-gray-500 mt-1">Click the "Add Series" button to get started</p>
          </div>
        </td>
      `;
      seriesTableBody.appendChild(emptyRow);
      console.log('Rendered empty state for series table');
      return;
    }
    
    // Render each series
    seriesList.forEach((series, index) => {
      console.log(`Creating row for series ${index}:`, series);
      const seriesRow = createSeriesRow(series, index);
      seriesTableBody.appendChild(seriesRow);
    });
    
    // Add event listeners to newly created rows
    addSeriesRowEventListeners();
    
    console.log('Series table rendered successfully');
  } catch (error) {
    console.error('Error rendering series table:', error);
    
    // Show error state
    const seriesTableBody = document.getElementById('series-table-body');
    if (seriesTableBody) {
      seriesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-8 text-red-500">
            <div class="flex flex-col items-center justify-center">
              <i class="fas fa-exclamation-circle text-4xl mb-4"></i>
              <p class="text-lg font-medium">Error rendering series</p>
              <p class="text-sm mt-1">Check console for details</p>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Create a series row element
 * @param {Object} series - Series object
 * @param {number} index - Series index
 * @returns {HTMLElement} - Series row element
 */
function createSeriesRow(series, index) {
  try {
    console.log(`Creating row for series: ${series.title} (index: ${index})`);
    
    const row = document.createElement('tr');
    row.className = 'series-row';
    row.dataset.seriesIndex = index;
    row.dataset.expanded = 'false';
    row.dataset.seriesId = series.id || '';
    
    // Get the basename of the directory
    const directoryName = series.directory.split('/').pop();
    
    row.innerHTML = `
      <td class="px-3 py-2">
        <div class="flex items-center">
          <button class="expand-button mr-2" aria-label="Expand series">
            <i class="fas fa-chevron-right text-gray-600"></i>
          </button>
          <span class="font-medium">${series.title || directoryName}</span>
        </div>
      </td>
      <td class="px-3 py-2">${directoryName}</td>
      <td class="px-3 py-2">${series.tmdbId || 'N/A'}</td>
      <td class="px-3 py-2">
        <span class="badge badge-primary">Ready</span>
      </td>
      <td class="px-3 py-2 text-right">
        <div class="flex justify-end space-x-2">
          <button class="btn btn-sm btn-circle analyze-series" title="Analyze Series" data-series-index="${index}">
            <i class="fas fa-play"></i>
          </button>
          <button class="btn btn-sm btn-circle view-series" title="View Details" data-series-index="${index}">
            <i class="fas fa-info"></i>
          </button>
          <button class="btn btn-sm btn-circle edit-series" title="Edit Series" data-series-index="${index}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-circle delete-series" title="Delete Series" data-series-index="${index}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    return row;
  } catch (error) {
    console.error('Error creating series row:', error);
    // Return a basic row as fallback
    const fallbackRow = document.createElement('tr');
    fallbackRow.innerHTML = `<td colspan="5">Error creating row</td>`;
    return fallbackRow;
  }
}

/**
 * Add event listeners to series rows
 */
function addSeriesRowEventListeners() {
  try {
    // Expand buttons
    document.querySelectorAll('.series-row .expand-button').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = button.closest('tr');
        const index = parseInt(row.dataset.seriesIndex, 10);
        const series = seriesService.getSeriesByIndex(index);
        
        if (series) {
          await toggleSeriesExpansion(row, series);
        }
      });
    });
    
    // Series row clicks for expansion
    document.querySelectorAll('.series-row').forEach(row => {
      row.addEventListener('click', async () => {
        const index = parseInt(row.dataset.seriesIndex, 10);
        const series = seriesService.getSeriesByIndex(index);
        
        if (series) {
          await toggleSeriesExpansion(row, series);
        }
      });
    });
    
    // Analyze series buttons
    document.querySelectorAll('.analyze-series').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(button.dataset.seriesIndex, 10);
        seriesService.startAudioExtraction(index);
      });
    });
    
    // View details buttons
    document.querySelectorAll('.view-series').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(button.dataset.seriesIndex, 10);
        window.showSeriesDetails(index);
      });
    });
    
    // Edit series buttons
    document.querySelectorAll('.edit-series').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(button.dataset.seriesIndex, 10);
        window.editSeries(index);
      });
    });
    
    // Delete series buttons
    document.querySelectorAll('.delete-series').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(button.dataset.seriesIndex, 10);
        window.deleteSeries(index);
      });
    });
  } catch (error) {
    console.error('Error adding series row event listeners:', error);
  }
}

/**
 * Toggle the expansion of a series row
 * @param {HTMLElement} row - Series row element
 * @param {Object} series - Series object
 * @returns {Promise<void>}
 */
async function toggleSeriesExpansion(row, series) {
  try {
    const isExpanded = row.dataset.expanded === 'true';
    const expandButton = row.querySelector('.expand-button i');
    
    if (isExpanded) {
      // Collapse the row
      expandButton.className = 'fas fa-chevron-right text-gray-600';
      
      // Remove all child rows
      const childRows = document.querySelectorAll(`[data-parent-index="${row.dataset.seriesIndex}"]`);
      childRows.forEach(childRow => childRow.remove());
      
      row.dataset.expanded = 'false';
    } else {
      // Expand the row
      expandButton.className = 'fas fa-chevron-down text-gray-600';
      row.dataset.expanded = 'true';
      
      try {
        // Add spinner to indicate loading
        expandButton.className = 'fas fa-spinner fa-spin text-gray-600';
        
        // Get directory structure
        await expandDirectory(row, series.directory, 0, row.dataset.seriesIndex);
        
        // Update icon to expanded state
        expandButton.className = 'fas fa-chevron-down text-gray-600';
      } catch (error) {
        console.error('Error expanding directory:', error);
        expandButton.className = 'fas fa-exclamation-circle text-red-600';
        row.dataset.expanded = 'false';
      }
    }
  } catch (error) {
    console.error('Error toggling series expansion:', error);
  }
}

/**
 * Toggle the expansion of a subdirectory row
 * @param {HTMLElement} row - Directory row element
 * @returns {Promise<void>}
 */
async function toggleSubdirectoryExpansion(row) {
  try {
    const isExpanded = row.dataset.expanded === 'true';
    const expandButton = row.querySelector('.expand-button i');
    
    if (isExpanded) {
      // Collapse the row
      expandButton.className = 'fas fa-chevron-right text-gray-400';
      
      // Remove all child rows
      const childRows = document.querySelectorAll(`[data-parent-path="${row.dataset.path}"]`);
      childRows.forEach(childRow => childRow.remove());
      
      row.dataset.expanded = 'false';
    } else {
      // Expand the row
      expandButton.className = 'fas fa-chevron-down text-gray-400';
      row.dataset.expanded = 'true';
      
      try {
        // Add spinner to indicate loading
        expandButton.className = 'fas fa-spinner fa-spin text-gray-400';
        
        // Get directory structure
        await expandDirectory(row, row.dataset.path, parseInt(row.dataset.level, 10) + 1, row.dataset.parentIndex);
        
        // Update icon to expanded state
        expandButton.className = 'fas fa-chevron-down text-gray-400';
      } catch (error) {
        console.error('Error expanding directory:', error);
        expandButton.className = 'fas fa-exclamation-circle text-red-600';
        row.dataset.expanded = 'false';
      }
    }
  } catch (error) {
    console.error('Error toggling subdirectory expansion:', error);
  }
}

/**
 * Expand a directory and show its contents
 * @param {HTMLElement} parentRow - Parent row element
 * @param {string} directoryPath - Directory path
 * @param {number} level - Indent level
 * @param {number} parentIndex - Parent index
 * @returns {Promise<void>}
 */
async function expandDirectory(parentRow, directoryPath, level, parentIndex) {
  try {
    // This would normally use IPC to get directory contents
    // For now, we'll simulate it with a simple structure
    
    // Simulate getting directory contents via IPC
    const contents = await simulateGetDirectoryContents(directoryPath);
    
    // Sort contents: directories first, then files
    contents.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Create rows for each item
    const series = getSeriesFromRow(parentRow);
    
    for (const item of contents) {
      let row;
      
      if (item.type === 'directory') {
        row = createDirectoryRow({ path: item.path }, series, parentRow, level);
      } else {
        row = createFileRow({ path: item.path, name: item.name }, contents.indexOf(item), series, parentRow, level);
      }
      
      // Insert after parent or after the last child of parent
      const lastChild = getLastChildRow(parentRow);
      if (lastChild) {
        lastChild.after(row);
      } else {
        parentRow.after(row);
      }
    }
  } catch (error) {
    console.error('Error expanding directory:', error);
  }
}

/**
 * Create a directory row element
 * @param {Object} dir - Directory object
 * @param {Object} series - Series object
 * @param {HTMLElement} parentRow - Parent row element
 * @param {number} indentLevel - Indent level
 * @returns {HTMLElement} - Directory row element
 */
function createDirectoryRow(dir, series, parentRow, indentLevel) {
  try {
    const row = document.createElement('tr');
    row.className = 'directory-row';
    row.dataset.parentIndex = parentRow.dataset.seriesIndex || parentRow.dataset.parentIndex;
    row.dataset.expanded = 'false';
    row.dataset.level = indentLevel;
    row.dataset.path = dir.path;
    row.dataset.seriesId = series.id || '';
    
    const directoryName = dir.path.split('/').pop();
    const indentPadding = 20 * indentLevel; // 20px per level
    
    row.innerHTML = `
      <td colspan="5" class="px-3 py-2">
        <div class="flex items-center" style="padding-left: ${indentPadding}px;">
          <button class="expand-button mr-2" aria-label="Expand directory">
            <i class="fas fa-chevron-right text-gray-400"></i>
          </button>
          <i class="fas fa-folder text-yellow-500 mr-2"></i>
          <span>${directoryName}</span>
        </div>
      </td>
    `;
    
    // Add event listener for expansion
    row.querySelector('.expand-button').addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleSubdirectoryExpansion(row);
    });
    
    // Add click event for the entire row
    row.addEventListener('click', async () => {
      await toggleSubdirectoryExpansion(row);
    });
    
    return row;
  } catch (error) {
    console.error('Error creating directory row:', error);
    // Return a basic row as fallback
    const fallbackRow = document.createElement('tr');
    fallbackRow.innerHTML = `<td colspan="5">Error creating directory row</td>`;
    return fallbackRow;
  }
}

/**
 * Create a file row element
 * @param {Object} file - File object
 * @param {number} fileIndex - File index
 * @param {Object} series - Series object
 * @param {HTMLElement} parentRow - Parent row element
 * @param {number} indentLevel - Indent level
 * @returns {HTMLElement} - File row element
 */
function createFileRow(file, fileIndex, series, parentRow, indentLevel) {
  try {
    const row = document.createElement('tr');
    row.className = 'file-row';
    row.dataset.parentIndex = parentRow.dataset.seriesIndex || parentRow.dataset.parentIndex;
    row.dataset.parentPath = file.path.split('/').slice(0, -1).join('/');
    row.dataset.level = indentLevel;
    row.dataset.path = file.path;
    row.dataset.fileIndex = fileIndex;
    row.dataset.seriesId = series.id || '';
    row.dataset.fileId = file.id || '';
    
    const fileName = file.path.split('/').pop();
    const indentPadding = 20 * indentLevel; // 20px per level
    
    // Extract season and episode from filename
    const seasonEpisode = extractors.extractSeasonEpisode(fileName);
    const seasonEpisodeText = seasonEpisode 
      ? `S${seasonEpisode.season.toString().padStart(2, '0')}E${seasonEpisode.episode.toString().padStart(2, '0')}` 
      : '';
    
    row.innerHTML = `
      <td colspan="5" class="px-3 py-2">
        <div class="flex items-center" style="padding-left: ${indentPadding}px;">
          <span class="ml-6"></span>
          <i class="fas fa-file-video text-blue-500 mr-2"></i>
          <span class="flex-1">${fileName}</span>
          <span class="badge badge-info ml-2">${seasonEpisodeText}</span>
          <span class="status-cell ml-2">Pending</span>
          <span class="match-cell ml-2"></span>
        </div>
      </td>
    `;
    
    return row;
  } catch (error) {
    console.error('Error creating file row:', error);
    // Return a basic row as fallback
    const fallbackRow = document.createElement('tr');
    fallbackRow.innerHTML = `<td colspan="5">Error creating file row</td>`;
    return fallbackRow;
  }
}

/**
 * Get the last child row of a parent row
 * @param {HTMLElement} parentRow - Parent row
 * @returns {HTMLElement|null} - Last child row or null
 */
function getLastChildRow(parentRow) {
  try {
    const parentIndex = parentRow.dataset.seriesIndex || parentRow.dataset.parentIndex;
    const parentPath = parentRow.dataset.path;
    const level = parseInt(parentRow.dataset.level || '0', 10);
    
    let lastChild = null;
    let currentRow = parentRow.nextElementSibling;
    
    while (currentRow) {
      const rowParentIndex = currentRow.dataset.parentIndex;
      const rowLevel = parseInt(currentRow.dataset.level || '0', 10);
      
      if (rowParentIndex === parentIndex && rowLevel > level) {
        if (parentPath) {
          // For directory rows, check if the file path includes the parent path
          const rowParentPath = currentRow.dataset.parentPath;
          if (rowParentPath && rowParentPath.includes(parentPath)) {
            lastChild = currentRow;
          } else {
            break;
          }
        } else {
          // For series rows
          lastChild = currentRow;
        }
      } else if (rowLevel <= level) {
        break;
      }
      
      currentRow = currentRow.nextElementSibling;
    }
    
    return lastChild;
  } catch (error) {
    console.error('Error getting last child row:', error);
    return null;
  }
}

/**
 * Get the series object from a row
 * @param {HTMLElement} row - Row element
 * @returns {Object} - Series object
 */
function getSeriesFromRow(row) {
  try {
    const seriesIndex = row.dataset.seriesIndex || row.dataset.parentIndex;
    return seriesService.getSeriesByIndex(parseInt(seriesIndex, 10)) || {};
  } catch (error) {
    console.error('Error getting series from row:', error);
    return {};
  }
}

/**
 * Simulate getting directory contents
 * @param {string} directoryPath - Directory path
 * @returns {Promise<Array>} - Array of directory contents
 */
async function simulateGetDirectoryContents(directoryPath) {
  // In a real app, this would use IPC to get directory contents
  return new Promise(resolve => {
    setTimeout(() => {
      // Create some fake files for testing
      const items = [
        { type: 'file', name: 'S01E01 - Pilot.mkv', path: `${directoryPath}/S01E01 - Pilot.mkv` },
        { type: 'file', name: 'S01E02 - Episode 2.mkv', path: `${directoryPath}/S01E02 - Episode 2.mkv` },
        { type: 'directory', name: 'Season 2', path: `${directoryPath}/Season 2` }
      ];
      resolve(items);
    }, 500);
  });
}

/**
 * Update table headers
 */
function updateTableHeaders() {
  try {
    const headerRow = document.querySelector('#series-table thead tr');
    if (!headerRow) {
      console.error('Series table header row not found');
      return;
    }
    
    headerRow.innerHTML = `
      <th class="px-3 py-2 text-left">Title</th>
      <th class="px-3 py-2 text-left">Directory</th>
      <th class="px-3 py-2 text-left">TMDB ID</th>
      <th class="px-3 py-2 text-left">Status</th>
      <th class="px-3 py-2 text-right">Actions</th>
    `;
    console.log('Table headers updated');
  } catch (error) {
    console.error('Error updating table headers:', error);
  }
}

module.exports = {
  renderSeriesTable,
  createSeriesRow,
  toggleSeriesExpansion,
  toggleSubdirectoryExpansion,
  createDirectoryRow,
  createFileRow,
  expandDirectory,
  updateTableHeaders
}; 