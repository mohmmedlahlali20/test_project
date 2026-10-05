<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GpsPosition extends Model
{
    protected $fillable = [
        'device_id',
        'latitude',
        'longitude',
        'speed',
        'direction',
        'altitude',
        'engine_ignition',
        'movement_status',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude'        => 'float',
            'longitude'       => 'float',
            'speed'           => 'float',
            'direction'       => 'float',
            'altitude'        => 'float',
            'engine_ignition' => 'boolean',
            'movement_status' => 'boolean',
            'recorded_at'     => 'datetime',
        ];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }
}
