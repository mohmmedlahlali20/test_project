<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GpsIngestRequest;
use App\Jobs\ProcessGpsBatchJob;
use Illuminate\Http\JsonResponse;

class GpsIngestController extends Controller
{
    /**
     * Ingest GPS telemetry data from IoT devices.
     *
     * Accepts:
     * - Single Flespi / IoT JSON object with dotted keys ("position.latitude", etc.)
     * - Batch array of telemetry objects
     * - Nested or snake_case formats
     *
     * Immediately dispatches to an asynchronous queue job for high throughput
     * and returns HTTP 202 Accepted within sub-20ms.
     */
    public function __invoke(GpsIngestRequest $request): JsonResponse
    {
        $batch = $request->telemetryBatch();

        // Fire-and-forget: dispatch to queue immediately
        ProcessGpsBatchJob::dispatch($batch);

        return response()->json([
            'status' => 'queued',
            'count'  => count($batch),
        ], 202);
    }
}
