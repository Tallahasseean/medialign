const axios = require('axios');

// Note: You'll need to sign up for a free API key from The Movie Database (TMDB)
// This is a placeholder for the API key that will be used if none is provided
const DEFAULT_API_KEY = 'YOUR_API_KEY';

/**
 * Get TV series information by TMDB ID
 * @param {string} tmdbId - The TMDB ID (e.g., 1399 for Game of Thrones)
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Object>} - Series information
 */
async function getSeriesInfo(tmdbId, apiKey = DEFAULT_API_KEY, accessToken = '') {
  try {
    // Headers for the request, including the access token if provided
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Using TMDB API
    const response = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}`, {
      params: {
        api_key: apiKey
      },
      headers
    });
    
    return {
      tmdbId: response.data.id,
      imdbId: `tt${response.data.id}`, // Convert to IMDB-like format for compatibility
      title: response.data.name,
      year: response.data.first_air_date ? response.data.first_air_date.substring(0, 4) : '',
      totalSeasons: response.data.number_of_seasons,
      plot: response.data.overview,
      poster: response.data.poster_path ? `https://image.tmdb.org/t/p/w500${response.data.poster_path}` : null
    };
  } catch (error) {
    console.error('Error fetching series info:', error);
    throw error;
  }
}

/**
 * Get season information for a TV series
 * @param {string} tmdbId - The TMDB ID
 * @param {number} seasonNumber - The season number
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Array>} - Array of episodes for the season
 */
async function getSeasonInfo(tmdbId, seasonNumber, apiKey = DEFAULT_API_KEY, accessToken = '') {
  try {
    // Headers for the request, including the access token if provided
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Using TMDB API
    const response = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`, {
      params: {
        api_key: apiKey
      },
      headers
    });
    
    // Map the episodes to a more usable format
    return response.data.episodes.map(episode => ({
      imdbId: `tt${tmdbId}e${seasonNumber}${episode.episode_number.toString().padStart(2, '0')}`, // Generate a compatible ID
      title: episode.name,
      released: episode.air_date,
      episodeNumber: episode.episode_number,
      seasonNumber: seasonNumber,
      rating: episode.vote_average,
      plot: episode.overview
    }));
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} info:`, error);
    throw error;
  }
}

/**
 * Get detailed episode information
 * @param {string} tmdbId - The series TMDB ID
 * @param {number} seasonNumber - The season number
 * @param {number} episodeNumber - The episode number
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Object>} - Detailed episode information
 */
async function getEpisodeInfo(tmdbId, seasonNumber, episodeNumber, apiKey = DEFAULT_API_KEY, accessToken = '') {
  try {
    // Headers for the request, including the access token if provided
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Using TMDB API
    const response = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`, {
      params: {
        api_key: apiKey
      },
      headers
    });
    
    return {
      imdbId: `tt${tmdbId}e${seasonNumber}${episodeNumber.toString().padStart(2, '0')}`, // Generate a compatible ID
      title: response.data.name,
      released: response.data.air_date,
      seasonNumber: seasonNumber,
      episodeNumber: episodeNumber,
      plot: response.data.overview,
      rating: response.data.vote_average,
      director: response.data.crew.find(c => c.job === 'Director')?.name || '',
      writer: response.data.crew.find(c => c.job === 'Writer')?.name || ''
    };
  } catch (error) {
    console.error('Error fetching episode info:', error);
    throw error;
  }
}

/**
 * Get all episodes for a TV series
 * @param {string} tmdbId - The TMDB ID
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Array>} - Array of all episodes with details
 */
async function getAllEpisodes(tmdbId, apiKey = DEFAULT_API_KEY, accessToken = '') {
  try {
    // First get series info to know how many seasons
    const seriesInfo = await getSeriesInfo(tmdbId, apiKey, accessToken);
    const totalSeasons = seriesInfo.totalSeasons;
    
    // Get episodes for each season
    const episodePromises = [];
    for (let i = 1; i <= totalSeasons; i++) {
      episodePromises.push(getSeasonInfo(tmdbId, i, apiKey, accessToken));
    }
    
    const seasonsData = await Promise.all(episodePromises);
    
    // Flatten the array of season episodes
    return seasonsData.flat();
  } catch (error) {
    console.error('Error fetching all episodes:', error);
    throw error;
  }
}

/**
 * Search for TV series by title
 * @param {string} title - The series title to search for
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Array>} - Array of search results
 */
async function searchSeries(title, apiKey = DEFAULT_API_KEY, accessToken = '') {
  try {
    // Headers for the request, including the access token if provided
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Using TMDB API
    const response = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
      params: {
        api_key: apiKey,
        query: title
      },
      headers
    });
    
    if (!response.data.results || response.data.results.length === 0) {
      return []; // No results found
    }
    
    return response.data.results.map(result => ({
      id: `tt${result.id}`, // Convert TMDB id to IMDB-like format for compatibility
      tmdbId: result.id,
      title: result.name,
      year: result.first_air_date ? result.first_air_date.substring(0, 4) : null,
      poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null
    }));
  } catch (error) {
    console.error('Error searching series:', error);
    throw error;
  }
}

module.exports = {
  getSeriesInfo,
  getSeasonInfo,
  getEpisodeInfo,
  getAllEpisodes,
  searchSeries
}; 