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

// Fetch content via the discover endpoint - better for genre-specific filtering
export async function discoverContent(
  mediaType: 'movie' | 'tv',
  options: {
    genreIds?: number[],
    sortBy?: string,
    voteCountGte?: number,
    voteAverageGte?: number,
    withKeywords?: string,
    page?: number,
    releaseDateGte?: string,
    releaseDateLte?: string,
    withOriginalLanguage?: string,
    year?: number
  } = {}
): Promise<TMDbSearchResponse> {
  
  // Build query params
  const params = new URLSearchParams();
  params.append('api_key', TMDB_API_KEY || '');
  params.append('language', 'en-US');
  params.append('include_adult', 'false');
  params.append('page', options.page?.toString() || '1');
  
  // Add optional filters
  if (options.genreIds && options.genreIds.length > 0) {
    params.append('with_genres', options.genreIds.join(','));
  }
  
  if (options.sortBy) {
    params.append('sort_by', options.sortBy);
  }
  
  if (options.voteCountGte) {
    params.append('vote_count.gte', options.voteCountGte.toString());
  }
  
  if (options.voteAverageGte) {
    params.append('vote_average.gte', options.voteAverageGte.toString());
  }
  
  if (options.withKeywords) {
    params.append('with_keywords', options.withKeywords);
  }
  
  if (options.releaseDateGte) {
    if (mediaType === 'movie') {
      params.append('primary_release_date.gte', options.releaseDateGte);
    } else {
      params.append('first_air_date.gte', options.releaseDateGte);
    }
  }
  
  if (options.releaseDateLte) {
    if (mediaType === 'movie') {
      params.append('primary_release_date.lte', options.releaseDateLte);
    } else {
      params.append('first_air_date.lte', options.releaseDateLte);
    }
  }
  
  if (options.withOriginalLanguage) {
    params.append('with_original_language', options.withOriginalLanguage);
  }
  
  if (options.year) {
    if (mediaType === 'movie') {
      params.append('primary_release_year', options.year.toString());
    } else {
      params.append('first_air_date_year', options.year.toString());
    }
  }
  
  const url = `${BASE_URL}/discover/${mediaType}?${params.toString()}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    console.error('TMDb API Error:', error);
    throw new Error(`Failed to fetch discover content: ${error.status_message || response.statusText}`);
  }
  
  const data = await response.json();
  
  // Add media_type to each result since discover doesn't include it
  const results = data.results.map((item: any) => ({
    ...item,
    media_type: mediaType
  }));
  
  return {
    ...data,
    results
  };
}

// Fetch documentary content - optimized for documentaries
export async function getDocumentaries(page: number = 1): Promise<TMDbSearchResponse> {
  // For documentaries - use discover with documentary genre (99)
  // Also add minimum vote count to ensure quality
  return discoverContent('movie', {
    genreIds: [99], // Documentary genre
    sortBy: 'popularity.desc',
    voteCountGte: 50, // Ensure some minimum popularity
    page: page
  });
}

// Get true crime and murder documentaries specifically
export async function getTrueCrimeDocumentaries(page: number = 1): Promise<TMDbSearchResponse> {
  // First try direct search for true crime documentaries
  // These often have "murder", "killer", "crime" in the title or description
  const trueCrimeSearch = await searchContent('true crime murder serial killer documentary');
  
  // Filter for documentary genre ID 99
  const trueCrimeResults = trueCrimeSearch.results.filter(item => 
    item.genre_ids?.includes(99) || 
    // If genre is missing, look for documentary terms
    ((item.title || item.name || '').toLowerCase().includes('documentary')) ||
    ((item.overview || '').toLowerCase().includes('documentary'))
  );
  
  // Also get recent high-quality documentaries via discover
  const crimeDocumentaries = await discoverContent('movie', {
    genreIds: [99, 80], // Documentary + Crime genres
    sortBy: 'popularity.desc',
    voteCountGte: 20, // Lower threshold to get more results
    page: page
  });
  
  // Get Netflix documentaries specifically (many true crime docs are from Netflix)
  let netflixDocs: TMDbSearchResult[] = [];
  try {
    // Use keyword search - Netflix has keyword ID 213 in TMDb
    const netflixSearch = await discoverContent('movie', {
      genreIds: [99], // Documentary genre
      withKeywords: '213', // Netflix keyword ID
      sortBy: 'popularity.desc',
      page: page
    });
    netflixDocs = netflixSearch.results;
  } catch (error) {
    console.error('Failed to fetch Netflix documentaries:', error);
  }
  
  // Also try direct search for murder documentaries
  const murderDocSearch = await searchContent('netflix murder documentary');
  const murderDocs = murderDocSearch.results.filter(item => 
    item.genre_ids?.includes(99) || 
    (item.overview || '').toLowerCase().includes('documentary')
  );
  
  // Combine all results, remove duplicates
  const combinedResults: TMDbSearchResult[] = [];
  const idSet = new Set<number>();
  
  const processItems = (items: TMDbSearchResult[]) => {
    items.forEach(item => {
      if (!idSet.has(item.id)) {
        idSet.add(item.id);
        combinedResults.push(item);
      }
    });
  };
  
  // Process in order of priority
  processItems(trueCrimeResults);
  processItems(crimeDocumentaries.results);
  processItems(netflixDocs);
  processItems(murderDocs);
  
  return {
    page: page,
    results: combinedResults,
    total_pages: Math.max(
      1,
      trueCrimeSearch.total_pages,
      crimeDocumentaries.total_pages
    ),
    total_results: combinedResults.length
  };
}

// Fetch TV documentaries/docuseries
export async function getTVDocumentaries(page: number = 1): Promise<TMDbSearchResponse> {
  // Use documentary genre for TV (99)
  return discoverContent('tv', {
    genreIds: [99], // Documentary genre for TV series too
    sortBy: 'popularity.desc',
    voteCountGte: 20, // Lower threshold for TV
    page: page
  });
}

// Get anime content - both movies and TV shows
export async function getAnime(page: number = 1): Promise<TMDbSearchResponse> {
  // Fetch anime TV shows with higher priority (most anime is TV)
  const animeTV = await discoverContent('tv', {
    genreIds: [16], // Animation genre
    withOriginalLanguage: 'ja', // Japanese language
    sortBy: 'popularity.desc',
    voteCountGte: 50,
    page: page
  });
  
  // Fetch anime movies as backup if needed
  const animeMovies = await discoverContent('movie', {
    genreIds: [16], // Animation genre 
    withOriginalLanguage: 'ja', // Japanese language
    sortBy: 'popularity.desc',
    voteCountGte: 100,
    page: page
  });
  
  // Combine results, but prioritize TV results first
  const combinedResults = [
    ...animeTV.results.slice(0, 15), // Take top 15 TV anime
    ...animeMovies.results.slice(0, 5) // Take top 5 movies
  ];
  
  return {
    page: page,
    results: combinedResults,
    total_pages: Math.max(animeTV.total_pages, animeMovies.total_pages),
    total_results: animeTV.total_results + animeMovies.total_results
  };
}

// Fetch popular anime titles specifically - incorporating well-known titles
export async function getPopularAnime(): Promise<TMDbSearchResponse> {
  // Top anime titles based on widespread popularity
  const popularAnimeTitles = [
    'Death Note', 'Demon Slayer', 'One Piece', 'Dandadan',
    'Dragon Ball', 'Jujutsu Kaisen', 'My Hero Academia', 
    'Attack on Titan', 'Bleach', 'JoJo\'s Bizarre Adventure',
    'Fullmetal Alchemist', 'Hunter X Hunter', 'Naruto',
    'Haikyu!!', 'Cowboy Bebop', 'Is It Wrong to Try to Pick Up Girls in a Dungeon',
    'Monster', 'Vinland Saga', 'Blue Lock', 'Code Geass', 'Komi Can\'t Communicate'
  ];
  
  // Create promises for searching each title
  const searchPromises = popularAnimeTitles.map(title => 
    searchContent(title)
      .then(response => {
        // Filter to keep only first result that is Japanese animation
        if (response.results.length > 0) {
          const firstMatch = response.results.find(item => 
            (item.media_type === 'tv' || item.media_type === 'movie') && 
            (item.genre_ids?.includes(16) || 
             (item as any).original_language === 'ja')
          );
          return firstMatch ? [firstMatch] : [];
        }
        return [];
      })
      .catch(() => []) // Handle errors gracefully
  );
  
  try {
    // Get all search results
    const resultsArrays = await Promise.all(searchPromises);
    
    // Flatten and remove duplicates by ID
    const idSet = new Set<number>();
    const combinedResults: TMDbSearchResult[] = [];
    
    resultsArrays.flat().forEach(item => {
      if (item && !idSet.has(item.id)) {
        idSet.add(item.id);
        combinedResults.push(item);
      }
    });
    
    // Also add popular anime from discover as fallback
    const discoverAnime = await getAnime();
    discoverAnime.results.forEach(item => {
      if (!idSet.has(item.id)) {
        idSet.add(item.id);
        combinedResults.push(item);
      }
    });
    
    return {
      page: 1,
      results: combinedResults,
      total_pages: 1,
      total_results: combinedResults.length
    };
  } catch (error) {
    console.error('Failed to fetch popular anime:', error);
    // Fallback to regular anime search
    return getAnime();
  }
}

// Get highest rated content across all media types
export async function getHighestRated(
  mediaType?: 'movie' | 'tv', 
  genreIds?: number[], 
  page: number = 1
): Promise<TMDbSearchResponse> {
  if (!mediaType) {
    // If no media type specified, get both and combine
    const movies = await getHighestRated('movie', genreIds, page);
    const tv = await getHighestRated('tv', genreIds, page);
    
    // Interleave results for mixed highest rated content
    const combinedResults: TMDbSearchResult[] = [];
    const maxLength = Math.max(movies.results.length, tv.results.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < movies.results.length) combinedResults.push(movies.results[i]);
      if (i < tv.results.length) combinedResults.push(tv.results[i]);
    }
    
    return {
      page,
      results: combinedResults,
      total_pages: Math.max(movies.total_pages, tv.total_pages),
      total_results: movies.total_results + tv.total_results
    };
  }
  
  // For specific media type, use discover with high rating threshold
  return discoverContent(mediaType, {
    genreIds,
    sortBy: 'vote_average.desc',
    voteCountGte: 1000, // Increased from 100 to 1000 to ensure significant popularity
    voteAverageGte: 7.0, // Get high quality content
    page
  });
} 