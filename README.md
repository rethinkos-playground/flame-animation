# Flame & River 🔥🌊

Interactive procedural animations built with **TypeScript + Three.js**. Switch between a
burning **flame** and a flowing **river** using the tabs at the top of the page.

🔗 **Live demo**: https://rethinkos-playground.github.io/flame-animation/

## Features

- **Flame** — GLSL FBM-noise fire that rises, sways and flickers, with rising ember particles
- **River** — winding river with advected flow, depth shading, specular glints and terrain banks
- Tab switcher in the header; each scene keeps its own settings
- Adjustable **color** (color picker + 5 presets), **size/width** and **speed** per scene
- Responsive layout, mobile friendly

## Local development

```bash
npm install
npm run dev      # dev server
npm run build    # type-check + production build (outputs to dist/)
npm run preview  # preview the production build
```

## Deployment

Pushing to the `main` branch triggers GitHub Actions (`.github/workflows/deploy.yml`),
which builds the project and deploys it to GitHub Pages automatically.

## Tech stack

- [Three.js](https://threejs.org/) — rendering
- [Vite](https://vite.dev/) — build tooling
- TypeScript (strict mode)