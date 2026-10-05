<?php

namespace Tests\Feature;

use App\Events\VehiclePositionUpdated;
use App\Jobs\ProcessGpsBatchJob;
use App\Models\Device;
use App\Models\GpsPosition;
use App\Services\Telemetry\TelemetryNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class GpsIngestTest extends TestCase
{
    use RefreshDatabase;

    private array $flespiPayload = [
        "battery.voltage" => 3.938,
        "channel.id" => 429,
        "device.id" => 182083,
        "device.name" => "Vehicle 01",
        "device.type.id" => 744,
        "engine.ignition.status" => true,
        "event.priority.enum" => 0,
        "external.powersource.voltage" => 12.64,
        "gnss.state.enum" => 1,
        "gnss.status" => true,
        "gsm.cellid" => 11511,
        "gsm.lac" => 108,
        "gsm.mcc" => 257,
        "gsm.mnc" => 1,
        "gsm.operator.code" => "25701",
        "gsm.signal.level" => 80,
        "ident" => "111115555599999",
        "movement.status" => true,
        "peer" => "185.213.2.10:59924",
        "position.altitude" => 244,
        "position.direction" => 281,
        "position.hdop" => 0.3,
        "position.latitude" => 33.5731104,
        "position.longitude" => -7.5898434,
        "position.satellites" => 15,
        "position.speed" => 45,
        "position.valid" => true,
        "protocol.id" => 14,
        "server.timestamp" => 1678346072.792816,
        "timestamp" => 1678346071,
        "vehicle.mileage" => 36713.703,
    ];

    public function test_ingest_endpoint_accepts_flespi_single_payload_and_queues_job(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/gps/ingest', $this->flespiPayload);

        $response->assertStatus(202)
            ->assertJson([
                'status' => 'queued',
                'count'  => 1,
            ]);

        Queue::assertPushed(ProcessGpsBatchJob::class, function (ProcessGpsBatchJob $job) {
            return count($job->batch) === 1
                && ($job->batch[0]['ident'] ?? null) === '111115555599999'
                && ($job->batch[0]['position_latitude'] ?? null) == 33.5731104
                && ($job->batch[0]['position_longitude'] ?? null) == -7.5898434;
        });
    }

    public function test_ingest_endpoint_accepts_flespi_batch_array(): void
    {
        Queue::fake();

        $secondVehicle = array_merge($this->flespiPayload, [
            'ident'       => '222225555599999',
            'device.name' => 'Vehicle 02',
        ]);

        $response = $this->postJson('/api/gps/ingest', [
            $this->flespiPayload,
            $secondVehicle,
        ]);

        $response->assertStatus(202)
            ->assertJson([
                'status' => 'queued',
                'count'  => 2,
            ]);

        Queue::assertPushed(ProcessGpsBatchJob::class, function (ProcessGpsBatchJob $job) {
            return count($job->batch) === 2;
        });
    }

    public function test_ingest_endpoint_validates_required_fields(): void
    {
        // Missing ident
        $invalidPayload = $this->flespiPayload;
        unset($invalidPayload['ident']);
        unset($invalidPayload['device.id']);

        $response = $this->postJson('/api/gps/ingest', $invalidPayload);
        $response->assertStatus(422)
            ->assertJsonStructure(['status', 'message', 'errors']);

        // Invalid latitude (> 90)
        $invalidLat = array_merge($this->flespiPayload, [
            'position.latitude' => 95.1234,
        ]);

        $response = $this->postJson('/api/gps/ingest', $invalidLat);
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['telemetry.0.position_latitude']);
    }

    public function test_process_gps_batch_job_persists_and_broadcasts_flespi_data(): void
    {
        Event::fake([VehiclePositionUpdated::class]);

        $job = new ProcessGpsBatchJob([$this->flespiPayload]);
        $job->handle(app(TelemetryNormalizer::class));

        $this->assertDatabaseHas('devices', [
            'ident'           => '111115555599999',
            'name'            => 'Vehicle 01',
            'last_speed'      => 45,
            'last_direction'  => 281,
            'engine_ignition' => true,
            'movement_status' => true,
        ]);

        $device = Device::where('ident', '111115555599999')->firstOrFail();
        $this->assertEqualsWithDelta(33.5731104, (float) $device->last_latitude, 0.0001);
        $this->assertEqualsWithDelta(-7.5898434, (float) $device->last_longitude, 0.0001);
        $this->assertEqualsWithDelta(36713.703, (float) $device->mileage, 0.01);
        $this->assertEquals(1678346071, $device->last_seen_at->timestamp);

        $this->assertDatabaseHas('gps_positions', [
            'device_id'       => $device->id,
            'speed'           => 45,
            'direction'       => 281,
            'altitude'        => 244,
            'engine_ignition' => true,
            'movement_status' => true,
        ]);

        Event::assertDispatched(VehiclePositionUpdated::class, function (VehiclePositionUpdated $event) {
            $pos = $event->positions[0] ?? [];
            return ($pos['ident'] ?? null) === '111115555599999'
                && ($pos['battery_voltage'] ?? null) == 3.938
                && ($pos['speed'] ?? null) == 45
                && ($pos['gsm_signal'] ?? null) == 4
                && ($pos['odometer'] ?? null) == 36713.703;
        });
    }

    public function test_multi_point_batch_for_same_device_deduplicates_upsert_and_stores_all_positions(): void
    {
        Event::fake([VehiclePositionUpdated::class]);

        $point1 = array_merge($this->flespiPayload, [
            'timestamp'         => 1678346071,
            'position.latitude' => 33.5730,
            'position.speed'    => 40,
        ]);

        $point2 = array_merge($this->flespiPayload, [
            'timestamp'         => 1678346075,
            'position.latitude' => 33.5740,
            'position.speed'    => 50,
        ]);

        $job = new ProcessGpsBatchJob([$point1, $point2]);
        $job->handle(app(TelemetryNormalizer::class));

        // Device should reflect latest state (point2)
        $device = Device::where('ident', '111115555599999')->firstOrFail();
        $this->assertEquals(50, $device->last_speed);
        $this->assertEqualsWithDelta(33.5740, (float) $device->last_latitude, 0.0001);
        $this->assertEquals(1678346075, $device->last_seen_at->timestamp);

        // But both historical positions must exist in database
        $this->assertEquals(2, $device->positions()->count());
    }

    public function test_fallback_device_identifier_when_ident_is_missing(): void
    {
        Queue::fake();

        $payload = $this->flespiPayload;
        unset($payload['ident']);
        $payload['device.id'] = 987654;

        $response = $this->postJson('/api/gps/ingest', $payload);
        $response->assertStatus(202);

        Queue::assertPushed(ProcessGpsBatchJob::class, function (ProcessGpsBatchJob $job) {
            return ($job->batch[0]['ident'] ?? null) === '987654';
        });
    }
}
