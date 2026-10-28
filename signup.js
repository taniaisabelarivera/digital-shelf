const form = document.getElementById("signup-form");
const errorBox = document.getElementById("signup-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) { errorBox.textContent = data.error; return; }
    window.location.href = "/index.html"; // signup also logs you in
  } catch {
    errorBox.textContent = "Can't reach the server. Is `npm run server` running?";
  }
});