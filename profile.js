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

// Escape text before putting it in innerHTML (protects against XSS once user data is shown).
function esc(text) {
  const el = document.createElement("div");
  el.textContent = text ?? "";
  return el.innerHTML;
}

nextButton.addEventListener("click", (e) => {
  e.preventDefault();
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
  movies.forEach((movie) => {
    const movieImg = movie.poster_path ? IMG_URL + movie.poster_path : "/noPoster.png";
    const box = document.createElement("a");
    box.href = `/movie.html?id=${movie.id}`;
    box.classList.add("movie-box");
    box.innerHTML = `
      <img src="${movieImg}" alt="${esc(movie.title)} poster">
      <div class="movie-title">${esc(movie.title)}</div>
      <div class="movie-info">Release Date: ${esc(movie.release_date) || "N/A"}</div>
      <div class="movie-info">Rating: ${movie.vote_average.toFixed(1)}</div>
    `;
    container.appendChild(box);
  });
}

// TODO: replace discover/movie with the logged-in user's saved movies from /api/shelf.
async function getMovies() {
  const params = new URLSearchParams({ api_key: KEY, page: pageNum });
  if (sort !== "") {
    params.set("sort_by", sort);
    // Without a vote floor, "rating asc/desc" surfaces obscure films with 1 vote.
    if (sort.startsWith("vote_average")) params.set("vote_count.gte", "200");
  }

  try {
    const res = await fetch(`${BASE}/discover/movie?${params}`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();

    // TMDB caps discover at 500 pages
    totalPages = Math.min(data.total_pages, 500);
    displayMovies(data.results);
    pageNumber.innerText = `Page ${pageNum} of ${totalPages}`;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:white;grid-column:1/-1;text-align:center">Sorry, we couldn't load movies.</p>`;
  }
}

getMovies();