<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessGpsBatchJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GpsIngestController extends Controller
{
    /**
     * Ingest GPS telemetry data from IoT devices.
     *
     * Accepts a single telemetry object or an array of objects.
     * Immediately offloads to a queued job for async processing,
     * returning HTTP 202 within sub-20ms target.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $payload = $request->json()->all();

        // Normalize: wrap single object into array for uniform processing
        $batch = isset($payload['ident']) ? [$payload] : array_values($payload);

        // Validate we actually have data to process
        if (empty($batch)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No telemetry data provided.',
            ], 422);
        }

        // Fire-and-forget: dispatch to queue immediately
        ProcessGpsBatchJob::dispatch($batch);

        return response()->json([
            'status' => 'queued',
            'count'  => count($batch),
        ], 202);
    }
}
