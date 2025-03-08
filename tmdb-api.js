const axios = require('axios');
const db = require('./database');

// Cache expiration time (in milliseconds)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Base URLs for TMDB API
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Check if a cache entry is still valid
 * @param {Date} lastUpdated - Date when the cache was last updated
 * @returns {boolean} - True if cache is still valid, false if expired
 */
function isCacheValid(lastUpdated) {
  if (!lastUpdated) return false;
  
  const now = new Date();
  const expirationTime = new Date(lastUpdated.getTime() + CACHE_EXPIRATION);
  
  return now < expirationTime;
}

/**
 * Make a request to the TMDB API
 * @param {string} endpoint - API endpoint (e.g., '/tv/1399')
 * @param {Object} params - Query parameters
 * @param {string} [apiKey] - TMDB API key
 * @param {string} [accessToken] - TMDB access token
 * @returns {Promise<Object>} - API response
 */
async function makeRequest(endpoint, params = {}, apiKey = '', accessToken = '') {
  try {
    // Set up headers with authorization if access token is provided
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Combine endpoint with base URL
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Add API key to params if provided
    if (apiKey) {
      params.api_key = apiKey;
    }
    
    // Make the request
    const response = await axios.get(url, { params, headers });
    return response.data;
  } catch (error) {
    console.error(`TMDB API error for ${endpoint}:`, error);
    
    // Format error message based on response
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data.status_message || error.message;
      
      throw new Error(`TMDB API error (${status}): ${message}`);
    } else if (error.request) {
      throw new Error('No response received from TMDB API. Please check your internet connection.');
    } else {
      throw new Error(`TMDB API request error: ${error.message}`);
    }
  }
}

/**
 * Get TV series information by TMDB ID
 * @param {string} tmdbId - The TMDB ID
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Object>} - Series information
 */
