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
        $isMysql = in_array($driver, ['mysql', 'mariadb'], true);

        // Ensure no foreign keys remain on supplier_users or supplier_offices before dropping
        if ($isMysql) {
            $fks = [
                ['supplier_users', 'supplier_users_office_id_foreign'],
            ];

            foreach ($fks as [$tbl, $fk]) {
                if (Schema::hasTable($tbl)) {
                    try {
                        DB::statement("ALTER TABLE `{$tbl}` DROP FOREIGN KEY `{$fk}`");
                    } catch (\Throwable $e) {
                        // Ignored if foreign key doesn't exist
                    }
                }
            }
        }

        // Drop the obsolete tables as all data has been unified into users and offices
        Schema::dropIfExists('supplier_users');
        Schema::dropIfExists('supplier_offices');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Tables are obsolete and merged into users and offices
    }
};

