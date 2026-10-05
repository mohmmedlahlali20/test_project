<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VehiclePositionUpdated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    /**
     * @param  array<int, array>  $positions  Array of device position payloads
     */
    public function __construct(
        public readonly array $positions,
    ) {}

    /**
     * Broadcast on a public channel for fleet-wide map dashboards.
     */
    public function broadcastOn(): Channel
    {
        return new Channel('fleet-tracker');
    }

    /**
     * Custom event name for frontend listeners.
     */
    public function broadcastAs(): string
    {
        return 'position.updated';
    }

    /**
     * Shape the broadcast payload.
     */
    public function broadcastWith(): array
    {
        return [
            'positions' => $this->positions,
        ];
    }
}
