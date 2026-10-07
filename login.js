document.getElementById("login-form").addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (email && password) {
        window.location.href = "index.html";
    }
});