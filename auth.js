const $ = (id) => document.getElementById(id);
const set = (id, text) => { if ($(id)) $(id).textContent = text; };

export function applyAvatar(url) {
  document.querySelectorAll("a.avatar, #avatar").forEach((el) => {
    el.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : "";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  });
}

export function renderMe(me) {
  set("welcome", `Welcome, ${me.username}`);
  set("profile-name", `Hello, ${me.username}`);
  set("profile-email", me.email);
  set("profile-bio", me.bio ?? "");
  set("profile-dob", `DOB: ${me.dob ?? "N/A"}`);
  set("profile-since", `Active Since: ${me.created_at.slice(0, 10)}`);
  set("stat-completed", me.movies_completed);
  set("stat-friends", me.friends_made);
  set("stat-dropped", me.movies_dropped);
  applyAvatar(me.avatar_url);
}

async function initAuth() {
  let me = null;
  try {
    const res = await fetch("/api/me");
    if (res.ok) me = await res.json();
  } catch { /* server not running: stay in logged-out mode */ }
  if (!me) return null;

  const buttons = document.querySelector(".auth-buttons");
  if (buttons) {
    buttons.innerHTML = "";
    const out = document.createElement("a");
    out.href = "#";
    out.className = "btn btn-login";
    out.textContent = "Log out";
    out.addEventListener("click", async (e) => {
      e.preventDefault();
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/index.html";
    });
    buttons.appendChild(out);
  }

  renderMe(me);
  return me;
}

export const mePromise = initAuth();