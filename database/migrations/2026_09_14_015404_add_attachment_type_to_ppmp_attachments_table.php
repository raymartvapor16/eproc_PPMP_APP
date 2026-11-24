<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmp_attachments', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp_attachments', 'attachment_type')) {
                $table->string('attachment_type')->nullable()->default('SUPPORTING_DOC')->after('mime_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ppmp_attachments', function (Blueprint $table) {
            if (Schema::hasColumn('ppmp_attachments', 'attachment_type')) {
                $table->dropColumn('attachment_type');
            }
        });
    }
};
