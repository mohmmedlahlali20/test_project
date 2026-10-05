<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class FleetSimulateCommand extends Command
{
    protected $signature = 'fleet:simulate
        {--interval=2 : Seconds between each telemetry batch}
        {--vehicles=3 : Number of simulated vehicles}
        {--url= : Override the ingestion endpoint URL}';

    protected $description = 'Simulate GPS telemetry from multiple vehicles for testing the ingestion pipeline';

    /**
     * Simulated vehicles with starting positions (lat/lng around a city center).
     */
    private array $vehicles = [
        [
            'ident'   => '111110000000001',
            'name'    => 'Truck Alpha',
            'lat'     => 33.5892,
            'lng'     => -7.6185,
            'speed'   => 0,
            'heading' => 0,
            'mileage' => 15234.5,
        ],
        [
            'ident'   => '111110000000002',
            'name'    => 'Van Beta',
            'lat'     => 33.5950,
            'lng'     => -7.6050,
            'speed'   => 0,
            'heading' => 90,
            'mileage' => 48120.3,
        ],
        [
            'ident'   => '111110000000003',
            'name'    => 'Car Gamma',
            'lat'     => 33.5780,
            'lng'     => -7.6250,
            'speed'   => 0,
            'heading' => 180,
            'mileage' => 91002.7,
        ],
    ];

    public function handle(): int
    {
        $interval = max(1, (int) $this->option('interval'));
        $vehicleCount = min((int) $this->option('vehicles'), count($this->vehicles));
        $url = $this->option('url') ?: 'http://127.0.0.1:8000/api/gps/ingest';

        $activeVehicles = array_slice($this->vehicles, 0, $vehicleCount);

        $this->info("🚀 Fleet Simulator Started");
        $this->info("   Vehicles: {$vehicleCount}");
        $this->info("   Interval: {$interval}s");
        $this->info("   Endpoint: {$url}");
        $this->newLine();

        $tick = 0;

        while (true) {
            $tick++;
            $batch = [];

            foreach ($activeVehicles as &$vehicle) {
                // Simulate movement: drift position + randomize speed/heading
                $vehicle['speed'] = rand(0, 120);
                $vehicle['heading'] = fmod($vehicle['heading'] + rand(-30, 30) + 360, 360);

                // Move position based on speed + heading (simplified)
                $distKm = ($vehicle['speed'] / 3600) * $interval; // km traveled this tick
                $vehicle['lat'] += $distKm * cos(deg2rad($vehicle['heading'])) / 111.32;
                $vehicle['lng'] += $distKm * sin(deg2rad($vehicle['heading'])) / (111.32 * cos(deg2rad($vehicle['lat'])));
                $vehicle['mileage'] += $distKm;

                $ignition = $vehicle['speed'] > 0;

                $batch[] = [
                    'battery.voltage'               => round(3.7 + (rand(0, 300) / 1000), 3),
                    'channel.id'                     => 429,
                    'device.id'                      => crc32($vehicle['ident']),
                    'device.name'                    => $vehicle['name'],
                    'device.type.id'                 => 744,
                    'engine.ignition.status'         => $ignition,
                    'event.priority.enum'            => 0,
                    'external.powersource.voltage'   => round(12 + (rand(0, 200) / 100), 2),
                    'gnss.state.enum'                => 1,
                    'gnss.status'                    => true,
                    'gsm.cellid'                     => rand(10000, 20000),
                    'gsm.lac'                        => rand(100, 200),
                    'gsm.mcc'                        => 257,
                    'gsm.mnc'                        => 1,
                    'gsm.operator.code'              => '25701',
                    'gsm.signal.level'               => rand(50, 100),
                    'ident'                          => $vehicle['ident'],
                    'movement.status'                => $vehicle['speed'] > 5,
                    'peer'                           => '192.168.1.' . rand(1, 254) . ':' . rand(30000, 60000),
                    'position.altitude'              => rand(100, 500),
                    'position.direction'             => round($vehicle['heading'], 1),
                    'position.hdop'                  => round(rand(1, 30) / 10, 1),
                    'position.latitude'              => round($vehicle['lat'], 7),
                    'position.longitude'             => round($vehicle['lng'], 7),
                    'position.satellites'            => rand(8, 20),
                    'position.speed'                 => $vehicle['speed'],
                    'position.valid'                 => true,
                    'protocol.id'                    => 14,
                    'server.timestamp'               => microtime(true),
                    'timestamp'                      => time(),
                    'vehicle.mileage'                => round($vehicle['mileage'], 3),
                ];
            }
            unset($vehicle);

            try {
                $response = Http::timeout(5)
                    ->acceptJson()
                    ->post($url, $batch);

                $status = $response->status();
                $body = $response->json();

                $this->line(
                    sprintf(
                        "[Tick %04d] Sent %d records → HTTP %d | %s",
                        $tick,
                        count($batch),
                        $status,
                        json_encode($body),
                    )
                );
            } catch (\Throwable $e) {
                $this->error("[Tick {$tick}] Request failed: {$e->getMessage()}");
            }

            sleep($interval);
        }

        return self::SUCCESS;
    }
}
