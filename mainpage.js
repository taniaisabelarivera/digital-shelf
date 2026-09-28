const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";
const container = document.getElementById("content");

function displayMovies(movies) {
  container.innerHTML = "";
  movies.forEach(movie => {
    let movieImg;
    if (movie.poster_path) {
      movieImg = IMG_URL + movie.poster_path;
    } else {
      movieImg = "noPoster.png";
    }
    const box = document.createElement("div");
    box.classList.add("movie-box");
    box.innerHTML = `
      <img src="${movieImg}">
      <div class="movie-title">${movie.title}</div>
      <div class="movie-info">Release Date: ${movie.release_date}</div>
      <div class="movie-info">Rating: ${movie.vote_average.toFixed(1)}</div>
    `;
    container.appendChild(box);
  });
}

async function getTrendingMovies(timeWindow = 'week') {
  const url = `${BASE}/trending/movie/${timeWindow}?api_key=${KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    return [];
  }
}

getTrendingMovies('week').then(movies => displayMovies(movies));