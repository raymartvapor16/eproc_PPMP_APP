<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            // Modify role ENUM to include 'monitor' alongside existing roles
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'authorized_staff', 'pacco', 'monitor') DEFAULT 'end_user'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert any 'monitor' users back to 'end_user' before dropping enum value
        DB::table('users')->where('role', 'monitor')->update(['role' => 'end_user']);

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'authorized_staff', 'pacco') DEFAULT 'end_user'");
        }
    }
};
