<?php

namespace App\Services\Telemetry;

use Carbon\Carbon;
use Carbon\Exceptions\InvalidFormatException;

class TelemetryNormalizer
{
    /**
     * Parse raw request content into a standard array of records.
     * Handles single JSON objects, JSON arrays, and raw string payloads.
     *
     * @param mixed $input
     * @return array<int, array>
     */
    public function extractBatch(mixed $input): array
    {
        if (is_string($input)) {
            $decoded = json_decode($input, true);
            $input = is_array($decoded) ? $decoded : [];
        }

        if (!is_array($input) || empty($input)) {
            return [];
        }

        // If it's a single associative object, wrap in an array
        if (!array_is_list($input)) {
            return [$input];
        }

        return $input;
    }

    /**
     * Normalize a single raw telemetry record (Flespi dotted, nested, or snake_case)
     * into a canonical flat telematics record.
     *
     * @param array $raw
     * @return array
     */
    public function normalizeRecord(array $raw): array
    {
        // 1. Flatten both dotted keys and nested arrays into underscore-delimited keys
        $flattened = $this->flattenKeys($raw);

        // 2. Resolve Identifier (ident > device.id > device_id > imei)
        $ident = $flattened['ident']
            ?? $flattened['device_id']
            ?? $flattened['imei']
            ?? null;

        if ($ident !== null) {
            $ident = trim((string) $ident);
        }

        // 3. Resolve Device Name
        $name = $flattened['device_name']
            ?? $flattened['name']
            ?? null;

        // 4. Resolve Coordinates
        $latitude = $flattened['position_latitude']
            ?? $flattened['latitude']
            ?? $flattened['lat']
            ?? null;

        $longitude = $flattened['position_longitude']
            ?? $flattened['longitude']
            ?? $flattened['lng']
            ?? $flattened['lon']
            ?? null;

        // 5. Resolve Speed, Direction & Altitude
        $speed = $flattened['position_speed']
            ?? $flattened['speed']
            ?? 0;

        $direction = $flattened['position_direction']
            ?? $flattened['direction']
            ?? $flattened['heading']
            ?? 0;

        $altitude = $flattened['position_altitude']
            ?? $flattened['altitude']
            ?? 0;

        // 6. Resolve Status Flags
        $engineIgnition = isset($flattened['engine_ignition_status'])
            ? filter_var($flattened['engine_ignition_status'], FILTER_VALIDATE_BOOLEAN)
            : (isset($flattened['engine_ignition']) ? filter_var($flattened['engine_ignition'], FILTER_VALIDATE_BOOLEAN) : false);

        $movementStatus = isset($flattened['movement_status'])
            ? filter_var($flattened['movement_status'], FILTER_VALIDATE_BOOLEAN)
            : ($speed > 3);

        $positionValid = isset($flattened['position_valid'])
            ? filter_var($flattened['position_valid'], FILTER_VALIDATE_BOOLEAN)
            : true;

        // 7. Resolve Mileage / Odometer
        $mileage = $flattened['vehicle_mileage']
            ?? $flattened['mileage']
            ?? $flattened['odometer']
            ?? 0;

        // 8. Resolve Voltages & GSM Signal
        $batteryVoltage = $flattened['battery_voltage'] ?? null;
        $externalVoltage = $flattened['external_powersource_voltage'] ?? null;
        $gsmSignalLevel = $flattened['gsm_signal_level'] ?? null;

        // Calculate 1-5 signal bars
        $gsmBars = null;
        if ($gsmSignalLevel !== null && is_numeric($gsmSignalLevel)) {
            $gsmVal = (float) $gsmSignalLevel;
            $gsmBars = $gsmVal > 5 ? (int) min(5, max(1, round(($gsmVal / 100) * 5))) : (int) $gsmVal;
        }

        // 9. Resolve Timestamp
        $timestamp = $this->parseTimestamp(
            $flattened['timestamp']
            ?? $flattened['server_timestamp']
            ?? $flattened['recorded_at']
            ?? null
        );

        return [
            'ident'                        => $ident,
            'device_name'                  => $name,
            'position_latitude'            => $latitude !== null ? (float) $latitude : null,
            'position_longitude'           => $longitude !== null ? (float) $longitude : null,
            'position_speed'               => (float) $speed,
            'position_direction'           => (float) $direction,
            'position_altitude'            => (float) $altitude,
            'engine_ignition_status'       => $engineIgnition,
            'movement_status'              => $movementStatus,
            'position_valid'               => $positionValid,
            'vehicle_mileage'              => (float) $mileage,
            'battery_voltage'              => $batteryVoltage !== null ? (float) $batteryVoltage : null,
            'external_powersource_voltage' => $externalVoltage !== null ? (float) $externalVoltage : null,
            'gsm_signal_level'             => $gsmSignalLevel !== null ? (float) $gsmSignalLevel : null,
            'gsm_signal_bars'              => $gsmBars,
            'timestamp'                    => $timestamp->timestamp,
            'recorded_at'                  => $timestamp->toIso8601String(),
            'raw_attributes'               => $flattened,
        ];
    }

    /**
     * Recursively flatten dotted string keys and nested associative arrays into underscore-delimited keys.
     *
     * Example:
     *   ["position.latitude" => 33.5] -> ["position_latitude" => 33.5]
     *   ["position" => ["latitude" => 33.5]] -> ["position_latitude" => 33.5]
     */
    public function flattenKeys(array $array, string $prefix = ''): array
    {
        $result = [];

        foreach ($array as $key => $value) {
            // Replace dots in key name with underscores
            $cleanKey = str_replace(['.', '-'], '_', (string) $key);
            $fullKey = $prefix === '' ? $cleanKey : "{$prefix}_{$cleanKey}";

            if (is_array($value) && !array_is_list($value)) {
                // Recursively flatten nested associative arrays
                $result = array_merge($result, $this->flattenKeys($value, $fullKey));
            } else {
                $result[$fullKey] = $value;
            }
        }

        return $result;
    }

    /**
     * Parse various IoT timestamp representations (epoch seconds, epoch float, epoch milliseconds, ISO string).
     */
    private function parseTimestamp(mixed $rawTimestamp): Carbon
    {
        if ($rawTimestamp === null || $rawTimestamp === '') {
            return Carbon::now();
        }

        if (is_numeric($rawTimestamp)) {
            $num = (float) $rawTimestamp;

            // Detect millisecond epoch (e.g. 1678346071000 > 20000000000)
            if ($num > 20000000000) {
                return Carbon::createFromTimestampMs((int) $num);
            }

            return Carbon::createFromTimestamp((int) $num);
        }

        try {
            return Carbon::parse($rawTimestamp);
        } catch (InvalidFormatException) {
            return Carbon::now();
        }
    }
}
