const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";
const container = document.getElementById("movie-detail");

const id = new URLSearchParams(window.location.search).get("id");

function showMessage(text) {
  container.innerHTML = `<p class="message">${text}</p>`;
}

function renderMovie(movie) {
  document.title = `${movie.title} | Digital Shelf`;

  const poster = movie.poster_path ? IMG_URL + movie.poster_path : "noPoster.png";
  const genres = movie.genres.map(g => g.name).join(", ") || "N/A";
  const director = movie.credits.crew.find(p => p.job === "Director");
  const cast = movie.credits.cast.slice(0, 8).map(p => p.name).join(", ") || "N/A";

  container.innerHTML = `
    <div class="movie-card">
      <img class="movie-poster" src="${poster}" alt="${movie.title} poster">
      <div class="movie-details">
        <h1>${movie.title}</h1>
        ${movie.tagline ? `<p class="tagline">${movie.tagline}</p>` : ""}
        <p><strong>Release Date:</strong> ${movie.release_date || "N/A"}</p>
        <p><strong>Runtime:</strong> ${movie.runtime ? movie.runtime + " min" : "N/A"}</p>
        <p><strong>Rating:</strong> ${movie.vote_average.toFixed(1)} (${movie.vote_count} votes)</p>
        <p><strong>Genres:</strong> ${genres}</p>
        <p><strong>Director:</strong> ${director ? director.name : "N/A"}</p>
        <p><strong>Cast:</strong> ${cast}</p>
        <h3>Overview</h3>
        <p>${movie.overview || "No overview available."}</p>
      </div>
    </div>
  `;
}

async function getMovie() {
  if (!id) {
    showMessage("No movie selected.");
    return;
  }
  try {
    const res = await fetch(`${BASE}/movie/${id}?api_key=${KEY}&append_to_response=credits`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    renderMovie(await res.json());
  } catch (err) {
    console.error(err);
    showMessage("Sorry, we couldn't load that movie.");
  }
}

getMovie();