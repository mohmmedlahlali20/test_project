<?php

namespace App\Jobs;

use App\Events\VehiclePositionUpdated;
use App\Models\Device;
use App\Models\GpsPosition;
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

    public function handle(): void
    {
        $now = Carbon::now();

        // ── 1. Normalize all dot-notation records ──────────────────────
        $normalized = array_map(fn (array $raw) => $this->normalize($raw), $this->batch);

        // ── 2. Bulk upsert devices (update last-known state) ───────────
        $deviceRows = [];
        foreach ($normalized as $record) {
            $deviceRows[] = [
                'ident'           => $record['ident'],
                'name'            => $record['device_name'] ?? null,
                'last_latitude'   => $record['position_latitude'] ?? null,
                'last_longitude'  => $record['position_longitude'] ?? null,
                'last_speed'      => $record['position_speed'] ?? 0,
                'last_direction'  => $record['position_direction'] ?? 0,
                'engine_ignition' => $record['engine_ignition_status'] ?? false,
                'movement_status' => $record['movement_status'] ?? false,
                'mileage'         => $record['vehicle_mileage'] ?? 0,
                'last_seen_at'    => isset($record['timestamp'])
                    ? Carbon::createFromTimestamp($record['timestamp'])
                    : $now,
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

        // ── 3. Map idents → device IDs (single query) ─────────────────
        $idents = array_unique(array_column($deviceRows, 'ident'));
        $deviceMap = Device::whereIn('ident', $idents)
            ->pluck('id', 'ident')
            ->toArray();

        // ── 4. Bulk insert GPS positions (historical breadcrumbs) ──────
        $positionRows = [];
        foreach ($normalized as $record) {
            $deviceId = $deviceMap[$record['ident']] ?? null;
            if (!$deviceId) {
                continue;
            }

            $positionRows[] = [
                'device_id'       => $deviceId,
                'latitude'        => $record['position_latitude'] ?? 0,
                'longitude'       => $record['position_longitude'] ?? 0,
                'speed'           => $record['position_speed'] ?? 0,
                'direction'       => $record['position_direction'] ?? 0,
                'altitude'        => $record['position_altitude'] ?? 0,
                'engine_ignition' => $record['engine_ignition_status'] ?? false,
                'movement_status' => $record['movement_status'] ?? false,
                'recorded_at'     => isset($record['timestamp'])
                    ? Carbon::createFromTimestamp($record['timestamp'])
                    : $now,
                'created_at'      => $now,
                'updated_at'      => $now,
            ];
        }

        // Chunk inserts to avoid SQLite/MySQL parameter limit
        foreach (array_chunk($positionRows, 500) as $chunk) {
            GpsPosition::insert($chunk);
        }

        // ── 5. Broadcast live position updates ─────────────────────────
        $broadcastPayload = [];
        foreach ($normalized as $record) {
            $deviceId = $deviceMap[$record['ident']] ?? null;
            if (!$deviceId) {
                continue;
            }

            $broadcastPayload[] = [
                'device_id'       => $deviceId,
                'ident'           => $record['ident'],
                'name'            => $record['device_name'] ?? null,
                'latitude'        => $record['position_latitude'] ?? 0,
                'longitude'       => $record['position_longitude'] ?? 0,
                'speed'           => $record['position_speed'] ?? 0,
                'direction'       => $record['position_direction'] ?? 0,
                'altitude'        => $record['position_altitude'] ?? 0,
                'engine_ignition' => $record['engine_ignition_status'] ?? false,
                'movement_status' => $record['movement_status'] ?? false,
                'battery_voltage' => $record['battery_voltage'] ?? $record['external_powersource_voltage'] ?? null,
                'gsm_signal'      => isset($record['gsm_signal_level']) ? round(($record['gsm_signal_level'] / 100) * 5) : null,
                'odometer'        => $record['vehicle_mileage'] ?? null,
                'recorded_at'     => isset($record['timestamp'])
                    ? Carbon::createFromTimestamp($record['timestamp'])->toIso8601String()
                    : $now->toIso8601String(),
            ];
        }

        if (!empty($broadcastPayload)) {
            try {
                broadcast(new VehiclePositionUpdated($broadcastPayload));
            } catch (\Throwable $e) {
                // Broadcasting is best-effort — don't fail the job if Reverb is down
                report($e);
            }
        }
    }

    /**
     * Flatten dot-notation keys into underscore-delimited keys.
     *
     * "position.latitude" → "position_latitude"
     * "engine.ignition.status" → "engine_ignition_status"
     */
    private function normalize(array $raw): array
    {
        $normalized = [];
        foreach ($raw as $key => $value) {
            $normalized[str_replace('.', '_', $key)] = $value;
        }

        return $normalized;
    }
}
