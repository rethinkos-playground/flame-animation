# Flame, River & Water Tank 🔥🌊💧

Interactive procedural animations built with **TypeScript + Three.js**. Switch between a
burning **flame**, a flowing **river**, and a draggable **water tank** using the tabs at the
top of the page.

🔗 **Live demo**: https://rethinkos-playground.github.io/flame-animation/

## Features

- **Flame** — GLSL FBM-noise fire that rises, sways and flickers, with rising ember particles
- **River** — winding river with advected flow, depth shading, specular glints and terrain banks
- **Water Tank** — a glass tank you can **drag** around; the water sloshes in response, simulated
  with a 1D wave-equation heightfield driven by the tank's acceleration (waves reflect off the walls)
- Tab switcher in the header; each scene keeps its own settings
- Adjustable **color** (color picker + 5 presets), **size/level** and **speed** per scene
- Responsive layout, mobile friendly (touch drag supported)

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