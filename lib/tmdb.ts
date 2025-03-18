const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  throw new Error('EXPO_PUBLIC_TMDB_API_KEY is not set in environment variables');
}

export interface TMDbSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type: 'movie' | 'tv' | 'person';
  genre_ids?: number[];
  popularity?: number;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number, name: string }[];
  overview?: string;
}

export interface TMDbSearchResponse {
  page: number;
  results: TMDbSearchResult[];
  total_pages: number;
  total_results: number;
}

export async function searchContent(
  query: string = '',
  page: number = 1,
  mediaType?: string,
  itemId?: number
): Promise<TMDbSearchResponse> {
  let url = '';

  // If we have an itemId and mediaType, fetch that specific item
  if (itemId && mediaType && (mediaType === 'movie' || mediaType === 'tv')) {
    url = `${BASE_URL}/${mediaType}/${itemId}?api_key=${TMDB_API_KEY}&language=en-US`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('TMDb API Error:', error);
      throw new Error(`Failed to fetch details: ${error.status_message || response.statusText}`);
    }
    
    const item = await response.json();
    
    // Convert single item response to match search response format
    return {
      page: 1,
      results: [{
        ...item,
        media_type: mediaType as 'movie' | 'tv'
      }],
      total_pages: 1,
      total_results: 1
    };
  }
  
  // Regular search
  url = `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
    query
  )}&page=${page}&include_adult=false&language=en-US`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    console.error('TMDb API Error:', error);
    throw new Error(`Failed to fetch search results: ${error.status_message || response.statusText}`);
  }

  return response.json();
}

export function formatSearchResult(result: TMDbSearchResult) {
  if (result.media_type === 'person') {
    return null;
  }

  return {
    id: result.id,
    title: result.title || result.name || '',
    poster_path: result.poster_path || 'https://via.placeholder.com/342x513?text=No+Poster',
    media_type: result.media_type,
    release_date: result.release_date || result.first_air_date || '',
    vote_average: result.vote_average,
    genre_ids: result.genre_ids || [],
    popularity: result.popularity || 0,
    runtime: result.runtime,
    number_of_seasons: result.number_of_seasons,
    number_of_episodes: result.number_of_episodes,
    genres: result.genres
  };
}

// Fetch trending content
export async function getTrending(timeWindow: 'day' | 'week' = 'day', page: number = 1): Promise<TMDbSearchResponse> {
  const url = `${BASE_URL}/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}&page=${page}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    console.error('TMDb API Error:', error);
    throw new Error(`Failed to fetch trending: ${error.status_message || response.statusText}`);
  }
  
  return response.json();
}

// Get detailed information for a movie
export async function getMovieDetails(movieId: number): Promise<TMDbSearchResult> {
  const url = `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    console.error('TMDb API Error:', error);
    throw new Error(`Failed to fetch movie details: ${error.status_message || response.statusText}`);
  }
  
  const data = await response.json();
  return {
    ...data,
    media_type: 'movie'
  };
}

// Get detailed information for a TV show
export async function getTVDetails(tvId: number): Promise<TMDbSearchResult> {
  const url = `${BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    console.error('TMDb API Error:', error);
    throw new Error(`Failed to fetch TV details: ${error.status_message || response.statusText}`);
  }
  
  const data = await response.json();
  return {
    ...data,
    media_type: 'tv'
  };
}

// Get genre names from ids
export async function getGenreName(genreId: number, mediaType: 'movie' | 'tv'): Promise<string> {
  // Cache this in a real app
  const url = `${BASE_URL}/genre/${mediaType}/list?api_key=${TMDB_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error('Failed to fetch genres');
    return 'Unknown';
  }
  
  const data = await response.json();
  const genre = data.genres.find((g: {id: number, name: string}) => g.id === genreId);
  return genre ? genre.name : 'Unknown';
} 