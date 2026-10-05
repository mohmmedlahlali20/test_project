<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

App\Models\Device::where('ident', '111110000000001')->update([
    'last_latitude' => 33.5892,
    'last_longitude' => -7.6185,
    'last_speed' => 52,
    'last_direction' => 90,
]);
App\Models\Device::where('ident', '111110000000002')->update([
    'last_latitude' => 33.5950,
    'last_longitude' => -7.6050,
    'last_speed' => 45,
    'last_direction' => 45,
]);
App\Models\Device::where('ident', '111110000000003')->update([
    'last_latitude' => 33.5780,
    'last_longitude' => -7.6250,
    'last_speed' => 60,
    'last_direction' => 180,
]);

// Clear old Black Sea position trail so polyline stays on city roads
App\Models\GpsPosition::truncate();

echo "Database successfully updated to city land coordinates!" . PHP_EOL;
