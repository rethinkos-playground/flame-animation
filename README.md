# Flame Animation 🔥

An interactive procedural flame animation built with **TypeScript + Three.js**.

🔗 **Live demo**: https://rethinkos-playground.github.io/flame-animation/

## Features

- GLSL FBM-noise flame that rises, sways and flickers in real time
- Rising ember particles (custom Points shader)
- Adjustable flame **color** (color picker + 5 presets)
- Adjustable flame **size** and burn speed
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