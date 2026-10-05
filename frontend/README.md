# 🛰️ Fleet Tracker — Frontend Dashboard (React 19 + Leaflet)

This directory contains the real-time mission control map dashboard for Fleet Tracker built with React 19, TypeScript, Vite, Tailwind CSS v4, and Leaflet.

For the complete project overview, architecture diagram, and monorepo documentation, see the [Root README](../README.md).

---

## ⚡ Key Frontend Features

- **Interactive Leaflet Map:** Dark-mode styling, directional vehicle markers rotated by heading angle, moving/idle/offline status animations.
- **OSRM Road Snapping (`useSnappedRoute`):** Snaps raw GPS breadcrumbs to real road vectors with in-memory LRU caching, uniform downsampling, and debounce handling.
- **Real-Time Telemetry HUD:** Floating glassmorphic HUD showing live speed gauge, compass bearing, altitude, battery voltage, GSM signal, odometer, and ignition status.
- **Real-Time WebSocket Integration:** Listens to `fleet-tracker` public channel over Laravel Reverb via Laravel Echo and Pusher JS.
- **Fleet Filter & Search:** Real-time filtering by status (Moving, Idle, Offline) and vehicle identifier / name.
- **Manual Camera Memory:** Smooth pan/zoom tracking that preserves operator view across live telemetry streaming updates.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Start development server
npm run dev
```

---

## 📄 License

CC-BY-NC 4.0. Please refer to [LICENSE](../LICENSE) in the project root.
