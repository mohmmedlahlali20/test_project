import fs from 'fs';
import path from 'path';

const targetPath = path.resolve('../test_project/app/Console/Commands/FleetSimulateCommand.php');

const phpCode = `<?php

namespace App\\Console\\Commands;

use Illuminate\\Console\\Command;
use Illuminate\\Support\\Facades\\Http;

class FleetSimulateCommand extends Command
{
    protected $signature = 'fleet:simulate
        {--interval=2 : Seconds between each telemetry batch}
        {--vehicles=3 : Number of simulated vehicles}
        {--url= : Override the ingestion endpoint URL}';

    protected $description = 'Simulate road-snapped GPS telemetry following actual city avenues and road networks in Casablanca';

    /**
     * Real-world avenue waypoints in Casablanca (Boulevard Abdelmoumen, Zerktouni, Hassan II, Mohammed V, Corniche)
     */
    private array $vehicles = [
        [
            'ident'    => '111110000000001',
            'name'     => 'Truck Alpha',
            'mileage'  => 15234.5,
            'speed'    => 50,
            'heading'  => 0,
            'segment'  => 0,
            'progress' => 0.0,
            'forward'  => true,
            // Route 1: Bd Abdelmoumen -> Bd Zerktouni -> Bd d'Anfa
            'waypoints' => [
                ['lat' => 33.5650, 'lng' => -7.6180], // Bd Abdelmoumen South
                ['lat' => 33.5710, 'lng' => -7.6200], // Bd Abdelmoumen Metro
                ['lat' => 33.5780, 'lng' => -7.6250], // Jct Abdelmoumen & Zerktouni
                ['lat' => 33.5825, 'lng' => -7.6320], // Bd Zerktouni Maarif
                ['lat' => 33.5870, 'lng' => -7.6390], // Twin Center
                ['lat' => 33.5910, 'lng' => -7.6430], // Bd d'Anfa Crossing
                ['lat' => 33.5950, 'lng' => -7.6380], // Bd d'Anfa North
                ['lat' => 33.6000, 'lng' => -7.6280], // Towards Port Marina
            ],
        ],
        [
            'ident'    => '111110000000002',
            'name'     => 'Van Beta',
            'mileage'  => 48120.3,
            'speed'    => 45,
            'heading'  => 45,
            'segment'  => 0,
            'progress' => 0.0,
            'forward'  => true,
            // Route 2: Bd Hassan II -> Bd Mohammed V -> Avenue des FAR
            'waypoints' => [
                ['lat' => 33.5830, 'lng' => -7.6220], // Bd Hassan II South
                ['lat' => 33.5880, 'lng' => -7.6180], // Place Mohammed V
                ['lat' => 33.5925, 'lng' => -7.6130], // Place des Nations Unies
                ['lat' => 33.5950, 'lng' => -7.6080], // Bd Mohammed V Central Market
                ['lat' => 33.5975, 'lng' => -7.6010], // Bd Mohammed V East
                ['lat' => 33.5995, 'lng' => -7.5940], // Avenue des FAR
            ],
        ],
        [
            'ident'    => '111110000000003',
            'name'     => 'Car Gamma',
            'mileage'  => 91002.7,
            'speed'    => 58,
            'heading'  => 90,
            'segment'  => 0,
            'progress' => 0.0,
            'forward'  => true,
            // Route 3: Bd de la Corniche -> Hassan II Mosque -> Casablanca Marina -> Bd des Almohades
            'waypoints' => [
                ['lat' => 33.5990, 'lng' => -7.6620], // Ain Diab Corniche
                ['lat' => 33.6025, 'lng' => -7.6510], // Phare d'El Hank
                ['lat' => 33.6060, 'lng' => -7.6410], // Hassan II Mosque Coast
                ['lat' => 33.6080, 'lng' => -7.6310], // Casablanca Marina
                ['lat' => 33.6045, 'lng' => -7.6220], // Bd des Almohades
                ['lat' => 33.5980, 'lng' => -7.6150], // Port & Casa-Port Station
            ],
        ],
    ];

    /**
     * Calculate true compass bearing between two coordinates (0-360 degrees)
     */
    private function calculateBearing(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLng = deg2rad($lng2 - $lng1);
        $y = sin($dLng) * cos(deg2rad($lat2));
        $x = cos(deg2rad($lat1)) * sin(deg2rad($lat2)) - sin(deg2rad($lat1)) * cos(deg2rad($lat2)) * cos($dLng);
        $brng = rad2deg(atan2($y, $x));
        return fmod($brng + 360, 360);
    }

    public function handle(): int
    {
        $interval = max(1, (int) $this->option('interval'));
        $vehicleCount = min((int) $this->option('vehicles'), count($this->vehicles));
        $url = $this->option('url') ?: 'http://127.0.0.1:8000/api/gps/ingest';

        $activeVehicles = array_slice($this->vehicles, 0, $vehicleCount);

        $this->info("🚀 Real-Road Fleet Simulator Started");
        $this->info("   Vehicles: {$vehicleCount} (Road-bound along Casablanca Avenues)");
        $this->info("   Interval: {$interval}s");
        $this->info("   Endpoint: {$url}");
        $this->newLine();

        $tick = 0;

        while (true) {
            $tick++;
            $batch = [];

            foreach ($activeVehicles as &$vehicle) {
                $wps = $vehicle['waypoints'];
                $totalSegments = count($wps) - 1;

                // Determine start and end waypoints of current road segment
                $fromIdx = $vehicle['forward'] ? $vehicle['segment'] : $vehicle['segment'] + 1;
                $toIdx   = $vehicle['forward'] ? $vehicle['segment'] + 1 : $vehicle['segment'];

                $pFrom = $wps[$fromIdx];
                $pTo   = $wps[$toIdx];

                // Calculate distance between segment waypoints
                $dLat = $pTo['lat'] - $pFrom['lat'];
                $dLng = $pTo['lng'] - $pFrom['lng'];
                $approxDistKm = sqrt(($dLat * 111.32) ** 2 + ($dLng * 111.32 * cos(deg2rad($pFrom['lat']))) ** 2);
                $approxDistKm = max(0.05, $approxDistKm);

                // Target speed: natural city speed between 40 and 65 km/h
                $vehicle['speed'] = min(75, max(30, $vehicle['speed'] + rand(-4, 4)));

                // Distance traveled this tick
                $tickDistKm = ($vehicle['speed'] / 3600) * $interval;
                $vehicle['mileage'] += $tickDistKm;

                // Advance progress along this road segment
                $progressStep = $tickDistKm / $approxDistKm;
                $vehicle['progress'] += $progressStep;

                if ($vehicle['progress'] >= 1.0) {
                    $vehicle['progress'] = 0.0;
                    if ($vehicle['forward']) {
                        if ($vehicle['segment'] + 1 >= $totalSegments) {
                            $vehicle['forward'] = false; // Reverse direction along avenue
                        } else {
                            $vehicle['segment']++;
                        }
                    } else {
                        if ($vehicle['segment'] <= 0) {
                            $vehicle['forward'] = true; // Forward again
                        } else {
                            $vehicle['segment']--;
                        }
                    }
                }

                // Interpolated road position
                $curLat = $pFrom['lat'] + ($dLat * $vehicle['progress']);
                $curLng = $pFrom['lng'] + ($dLng * $vehicle['progress']);

                // Calculate exact forward street bearing
                $vehicle['heading'] = $this->calculateBearing($pFrom['lat'], $pFrom['lng'], $pTo['lat'], $pTo['lng']);

                $batch[] = [
                    'battery.voltage'               => round(13.6 + (rand(0, 300) / 1000), 2),
                    'channel.id'                     => 429,
                    'device.id'                      => crc32($vehicle['ident']),
                    'device.name'                    => $vehicle['name'],
                    'device.type.id'                 => 744,
                    'engine.ignition.status'         => true,
                    'event.priority.enum'            => 0,
                    'external.powersource.voltage'   => 14.1,
                    'gnss.state.enum'                => 1,
                    'gnss.status'                    => true,
                    'gsm.cellid'                     => 11511,
                    'gsm.lac'                        => 108,
                    'gsm.mcc'                        => 257,
                    'gsm.mnc'                        => 1,
                    'gsm.operator.code'              => '25701',
                    'gsm.signal.level'               => rand(75, 100),
                    'ident'                          => $vehicle['ident'],
                    'movement.status'                => true,
                    'peer'                           => '192.168.1.' . rand(1, 254) . ':' . rand(30000, 60000),
                    'position.altitude'              => 25,
                    'position.direction'             => round($vehicle['heading'], 1),
                    'position.hdop'                  => 0.8,
                    'position.latitude'              => round($curLat, 7),
                    'position.longitude'             => round($curLng, 7),
                    'position.satellites'            => 15,
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
                        "[Tick %04d] Sent %d road-snapped records → HTTP %d | %s",
                        $tick,
                        count($batch),
                        $status,
                        json_encode($body)
                    )
                );
            } catch (\\Throwable $e) {
                $this->error("[Tick {$tick}] Request failed: {$e->getMessage()}");
            }

            sleep($interval);
        }

        return self::SUCCESS;
    }
}
`;

fs.writeFileSync(targetPath, phpCode, 'utf8');
console.log('Successfully updated FleetSimulateCommand.php with road-bound waypoints along Casablanca avenues!');
