const KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BASE = "https://api.themoviedb.org/3";
const PER_PAGE = 12;

const container = document.getElementById("content");
const pageNumber = document.getElementById("pageNumbers");
const dropdown = document.getElementById("sort");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");

let items = [];   // the logged-in user's shelf
let sort = "";
let pageNum = 1;

// Escape text before putting it in innerHTML (protects against XSS).
function esc(text) {
  const el = document.createElement("div");
  el.textContent = text ?? "";
  return el.innerHTML;
}

function totalPages() {
  return Math.max(1, Math.ceil(items.length / PER_PAGE));
}

function sorted() {
  const list = [...items];
  if (!sort) return list;
  const [field, dir] = sort.split(".");
  const sign = dir === "desc" ? -1 : 1;
  return list.sort((a, b) => sign * String(a[field] ?? "").localeCompare(String(b[field] ?? "")));
}

function render() {
  const pages = totalPages();
  pageNum = Math.min(pageNum, pages);
  const slice = sorted().slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE);

  container.innerHTML = "";
  slice.forEach((m) => {
    const img = m.poster_path ? IMG_URL + m.poster_path : "/noPoster.png";
    const box = document.createElement("a");
    box.href = `/movie.html?id=${m.tmdb_id}`;
    box.classList.add("movie-box");
    box.innerHTML = `
      <img src="${img}" alt="${esc(m.title)} poster">
      <div class="movie-title">${esc(m.title)}</div>
      <div class="movie-info">Release Date: ${esc(m.release_date) || "N/A"}</div>
      <div class="movie-info">${esc(m.status)}${m.liked ? " · ♥ liked" : ""}</div>
    `;
    container.appendChild(box);
  });
  pageNumber.innerText = `Page ${pageNum} of ${pages}`;
}

// Our database stores only the TMDB id (+ title), so fetch poster and date from TMDB.
async function enrich(row) {
  if (row.poster_path && row.release_date) return row;
  try {
    const res = await fetch(`${BASE}/movie/${row.tmdb_id}?api_key=${KEY}`);
    if (!res.ok) throw new Error(res.status);
    const m = await res.json();
    return { ...row, title: row.title || m.title, poster_path: m.poster_path, release_date: m.release_date };
  } catch {
    return row;
  }
}

function showMessage(html) {
  container.innerHTML = `<p style="color:white;grid-column:1/-1;text-align:center">${html}</p>`;
}

async function loadShelf() {
  try {
    const res = await fetch("/api/shelf");
    if (res.status === 401) {
      showMessage('Please <a href="/login.html" style="color:#d1c4f7">log in</a> to see your shelf.');
      return;
    }
    if (!res.ok) throw new Error(res.status);
    items = await Promise.all((await res.json()).map(enrich));
    if (items.length === 0) showMessage("Your shelf is empty.");
    else render();
    loadMatches();
  } catch (err) {
    console.error(err);
    showMessage("Sorry, we couldn't load your shelf. Is the server running?");
  }
}

async function loadMatches() {
  try {
    const res = await fetch("/api/matches");
    if (!res.ok) return;
    const matches = await res.json();
    const list = document.getElementById("matches-list");
    list.innerHTML = matches.length
      ? matches.map((m) =>
          `<li><strong>${esc(m.username)}</strong> ${m.similarity}% match (${m.shared_likes} shared likes)</li>`).join("")
      : "<li>No matches yet. Like more movies!</li>";
    document.getElementById("matches").hidden = false;
  } catch { /* matches are optional */ }
}

nextButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (pageNum < totalPages()) { pageNum++; render(); }
});
prevButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (pageNum > 1) { pageNum--; render(); }
});
dropdown.addEventListener("change", () => {
  sort = dropdown.value;
  pageNum = 1;
  render();
});

loadShelf();