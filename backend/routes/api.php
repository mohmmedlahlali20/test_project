<?php

use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\GpsIngestController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Fleet Tracker API Routes
|--------------------------------------------------------------------------
|
| POST /api/gps/ingest              → High-throughput GPS telemetry ingestion
| GET  /api/devices                  → List all devices with latest positions
| GET  /api/devices/{ident}/history  → Device trajectory history
|
*/

// ── Ingestion (unauthenticated — devices use ident-based identity) ─────
Route::post('/gps/ingest', GpsIngestController::class)
    ->name('gps.ingest');

// ── Read Endpoints ─────────────────────────────────────────────────────
Route::get('/devices', [DeviceController::class, 'index'])
    ->name('devices.index');

Route::get('/devices/{ident}/history', [DeviceController::class, 'history'])
    ->name('devices.history');
