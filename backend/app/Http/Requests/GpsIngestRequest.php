<?php

namespace App\Http\Requests;

use App\Services\Telemetry\TelemetryNormalizer;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Symfony\Component\HttpFoundation\Response;

class GpsIngestRequest extends FormRequest
{
    /**
     * Store normalized batch internally.
     *
     * @var array<int, array>
     */
    protected array $normalizedBatch = [];

    /**
     * Determine if the user is authorized to make this request.
     * IoT telemetry ingest is unauthenticated (devices identify via ident).
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare raw input for validation.
     * Extracts and normalizes both single-object and batch-array Flespi/IoT payloads,
     * flattening dotted keys before Laravel's Validator runs.
     */
    protected function prepareForValidation(): void
    {
        $normalizer = app(TelemetryNormalizer::class);

        // 1. Extract raw data (support json(), all(), or raw body string)
        $raw = $this->json()->all();

        if (empty($raw)) {
            $content = $this->getContent();
            $decoded = json_decode($content, true);
            $raw = is_array($decoded) ? $decoded : $this->all();
        }

        // 2. Extract batch array
        $batch = $normalizer->extractBatch($raw);

        // 3. Normalize each record in the batch
        $this->normalizedBatch = array_map(
            fn (array $record) => $normalizer->normalizeRecord($record),
            $batch
        );

        // Replace request data with normalized structure for standard validation
        $this->merge([
            'telemetry' => $this->normalizedBatch,
        ]);
    }

    /**
     * Validation rules for the normalized telemetry payload.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'telemetry'                      => ['required', 'array', 'min:1'],
            'telemetry.*.ident'              => ['required', 'string', 'max:64'],
            'telemetry.*.position_latitude'  => ['required', 'numeric', 'between:-90,90'],
            'telemetry.*.position_longitude' => ['required', 'numeric', 'between:-180,180'],
            'telemetry.*.position_speed'     => ['nullable', 'numeric', 'min:0'],
            'telemetry.*.position_direction' => ['nullable', 'numeric'],
            'telemetry.*.position_altitude'  => ['nullable', 'numeric'],
            'telemetry.*.engine_ignition_status' => ['nullable', 'boolean'],
            'telemetry.*.movement_status'    => ['nullable', 'boolean'],
            'telemetry.*.vehicle_mileage'    => ['nullable', 'numeric', 'min:0'],
            'telemetry.*.timestamp'          => ['nullable', 'integer'],
        ];
    }

    /**
     * Custom validation attributes for clean error messages.
     */
    public function attributes(): array
    {
        return [
            'telemetry.*.ident'              => 'device identifier (ident)',
            'telemetry.*.position_latitude'  => 'latitude',
            'telemetry.*.position_longitude' => 'longitude',
            'telemetry.*.position_speed'     => 'speed',
            'telemetry.*.position_direction' => 'direction/heading',
        ];
    }

    /**
     * Custom error response for IoT clients.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'status'  => 'error',
                'message' => 'Telemetry validation failed.',
                'errors'  => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY)
        );
    }

    /**
     * Return the fully normalized telemetry batch ready for queue dispatch.
     *
     * @return array<int, array>
     */
    public function telemetryBatch(): array
    {
        return $this->validated()['telemetry'] ?? $this->normalizedBatch;
    }
}
