const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) { errorBox.textContent = data.error; return; }
    window.location.href = "/index.html";
  } catch {
    errorBox.textContent = "Can't reach the server. Is `npm run server` running?";
  }
});