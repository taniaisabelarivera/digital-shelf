// Browser-side signup. The database (sqlite) lives on the server, never in the browser.
// Until the backend exists, this validates the form and moves on to login.
// TODO: replace the stub with  fetch("/api/signup", { method: "POST", ... })
const form = document.getElementById("signup-form");
const errorBox = document.getElementById("signup-error");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorBox.textContent = "";

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (username.length < 3) {
    errorBox.textContent = "Username must be at least 3 characters.";
    return;
  }
  if (password.length < 8) {
    errorBox.textContent = "Password must be at least 8 characters.";
    return;
  }

  console.log("Signup stub:", { username, email }); // never log passwords
  window.location.href = "/login.html";
});