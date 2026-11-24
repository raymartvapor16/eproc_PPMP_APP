<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('pnpki_signatures', function (Blueprint $table) {
            if (!Schema::hasColumn('pnpki_signatures', 'renewal_status')) {
                $table->string('renewal_status', 30)->default('none')->after('renewal_count');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'pending_expiration_date')) {
                $table->date('pending_expiration_date')->nullable()->after('renewal_status');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'pending_proof_pdf_path')) {
                $table->string('pending_proof_pdf_path')->nullable()->after('pending_expiration_date');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'pending_proof_original_name')) {
                $table->string('pending_proof_original_name')->nullable()->after('pending_proof_pdf_path');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'pending_signature_image_path')) {
                $table->string('pending_signature_image_path')->nullable()->after('pending_proof_original_name');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'renewal_submitted_at')) {
                $table->timestamp('renewal_submitted_at')->nullable()->after('pending_signature_image_path');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'renewal_reviewed_at')) {
                $table->timestamp('renewal_reviewed_at')->nullable()->after('renewal_submitted_at');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'renewal_reviewed_by')) {
                $table->unsignedBigInteger('renewal_reviewed_by')->nullable()->after('renewal_reviewed_at');
            }
            if (!Schema::hasColumn('pnpki_signatures', 'renewal_rejection_reason')) {
                $table->text('renewal_rejection_reason')->nullable()->after('renewal_reviewed_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pnpki_signatures', function (Blueprint $table) {
            $cols = [
                'renewal_status',
                'pending_expiration_date',
                'pending_proof_pdf_path',
                'pending_proof_original_name',
                'pending_signature_image_path',
                'renewal_submitted_at',
                'renewal_reviewed_at',
                'renewal_reviewed_by',
                'renewal_rejection_reason',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('pnpki_signatures', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
