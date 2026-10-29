<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('accessible_systems')->nullable()->after('approval_status');
        });

        // Initialize accessible_systems for existing users
        $users = DB::table('users')->get();
        foreach ($users as $user) {
            $systems = ['/eprocrementppmpapp'];
            if ($user->role === 'super_admin' || $user->role === 'admin') {
                $systems = ['/eprocrementppmpapp', '/monitoringsystem'];
            } elseif ($user->role === 'monitor') {
                $systems = ['/monitoringsystem'];
            }

            DB::table('users')->where('id', $user->id)->update([
                'accessible_systems' => json_encode($systems)
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('accessible_systems');
        });
    }
};
