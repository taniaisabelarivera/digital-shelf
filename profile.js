const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";
const container = document.getElementById("content");
const pageNumber = document.getElementById("pageNumbers");
const dropdown = document.getElementById("sort");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
let sort = "";
let totalPages = 1;
let pageNum = 1;

nextButton.addEventListener("click", (e) => {
  if (pageNum < totalPages) {
    pageNum++;
    getMovies();
  }
});

prevButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (pageNum > 1) {
    pageNum--;
    getMovies();
  }
});

dropdown.addEventListener("change", () => {
  sort = dropdown.value;
  pageNum = 1;
  getMovies();
});

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

async function getMovies() {
  let url = "";
  if (sort !== "") {
    url = `${BASE}/discover/movie?api_key=${KEY}&page=${pageNum}&sort_by=${sort}`;
  } else {
    url = `${BASE}/discover/movie?api_key=${KEY}&page=${pageNum}`;
  }

  const res = await fetch(url);
  const data = await res.json();

  if (pageNum === 1) {
    totalPages = data.total_pages;
  }

  displayMovies(data.results);
  pageNumber.innerText = `Page ${pageNum} of ${totalPages}`;
}

getMovies();