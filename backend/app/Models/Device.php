<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    protected $fillable = [
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
    ];

    protected function casts(): array
    {
        return [
            'last_latitude'  => 'float',
            'last_longitude' => 'float',
            'last_speed'     => 'float',
            'last_direction' => 'float',
            'engine_ignition' => 'boolean',
            'movement_status' => 'boolean',
            'mileage'        => 'float',
            'last_seen_at'   => 'datetime',
        ];
    }

    public function positions(): HasMany
    {
        return $this->hasMany(GpsPosition::class);
    }
}
