// TMDB API Service

/**
 * Get the TMDB API key from local storage
 * @returns {string} - TMDB API key
 */
function getTmdbApiKey() {
  return localStorage.getItem('tmdbApiKey') || '';
}

/**
 * Get the TMDB access token from local storage
 * @returns {string} - TMDB access token
 */
function getTmdbAccessToken() {
  return localStorage.getItem('tmdbAccessToken') || '';
}

/**
 * Search TMDB by title
 * @param {string} title - Title to search for
 * @returns {Promise<Array>} - Search results
 */
async function searchTmdb(title) {
  try {
    console.log(`Searching TMDB for: ${title}`);
    
    const apiKey = getTmdbApiKey();
    const accessToken = getTmdbAccessToken();
    
    if (!apiKey && !accessToken) {
      throw new Error('TMDB API key or access token is required in settings');
    }
    
    let searchUrl = '';
    let headers = {};
    
    if (accessToken) {
      searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(title)}`;
      headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
    } else {
      searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    }
    
    console.log('Making TMDB API request...');
    const response = await fetch(searchUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Got ${data.results?.length || 0} results from TMDB`);
    return data.results || [];
  } catch (error) {
    console.error('Error searching TMDB:', error);
    throw error;
  }
}

/**
 * Fetch episode details from TMDB
 * @param {number} tmdbId - TMDB ID of the TV show
 * @param {number} seasonNumber - Season number
 * @param {number} episodeNumber - Episode number
 * @returns {Promise<Object>} - Episode details
 */
async function fetchEpisodeDetails(tmdbId, seasonNumber, episodeNumber) {
  try {
    console.log(`Fetching details for S${seasonNumber}E${episodeNumber} of show ID ${tmdbId}`);
    
    const apiKey = getTmdbApiKey();
    const accessToken = getTmdbAccessToken();
    
    if (!apiKey && !accessToken) {
      throw new Error('TMDB API key or access token is required in settings');
    }
    
    let episodeUrl = '';
    let headers = {};
    
    if (accessToken) {
      episodeUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`;
      headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
    } else {
      episodeUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${apiKey}`;
    }
    
    console.log('Making TMDB API request for episode details...');
    const response = await fetch(episodeUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching episode details:', error);
    throw error;
  }
}

module.exports = {
  getTmdbApiKey,
  getTmdbAccessToken,
  searchTmdb,
  fetchEpisodeDetails
}; 