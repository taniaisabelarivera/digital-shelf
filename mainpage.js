const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";
const container = document.getElementById("content");

const trendingState = { movies: [], page: 0, containerId: 'trending-content' };
const newMoviesState = { movies: [], page: 0, containerId: 'new-content' };

const moviesPerPage = 6;

function displayMovies(movies, container) {
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

function renderPage(state) {
  const start = state.page * moviesPerPage;
  const end = start + moviesPerPage;
  const container = document.getElementById(state.containerId);
  displayMovies(state.movies.slice(start, end), container);
}

async function getTrendingMovies(timeWindow = 'week') {
  const url = `${BASE}/trending/movie/${timeWindow}?api_key=${KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    return [];
  }
}

async function getNewMovies(timeWindow = 'month') {
  const url = `${BASE}/movie/now_playing?api_key=${KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching new movies:', error);
    return [];
  }
}

function showNext(state) {
  const maxPage = Math.ceil(state.movies.length / moviesPerPage) - 1;
  state.page = state.page < maxPage ? state.page + 1 : 0;
  renderPage(state);
}

function showPrevious(state) {
  const maxPage = Math.ceil(state.movies.length / moviesPerPage) - 1;
  state.page = state.page > 0 ? state.page - 1 : maxPage;
  renderPage(state);
}

document.getElementById('b1').addEventListener('click', () => showPrevious(trendingState));
document.getElementById('b2').addEventListener('click', () => showNext(trendingState));

document.getElementById('b3').addEventListener('click', () => showPrevious(newMoviesState));
document.getElementById('b4').addEventListener('click', () => showNext(newMoviesState));

getTrendingMovies('week').then(movies => {
  trendingState.movies = movies;
  renderPage(trendingState);
});

getNewMovies().then(movies => {
  newMoviesState.movies = movies;
  renderPage(newMoviesState);
});