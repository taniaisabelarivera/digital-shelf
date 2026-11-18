import { loadShelf, createShelfControls, esc } from "./shelf.js";

const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";

const trendingState = { movies: [], page: 0, containerId: 'trending-content' };
const newMoviesState = { movies: [], page: 0, containerId: 'new-content' };

const moviesPerPage = 6;
const shelfReady = loadShelf().catch(() => null);

function displayMovies(movies, container) {
  container.innerHTML = "";
  movies.forEach(movie => {
    const movieImg = movie.poster_path ? IMG_URL + movie.poster_path : "noPoster.png";
    const box = document.createElement("div");
    box.classList.add("movie-box");

    const link = document.createElement("a");
    link.href = `/movie.html?id=${movie.id}`;
    link.innerHTML = `
      <img src="${movieImg}" alt="${esc(movie.title)} poster">
      <div class="movie-title">${esc(movie.title)}</div>
      <div class="movie-info">Release Date: ${esc(movie.release_date)}</div>
      <div class="movie-info">Rating: ${movie.vote_average.toFixed(1)}</div>
    `;

    box.append(link, createShelfControls(movie, { compact: true }));
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

async function getNewMovies() {
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

document.querySelector(".btn-login").addEventListener("click", () => {
  window.location.href = "/login.html";
});

Promise.all([getTrendingMovies('week'), shelfReady]).then(([movies]) => {
  trendingState.movies = movies;
  renderPage(trendingState);
});

Promise.all([getNewMovies(), shelfReady]).then(([movies]) => {
  newMoviesState.movies = movies;
  renderPage(newMoviesState);
});