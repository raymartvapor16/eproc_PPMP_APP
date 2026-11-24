<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        if (Schema::hasTable('pnpki_signatures')) {
            Schema::table('pnpki_signatures', function (Blueprint $table) {
                if (!Schema::hasColumn('pnpki_signatures', 'previous_expiration_date')) {
                    $table->date('previous_expiration_date')->nullable()->after('expiration_date');
                }
                if (!Schema::hasColumn('pnpki_signatures', 'previous_proof_pdf_path')) {
                    $table->string('previous_proof_pdf_path')->nullable()->after('proof_original_name');
                }
                if (!Schema::hasColumn('pnpki_signatures', 'previous_proof_original_name')) {
                    $table->string('previous_proof_original_name')->nullable()->after('previous_proof_pdf_path');
                }
                if (!Schema::hasColumn('pnpki_signatures', 'renewal_history')) {
                    $table->json('renewal_history')->nullable()->after('capture_method');
                }
                if (!Schema::hasColumn('pnpki_signatures', 'renewed_at')) {
                    $table->timestamp('renewed_at')->nullable()->after('renewal_history');
                }
                if (!Schema::hasColumn('pnpki_signatures', 'renewal_count')) {
                    $table->unsignedInteger('renewal_count')->default(0)->after('renewed_at');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('pnpki_signatures')) {
            Schema::table('pnpki_signatures', function (Blueprint $table) {
                $table->dropColumn([
                    'previous_expiration_date',
                    'previous_proof_pdf_path',
                    'previous_proof_original_name',
                    'renewal_history',
                    'renewed_at',
                    'renewal_count',
                ]);
            });
        }
    }
};
