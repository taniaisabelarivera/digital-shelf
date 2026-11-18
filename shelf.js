import "./shelf.css";

const STATUSES = [
  ["planned", "Plan to watch"],
  ["watching", "Watching"],
  ["completed", "Completed"],
  ["dropped", "Dropped"],
];

let shelfMap = null;
let loading = null;

export function esc(text) {
  const el = document.createElement("div");
  el.textContent = text ?? "";
  return el.innerHTML;
}

export function loadShelf() {
  if (!loading) {
    loading = fetch("/api/shelf").then(async (res) => {
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`Shelf request failed: ${res.status}`);
      shelfMap = new Map((await res.json()).map((r) => [r.tmdb_id, r]));
      return shelfMap;
    });
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export function getShelfRow(id) {
  return shelfMap?.get(Number(id)) ?? null;
}

async function api(method, id, body) {
  const res = await fetch(`/api/shelf/${id}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login.html";
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function notify(id) {
  document.dispatchEvent(new CustomEvent("shelf:change", { detail: id }));
}

async function save(movie, patch) {
  const row = await api("PUT", movie.id, {
    title: movie.title ?? null,
    poster_path: movie.poster_path ?? null,
    release_date: movie.release_date || null,
    ...patch,
  });
  if (row) {
    shelfMap?.set(movie.id, row);
    notify(movie.id);
  }
}

async function remove(movie) {
  if (await api("DELETE", movie.id)) {
    shelfMap?.delete(movie.id);
    notify(movie.id);
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createShelfControls(movie, { compact = false } = {}) {
  const m = { ...movie, id: Number(movie.id) };
  const id = m.id;
  const el = make("div", "shelf-controls" + (compact ? " compact" : ""));
  let error = "";

  async function run(fn) {
    el.querySelectorAll("button, select").forEach((c) => (c.disabled = true));
    error = "";
    try {
      await fn();
    } catch (err) {
      error = err.message;
    }
    draw();
  }

  const addIfNeeded = () => (getShelfRow(id) ? {} : { status: "completed" });

  function draw() {
    const row = getShelfRow(id);
    el.replaceChildren();

    const add = make(
      "button",
      "shelf-btn" + (row ? " active" : ""),
      row ? (compact ? "✓ Shelf" : "✓ On shelf") : compact ? "+ Shelf" : "+ Add to shelf"
    );
    add.type = "button";
    add.title = row ? "Remove from shelf" : "Add to shelf";
    add.addEventListener("click", () =>
      run(async () => {
        const cur = getShelfRow(id);
        if (!cur) return save(m, { status: "planned" });
        if ((cur.liked || cur.rating) && !confirm("Remove from your shelf? Your like and rating will be lost.")) return;
        return remove(m);
      })
    );
    el.append(add);

    if (row && !compact) {
      const status = make("select", "shelf-status");
      status.setAttribute("aria-label", "Status");
      for (const [value, label] of STATUSES) {
        const o = make("option", "", label);
        o.value = value;
        status.append(o);
      }
      status.value = row.status;
      status.addEventListener("change", () => run(() => save(m, { status: status.value })));
      el.append(status);
    }

    const liked = !!row?.liked;
    const like = make("button", "shelf-btn shelf-like" + (liked ? " active" : ""), liked ? "♥" : "♡");
    if (!compact) like.textContent += liked ? " Liked" : " Like";
    like.type = "button";
    like.title = liked ? "Remove like" : "Like";
    like.setAttribute("aria-pressed", String(liked));
    like.addEventListener("click", () =>
      run(() => save(m, { liked: !getShelfRow(id)?.liked, ...addIfNeeded() }))
    );
    el.append(like);

    const rate = make("select", "shelf-rate");
    rate.setAttribute("aria-label", "Your rating");
    const none = make("option", "", compact ? "☆ Rate" : "☆ Rate it");
    none.value = "";
    rate.append(none);
    for (let n = 1; n <= 10; n++) {
      const o = make("option", "", `${n} / 10`);
      o.value = String(n);
      rate.append(o);
    }
    rate.value = row?.rating ? String(row.rating) : "";
    rate.addEventListener("change", () =>
      run(() => save(m, { rating: rate.value ? Number(rate.value) : null, ...addIfNeeded() }))
    );
    el.append(rate);

    if (error) {
      const msg = make("p", "shelf-msg", error);
      msg.setAttribute("role", "alert");
      el.append(msg);
    }
  }

  const onChange = (e) => {
    if (!el.isConnected) {
      document.removeEventListener("shelf:change", onChange);
      return;
    }
    if (e.detail === id) draw();
  };
  document.addEventListener("shelf:change", onChange);

  draw();
  return el;
}