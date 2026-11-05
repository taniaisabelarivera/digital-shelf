import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '^/signup$': 'http://localhost:3000'
    }
  }
});