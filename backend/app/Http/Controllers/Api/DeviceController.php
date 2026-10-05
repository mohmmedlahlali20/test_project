<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    /**
     * GET /api/devices
     *
     * Returns all devices with their latest known coordinates.
     * Optionally filter by ?active_minutes=N to show only recently-seen devices.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Device::query()
            ->select([
                'id',
                'ident',
                'name',
                'last_latitude',
                'last_longitude',
                'last_speed',
                'last_direction',
                'engine_ignition',
                'movement_status',
                'mileage',
                'last_seen_at',
            ])
            ->orderByDesc('last_seen_at');

        // Optional: filter to only "active" devices seen within N minutes
        if ($minutes = $request->integer('active_minutes')) {
            $query->where('last_seen_at', '>=', now()->subMinutes($minutes));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    /**
     * GET /api/devices/{ident}/history
     *
     * Returns the last N GPS positions for a specific device,
     * ordered by recorded_at DESC for polyline trajectory drawing.
     */
    public function history(Request $request, string $ident): JsonResponse
    {
        $device = Device::where('ident', $ident)->first();

        if (!$device) {
            return response()->json([
                'message' => 'Device not found.',
            ], 404);
        }

        $limit = $request->integer('limit', 100);
        $limit = min($limit, 1000); // Hard cap to prevent abuse

        $positions = $device->positions()
            ->select([
                'id',
                'latitude',
                'longitude',
                'speed',
                'direction',
                'altitude',
                'engine_ignition',
                'movement_status',
                'recorded_at',
            ])
            ->orderByDesc('recorded_at')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();

        return response()->json([
            'device' => [
                'id'    => $device->id,
                'ident' => $device->ident,
                'name'  => $device->name,
            ],
            'data' => $positions,
        ]);
    }
}
