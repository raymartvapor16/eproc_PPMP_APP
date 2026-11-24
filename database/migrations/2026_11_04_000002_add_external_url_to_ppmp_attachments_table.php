<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmp_attachments', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp_attachments', 'external_url')) {
                $table->text('external_url')->nullable()->after('storage_path');
            }
            if (!Schema::hasColumn('ppmp_attachments', 'link_description')) {
                $table->text('link_description')->nullable()->after('external_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ppmp_attachments', function (Blueprint $table) {
            if (Schema::hasColumn('ppmp_attachments', 'link_description')) {
                $table->dropColumn('link_description');
            }
            if (Schema::hasColumn('ppmp_attachments', 'external_url')) {
                $table->dropColumn('external_url');
            }
        });
    }
};
