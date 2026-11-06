import { defineConfig } from 'vite';

// Relative base so the build works both locally and under
// https://<org>.github.io/<repo>/ on GitHub Pages.
export default defineConfig({
  base: './',
});