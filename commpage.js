const KEY = import.meta.env.VITE_TMDB_API_KEY;

const idParam = new URLSearchParams(window.location.search).get("id");
const tmdbId = idParam ? Number(idParam) : null;

const postsBox = document.getElementById("posts");
const postForm = document.getElementById("post-form");
const postError = document.getElementById("post-error");
const heading = document.querySelector(".title");

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

async function setupMovieMode() {
  const back = el("a", "← Back to movie");
  back.id = "back-link";
  back.href = `/movie.html?id=${tmdbId}`;
  heading.before(back);

  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${KEY}`);
    if (!res.ok) return;
    const movie = await res.json();
    heading.textContent = `${movie.title} Forum`;
    document.title = `${movie.title} Forum | Digital Shelf`;
  } catch {

  }
}

async function loadComments(postId, box) {
  const res = await fetch(`/api/posts/${postId}/comments`);
  const comments = await res.json();
  box.replaceChildren();
  if (comments.length === 0) {
    box.append(el("p", "No comments yet.", "empty"));
    return;
  }
  for (const c of comments) {
    const item = el("div", undefined, "comment");
    item.append(el("strong", c.username), el("span", ` · ${c.created_at}`, "meta"), el("p", c.body));
    box.append(item);
  }
}

function renderPost(p) {
  const card = el("article", undefined, "post");
  card.append(el("h3", p.title), el("small", `by ${p.username} · ${p.created_at}`, "meta"));

  if (!tmdbId && p.tmdb_id) {
    const link = el("a", "View movie forum", "movie-link");
    link.href = `/community.html?id=${p.tmdb_id}`;
    card.append(link);
  }

  card.append(el("p", p.body));

  const toggle = el("button", "Comments", "btn");
  toggle.type = "button";
  const section = el("div", undefined, "comments");
  section.hidden = true;
  const list = el("div");

  const form = document.createElement("form");
  form.className = "comment-form";
  const input = el("input");
  input.placeholder = "Write a comment...";
  input.maxLength = 1000;
  input.required = true;
  const send = el("button", "Reply", "btn");
  send.type = "submit";
  const err = el("p", undefined, "error");
  err.setAttribute("role", "alert");
  form.append(input, send, err);

  toggle.addEventListener("click", () => {
    section.hidden = !section.hidden;
    if (!section.hidden) loadComments(p.id, list);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const res = await fetch(`/api/posts/${p.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: input.value }),
    });
    if (res.status === 401) { window.location.href = "/login.html"; return; }
    if (!res.ok) { err.textContent = (await res.json()).error; return; }
    input.value = "";
    loadComments(p.id, list);
  });

  section.append(list, form);
  card.append(toggle, section);
  return card;
}

async function loadPosts() {
  const url = tmdbId ? `/api/posts?tmdb_id=${tmdbId}` : "/api/posts";
  const res = await fetch(url);
  const posts = await res.json();
  postsBox.replaceChildren();
  if (posts.length === 0) {
    postsBox.append(el("p", "No posts yet. Start the discussion!", "empty"));
    return;
  }
  for (const p of posts) postsBox.append(renderPost(p));
}

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  postError.textContent = "";
  const res = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tmdb_id: tmdbId, // null on the general feed
      title: document.getElementById("post-title").value,
      body: document.getElementById("post-body").value,
    }),
  });
  if (res.status === 401) { window.location.href = "/login.html"; return; }
  if (!res.ok) { postError.textContent = (await res.json()).error; return; }
  postForm.reset();
  loadPosts();
});

if (tmdbId) setupMovieMode();
loadPosts();