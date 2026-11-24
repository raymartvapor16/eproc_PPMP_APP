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
        $isMysql = in_array($driver, ['mysql', 'mariadb'], true);

        if ($isMysql) {
            $fks = [
                ['supplier_users', 'supplier_users_office_id_foreign'],
            ];

            foreach ($fks as [$tbl, $fk]) {
                if (Schema::hasTable($tbl)) {
                    try {
                        DB::statement("ALTER TABLE `{$tbl}` DROP FOREIGN KEY `{$fk}`");
                    } catch (\Throwable $e) {

                    }
                }
            }
        }

        Schema::dropIfExists('supplier_users');
        Schema::dropIfExists('supplier_offices');
    }

    public function down(): void
    {

    }
};
