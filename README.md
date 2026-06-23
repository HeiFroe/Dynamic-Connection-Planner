# Dynamic Connection Planner

A React + TypeScript single-page app for visually planning AV/IT connections in conference rooms. Place hardware assets on a canvas, connect their ports with typed cables, and export the result as a standalone HTML file.

## Features

- **Visual Canvas** — drag & drop hardware assets, zoom/pan, room areas
- **Port-based Connections** — typed ports (HDMI, USB-C, RJ45, etc.) with compatibility checks
- **Layer System** — toggle video/USB/power/ethernet/other layers independently
- **Asset Management** — create and edit custom hardware assets with port configuration
- **Orthogonal Cable Routing** — automatic routing with obstacle avoidance
- **HTML Export** — standalone export for field use without the app
- **Sample Library** — Logitech Rally Bar, LG displays, TAP, and more pre-configured

## Getting Started

```bash
npm install
npm start        # dev server at http://localhost:3000
npm test         # run tests
npm run build    # production build
```

## Stack

- React 18 + TypeScript (strict mode)
- Tailwind CSS
- Custom SVG canvas (no React Flow / Konva)
- localStorage for persistence — no backend required

## Project Structure

```
src/
├── components/creator/     # Canvas, assets, connections, controls
├── components/management/  # Asset library management
├── components/ui/          # UI primitives
├── store/useAppStore.ts    # Single state owner
├── types/index.ts          # All TypeScript types
├── utils/                  # Routing, compatibility, export
├── config/                 # Logitech MicPod rules
└── data/                   # Sample asset library
```
