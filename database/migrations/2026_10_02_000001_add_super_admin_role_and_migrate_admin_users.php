<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {

            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'authorized_staff') DEFAULT 'end_user'");
        }

        DB::table('users')->where('role', 'admin')->update(['role' => 'super_admin']);
    }

    public function down(): void
    {

        DB::table('users')->where('role', 'super_admin')->update(['role' => 'admin']);

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'admin', 'authorized_staff') DEFAULT 'end_user'");
        }
    }
};