async function getSeriesInfo(tmdbId, apiKey = '', accessToken = '') {
  try {
    // Check cache first
    const cachedData = await db.getCachedSeriesInfo(tmdbId);
    
    if (cachedData && isCacheValid(cachedData.lastUpdated)) {
      console.log(`Using cached data for series ${tmdbId}`);
      return cachedData.data;
    }
    
    // Cache miss or expired, fetch from API
    console.log(`Fetching series ${tmdbId} data from TMDB API`);
    
    // API endpoint documentation: https://developer.themoviedb.org/reference/tv-series-details
    const data = await makeRequest(`/tv/${tmdbId}`, {
      language: 'en-US',
      append_to_response: 'external_ids'
    }, apiKey, accessToken);
    
    // Format the data
    const formattedData = {
      tmdbId: data.id,
      imdbId: data.external_ids?.imdb_id || null,
      title: data.name,
      originalTitle: data.original_name,
      year: data.first_air_date ? data.first_air_date.substring(0, 4) : '',
      totalSeasons: data.number_of_seasons,
      totalEpisodes: data.number_of_episodes,
      status: data.status,
      plot: data.overview,
      genres: data.genres.map(genre => genre.name),
      networks: data.networks.map(network => network.name),
      popularity: data.popularity,
      voteAverage: data.vote_average,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      poster: data.poster_path ? `${IMAGE_BASE_URL}/w500${data.poster_path}` : null,
      backdrop: data.backdrop_path ? `${IMAGE_BASE_URL}/original${data.backdrop_path}` : null
    };
    
    // Cache the formatted data
    await db.cacheSeriesInfo(tmdbId, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error(`Error getting series info for ${tmdbId}:`, error);
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
async function getSeasonInfo(tmdbId, seasonNumber, apiKey = '', accessToken = '') {
  try {
    // Check cache first
    const cachedData = await db.getCachedSeasonInfo(tmdbId, seasonNumber);
    
    if (cachedData && isCacheValid(cachedData.lastUpdated)) {
      console.log(`Using cached data for series ${tmdbId} season ${seasonNumber}`);
      return cachedData.data;
    }
    
    // Cache miss or expired, fetch from API
    console.log(`Fetching season ${seasonNumber} data for series ${tmdbId} from TMDB API`);
    
    // API endpoint documentation: https://developer.themoviedb.org/reference/tv-season-details
    const data = await makeRequest(`/tv/${tmdbId}/season/${seasonNumber}`, {
      language: 'en-US'
    }, apiKey, accessToken);
    
    // Format the data
    const formattedData = {
      seasonId: data.id,
      name: data.name,
      overview: data.overview,
      seasonNumber: data.season_number,
      airDate: data.air_date,
      posterPath: data.poster_path,
      poster: data.poster_path ? `${IMAGE_BASE_URL}/w500${data.poster_path}` : null,
      episodes: data.episodes.map(episode => ({
        episodeId: episode.id,
        name: episode.name,
        overview: episode.overview || '',
        airDate: episode.air_date,
        episodeNumber: episode.episode_number,
        seasonNumber: episode.season_number,
        stillPath: episode.still_path,
        still: episode.still_path ? `${IMAGE_BASE_URL}/w300${episode.still_path}` : null,
        voteAverage: episode.vote_average,
        runtime: episode.runtime
      }))
    };
    
    // Cache the formatted data
    await db.cacheSeasonInfo(tmdbId, seasonNumber, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error(`Error getting season info for ${tmdbId} season ${seasonNumber}:`, error);
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
async function getAllEpisodes(tmdbId, apiKey = '', accessToken = '') {
  try {
    // First get series info to know how many seasons
    const seriesInfo = await getSeriesInfo(tmdbId, apiKey, accessToken);
    const totalSeasons = seriesInfo.totalSeasons;
    
    // Get episodes for each season
    const seasonPromises = [];
    for (let i = 1; i <= totalSeasons; i++) {
      seasonPromises.push(getSeasonInfo(tmdbId, i, apiKey, accessToken));
    }
    
    const seasonsData = await Promise.all(seasonPromises);
    
    // Flatten the array of season episodes
    const allEpisodes = [];
    seasonsData.forEach(season => {
      season.episodes.forEach(episode => {
        allEpisodes.push({
          id: episode.episodeId,
          title: episode.name,
          plot: episode.overview,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          airDate: episode.airDate,
          still: episode.still,
          voteAverage: episode.voteAverage,
          runtime: episode.runtime
        });
      });
    });
    
    return allEpisodes;
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
async function searchSeries(title, apiKey = '', accessToken = '') {
  // API endpoint documentation: https://developer.themoviedb.org/reference/search-tv
  const data = await makeRequest('/search/tv', {
    query: title,
    include_adult: false,
    language: 'en-US',
    page: 1
  }, apiKey, accessToken);
  
  if (!data.results || data.results.length === 0) {
    return []; 
  }
  
  return data.results.map(result => ({
    id: result.id,
    title: result.name,
    originalTitle: result.original_name,
    year: result.first_air_date ? result.first_air_date.substring(0, 4) : null,
    overview: result.overview,
    posterPath: result.poster_path,
    backdropPath: result.backdrop_path,
    poster: result.poster_path ? `${IMAGE_BASE_URL}/w500${result.poster_path}` : null,
    backdrop: result.backdrop_path ? `${IMAGE_BASE_URL}/w1280${result.backdrop_path}` : null,
    popularity: result.popularity,
    voteAverage: result.vote_average
  }));
}

/**
 * Validate TMDB API credentials (API key or access token)
 * @param {string} [apiKey] - The API key to validate
 * @param {string} [accessToken] - The access token to validate
 * @returns {Promise<boolean>} - True if valid, throws error if invalid
 */
async function validateCredentials(apiKey = '', accessToken = '') {
  // We'll use the configuration endpoint as it's lightweight and always accessible
  // API endpoint documentation: https://developer.themoviedb.org/reference/configuration-details
  try {
    await makeRequest('/configuration', {}, apiKey, accessToken);
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Get detailed information for a specific episode
 * @param {string} tmdbId - The TMDB ID of the series
 * @param {number} seasonNumber - The season number
 * @param {number} episodeNumber - The episode number
 * @param {string} [apiKey] - The API key to use
 * @param {string} [accessToken] - The access token to use
 * @returns {Promise<Object>} - Episode information
 */
async function getEpisodeDetails(tmdbId, seasonNumber, episodeNumber, apiKey = '', accessToken = '') {
  try {
    // Check cache first
    const cachedData = await db.getCachedEpisodeInfo(tmdbId, seasonNumber, episodeNumber);
    
    if (cachedData && isCacheValid(cachedData.lastUpdated)) {
      console.log(`Using cached data for episode ${seasonNumber}x${episodeNumber} of series ${tmdbId}`);
      return cachedData.data;
    }
    
    // Cache miss or expired, fetch from API
    console.log(`Fetching episode ${seasonNumber}x${episodeNumber} data for series ${tmdbId} from TMDB API`);
    
    // API endpoint documentation: https://developer.themoviedb.org/reference/tv-episode-details
    const data = await makeRequest(`/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`, {
      language: 'en-US',
      append_to_response: 'credits,images,videos'
    }, apiKey, accessToken);
    
    // Format the data
    const formattedData = {
      episodeId: data.id,
      name: data.name,
      overview: data.overview || '',
      airDate: data.air_date,
      episodeNumber: data.episode_number,
      seasonNumber: data.season_number,
      stillPath: data.still_path,
      still: data.still_path ? `${IMAGE_BASE_URL}/w300${data.still_path}` : null,
      voteAverage: data.vote_average,
      runtime: data.runtime,
      crew: data.crew ? data.crew.map(person => ({
        id: person.id,
        name: person.name,
        job: person.job,
        department: person.department,
        profilePath: person.profile_path ? `${IMAGE_BASE_URL}/w185${person.profile_path}` : null
      })) : [],
      guestStars: data.guest_stars ? data.guest_stars.map(person => ({
        id: person.id,
        name: person.name,
        character: person.character,
        profilePath: person.profile_path ? `${IMAGE_BASE_URL}/w185${person.profile_path}` : null
      })) : [],
      videos: data.videos && data.videos.results ? data.videos.results.map(video => ({
        id: video.id,
        key: video.key,
        name: video.name,
        site: video.site,
        type: video.type
      })) : []
    };
    
    // Cache the formatted data
    await db.cacheEpisodeInfo(tmdbId, seasonNumber, episodeNumber, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error(`Error getting episode details for ${tmdbId} S${seasonNumber}E${episodeNumber}:`, error);
    throw error;
  }
}

module.exports = {
  getSeriesInfo,
  getSeasonInfo,
  getAllEpisodes,
  getEpisodeDetails,
  searchSeries,
  validateCredentials,
  IMAGE_BASE_URL
}; 