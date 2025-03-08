const axios = require('axios');

// Note: You'll need to sign up for a free API key from a service like OMDb API or RapidAPI
// This is a placeholder for the API key
const API_KEY = 'YOUR_API_KEY';

/**
 * Get TV series information by IMDB ID
 * @param {string} imdbId - The IMDB ID (e.g., tt0944947)
 * @returns {Promise<Object>} - Series information
 */
async function getSeriesInfo(imdbId) {
  try {
    // Using OMDb API as an example
    const response = await axios.get(`http://www.omdbapi.com/?i=${imdbId}&apikey=${API_KEY}`);
    
    if (response.data.Response === 'False') {
      throw new Error(response.data.Error || 'Failed to fetch series info');
    }
    
    return {
      imdbId: response.data.imdbID,
      title: response.data.Title,
      year: response.data.Year,
      totalSeasons: response.data.totalSeasons,
      plot: response.data.Plot,
      poster: response.data.Poster
    };
  } catch (error) {
    console.error('Error fetching series info:', error);
    throw error;
  }
}

/**
 * Get season information for a TV series
 * @param {string} imdbId - The IMDB ID (e.g., tt0944947)
 * @param {number} seasonNumber - The season number
 * @returns {Promise<Array>} - Array of episodes for the season
 */
async function getSeasonInfo(imdbId, seasonNumber) {
  try {
    // Using OMDb API as an example
    const response = await axios.get(`http://www.omdbapi.com/?i=${imdbId}&Season=${seasonNumber}&apikey=${API_KEY}`);
    
    if (response.data.Response === 'False') {
      throw new Error(response.data.Error || 'Failed to fetch season info');
    }
    
    // Map the episodes to a more usable format
    return response.data.Episodes.map(episode => ({
      imdbId: episode.imdbID,
      title: episode.Title,
      released: episode.Released,
      episodeNumber: parseInt(episode.Episode, 10),
      seasonNumber: seasonNumber,
      rating: episode.imdbRating
    }));
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} info:`, error);
    throw error;
  }
}

/**
 * Get detailed episode information
 * @param {string} episodeImdbId - The episode's IMDB ID
 * @returns {Promise<Object>} - Detailed episode information
 */
async function getEpisodeInfo(episodeImdbId) {
  try {
    // Using OMDb API as an example
    const response = await axios.get(`http://www.omdbapi.com/?i=${episodeImdbId}&apikey=${API_KEY}`);
    
    if (response.data.Response === 'False') {
      throw new Error(response.data.Error || 'Failed to fetch episode info');
    }
    
    return {
      imdbId: response.data.imdbID,
      title: response.data.Title,
      released: response.data.Released,
      seasonNumber: parseInt(response.data.Season, 10),
      episodeNumber: parseInt(response.data.Episode, 10),
      plot: response.data.Plot,
      rating: response.data.imdbRating,
      director: response.data.Director,
      writer: response.data.Writer
    };
  } catch (error) {
    console.error('Error fetching episode info:', error);
    throw error;
  }
}

/**
 * Get all episodes for a TV series
 * @param {string} imdbId - The IMDB ID (e.g., tt0944947)
 * @returns {Promise<Array>} - Array of all episodes with details
 */
async function getAllEpisodes(imdbId) {
  try {
    // First get series info to know how many seasons
    const seriesInfo = await getSeriesInfo(imdbId);
    const totalSeasons = parseInt(seriesInfo.totalSeasons, 10);
    
    // Get episodes for each season
    const episodePromises = [];
    for (let i = 1; i <= totalSeasons; i++) {
      episodePromises.push(getSeasonInfo(imdbId, i));
    }
    
    const seasonsData = await Promise.all(episodePromises);
    
    // Flatten the array of season episodes
    const allEpisodes = seasonsData.flat();
    
    // Get detailed info for each episode (optional, can be expensive for API calls)
    // This could be done selectively or on-demand instead
    /*
    const detailedEpisodes = await Promise.all(
      allEpisodes.map(episode => getEpisodeInfo(episode.imdbId))
    );
    return detailedEpisodes;
    */
    
    return allEpisodes;
  } catch (error) {
    console.error('Error fetching all episodes:', error);
    throw error;
  }
}

/**
 * Search for TV series by title
 * @param {string} title - The series title to search for
 * @returns {Promise<Array>} - Array of search results
 */
async function searchSeries(title) {
  try {
    // Using OMDb API as an example
    const response = await axios.get(`http://www.omdbapi.com/?s=${encodeURIComponent(title)}&type=series&apikey=${API_KEY}`);
    
    if (response.data.Response === 'False') {
      if (response.data.Error === 'Movie not found!') {
        return []; // No results found
      }
      throw new Error(response.data.Error || 'Failed to search series');
    }
    
    return response.data.Search.map(result => ({
      imdbId: result.imdbID,
      title: result.Title,
      year: result.Year,
      poster: result.Poster
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