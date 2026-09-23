const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";

console.log('KEY:', KEY);

async function getTrendingMovies(timeWindow = 'week') {
  const url = `${BASE}/trending/movie/${timeWindow}?api_key=${KEY}`;

  // Debug check — see the exact URL being called
  console.log('Requesting URL:', url);

  try {
    const response = await fetch(url);

    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Data:', data.results);
    return data.results;
  } catch (error) {
    console.error('Error fetching trending movies:', error);
  }
}

getTrendingMovies('week');