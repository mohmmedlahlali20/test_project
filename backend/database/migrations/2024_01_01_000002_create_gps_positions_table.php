<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gps_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->float('speed')->default(0);
            $table->float('direction')->default(0);
            $table->float('altitude')->default(0);
            $table->boolean('engine_ignition')->default(false);
            $table->boolean('movement_status')->default(false);
            $table->timestamp('recorded_at');
            $table->timestamps();

            // Compound index for time-range queries per device (trajectory drawing)
            $table->index(['device_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gps_positions');
    }
};
