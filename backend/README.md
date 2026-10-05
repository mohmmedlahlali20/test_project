# 🛰️ Fleet Tracker — Backend Service (Laravel 11+ & Reverb)

This directory contains the telematics processing engine, real-time WebSocket server, and API services for Fleet Tracker.

For the complete project overview, architecture diagram, and monorepo documentation, see the [Root README](../README.md).

---

## ⚡ Architecture & Services

- **Ingestion Controller:** `app/Http/Controllers/Api/GpsIngestController.php` — receives single or batched GPS packets, normalizes keys, and offloads immediately to async queue within 20ms (`HTTP 202 Accepted`).
- **Batch Processing Job:** `app/Jobs/ProcessGpsBatchJob.php` — flattens dot-notated payload attributes, executes bulk `Device::upsert()` for last-known state, chunk-inserts breadcrumbs into `gps_positions`, and broadcasts live coordinates.
- **WebSocket Broadcasting:** `app/Events/VehiclePositionUpdated.php` — broadcasts on `fleet-tracker` channel using Laravel Reverb.
- **Fleet Simulator:** `app/Console/Commands/FleetSimulateCommand.php` — simulates multi-vehicle telemetry drift, speed, and heading.

---

## 🚀 Running the Services

```bash
# 1. Install dependencies
composer install

# 2. Setup environment
cp .env.example .env
php artisan key:generate
php artisan migrate

# 3. Start Reverb WebSocket Server
php artisan reverb:start --port=8080

# 4. Start Queue Worker
php artisan queue:work --tries=3

# 5. Start API Server
php artisan serve --port=8000
```

---

## 📄 License

CC-BY-NC 4.0. Please refer to [LICENSE](../LICENSE) in the project root.
