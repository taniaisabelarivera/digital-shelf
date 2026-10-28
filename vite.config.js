import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-page build: every HTML page must be listed here or it won't ship.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        login: resolve(import.meta.dirname, "login.html"),
        signup: resolve(import.meta.dirname, "signup.html"),
        profile: resolve(import.meta.dirname, "profile.html"),
        movie: resolve(import.meta.dirname, "movie.html"),
        community: resolve(import.meta.dirname, "communitypage.html"),
      },
    },
  },
});