<?php

namespace App\Jobs;

use App\Events\VehiclePositionUpdated;
use App\Models\Device;
use App\Models\GpsPosition;
use App\Services\Telemetry\TelemetryNormalizer;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessGpsBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Maximum retry attempts before failing permanently.
     */
    public int $tries = 3;

    /**
     * Backoff strategy (seconds) between retries.
     */
    public array $backoff = [5, 15, 30];

    public function __construct(
        public readonly array $batch,
    ) {}

    public function handle(TelemetryNormalizer $normalizer): void
    {
        $now = Carbon::now();

        // ── 1. Normalize all records (handles Flespi dotted, nested, or snake_case) ──
        $normalized = array_values(array_filter(
            array_map(fn (array $raw) => $normalizer->normalizeRecord($raw), $this->batch),
            fn (array $item) => !empty($item['ident']) && $item['position_latitude'] !== null && $item['position_longitude'] !== null
        ));

        if (empty($normalized)) {
            return;
        }

        // ── 2. Deduplicate devices per ident (use most recent telemetry state) ──
        // This avoids SQL unique constraint/cardinality violations on multi-row upserts
        $latestByDevice = [];
        foreach ($normalized as $record) {
            $ident = (string) $record['ident'];
            if (!isset($latestByDevice[$ident]) || ($record['timestamp'] >= $latestByDevice[$ident]['timestamp'])) {
                $latestByDevice[$ident] = $record;
            }
        }

        $idents = array_keys($latestByDevice);

        // Preload existing device names to avoid overwriting them with null
        $existingDevices = Device::whereIn('ident', $idents)
            ->get(['id', 'ident', 'name'])
            ->keyBy('ident');

        $deviceRows = [];
        foreach ($latestByDevice as $ident => $record) {
            $existing = $existingDevices->get($ident);
            $deviceName = !empty($record['device_name'])
                ? $record['device_name']
                : ($existing?->name ?? ('Vehicle ' . substr($ident, -4)));

            $recordedAt = isset($record['timestamp'])
                ? Carbon::createFromTimestamp($record['timestamp'])
                : $now;

            $deviceRows[] = [
                'ident'           => $ident,
                'name'            => $deviceName,
                'last_latitude'   => $record['position_latitude'],
                'last_longitude'  => $record['position_longitude'],
                'last_speed'      => $record['position_speed'] ?? 0,
                'last_direction'  => $record['position_direction'] ?? 0,
                'engine_ignition' => (bool) ($record['engine_ignition_status'] ?? false),
                'movement_status' => (bool) ($record['movement_status'] ?? false),
                'mileage'         => $record['vehicle_mileage'] ?? 0,
                'last_seen_at'    => $recordedAt,
                'updated_at'      => $now,
                'created_at'      => $now,
            ];
        }

        Device::upsert(
            $deviceRows,
            uniqueBy: ['ident'],
            update: [
                'name',
                'last_latitude',
                'last_longitude',
                'last_speed',
                'last_direction',
                'engine_ignition',
                'movement_status',
                'mileage',
                'last_seen_at',
                'updated_at',
            ],
        );

        // ── 3. Map idents → Device IDs in a single query ───────────────────────
        $deviceMap = Device::whereIn('ident', $idents)
            ->pluck('id', 'ident')
            ->toArray();

        // ── 4. Bulk insert GPS positions (historical breadcrumbs) ───────────────
        $positionRows = [];
        foreach ($normalized as $record) {
            $ident = (string) $record['ident'];
            $deviceId = $deviceMap[$ident] ?? null;
            if (!$deviceId) {
                continue;
            }

            $recordedAt = isset($record['timestamp'])
                ? Carbon::createFromTimestamp($record['timestamp'])
                : $now;

            $positionRows[] = [
                'device_id'       => $deviceId,
                'latitude'        => $record['position_latitude'],
                'longitude'       => $record['position_longitude'],
                'speed'           => $record['position_speed'] ?? 0,
                'direction'       => $record['position_direction'] ?? 0,
                'altitude'        => $record['position_altitude'] ?? 0,
                'engine_ignition' => (bool) ($record['engine_ignition_status'] ?? false),
                'movement_status' => (bool) ($record['movement_status'] ?? false),
                'recorded_at'     => $recordedAt,
                'created_at'      => $now,
                'updated_at'      => $now,
            ];
        }

        // Chunk inserts to avoid SQLite/MySQL parameter limit
        foreach (array_chunk($positionRows, 500) as $chunk) {
            GpsPosition::insert($chunk);
        }

        // ── 5. Broadcast live position updates over WebSocket ───────────────────
        $broadcastPayload = [];
        foreach ($normalized as $record) {
            $ident = (string) $record['ident'];
            $deviceId = $deviceMap[$ident] ?? null;
            if (!$deviceId) {
                continue;
            }

            $recordedAt = isset($record['timestamp'])
                ? Carbon::createFromTimestamp($record['timestamp'])->toIso8601String()
                : $now->toIso8601String();

            $broadcastPayload[] = [
                'device_id'       => $deviceId,
                'ident'           => $ident,
                'name'            => $record['device_name'] ?? ($existingDevices->get($ident)?->name ?? 'Vehicle ' . substr($ident, -4)),
                'latitude'        => $record['position_latitude'],
                'longitude'       => $record['position_longitude'],
                'speed'           => $record['position_speed'] ?? 0,
                'direction'       => $record['position_direction'] ?? 0,
                'altitude'        => $record['position_altitude'] ?? 0,
                'engine_ignition' => (bool) ($record['engine_ignition_status'] ?? false),
                'movement_status' => (bool) ($record['movement_status'] ?? false),
                'battery_voltage' => $record['battery_voltage'] ?? $record['external_powersource_voltage'] ?? null,
                'gsm_signal'      => $record['gsm_signal_bars'] ?? (isset($record['gsm_signal_level']) ? round(($record['gsm_signal_level'] / 100) * 5) : null),
                'odometer'        => $record['vehicle_mileage'] ?? null,
                'recorded_at'     => $recordedAt,
            ];
        }

        if (!empty($broadcastPayload)) {
            try {
                broadcast(new VehiclePositionUpdated($broadcastPayload));
            } catch (\Throwable $e) {
                // Broadcasting is best-effort — don't fail the job if Reverb is temporarily down
                report($e);
            }
        }
    }
}
