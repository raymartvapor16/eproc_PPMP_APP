<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MigrateSupplierEvalDatabase extends Command
{
    protected $signature = 'supplier-eval:migrate-db {--schema-only : Create tables on supplier_eval without copying data from the main DB}';

    protected $description = 'Create Supplier Evaluation tables on the dedicated supplier_eval database and safely copy existing records from the main database';

    public const TABLES_IN_ORDER = [
        'supplier_evaluation_criteria',
        'supplier_evaluations',
        'supplier_criteria_scores',
        'supplier_purchase_orders',
        'supplier_pdfs',
        'supplier_authorizes',
        'supplier_digital_approvals',
        'supplier_evaluation_links',
        'supplier_requests',
        'supplier_activity_logs',
    ];

    public function handle(): int
    {
        $targetDb = config('database.connections.supplier_eval.database');
        if (!is_string($targetDb) || trim($targetDb) === '') {
            $this->error('SUPPLIER_DB_DATABASE is not configured in .env. Set SUPPLIER_DB_DATABASE first.');
            return self::FAILURE;
        }

        $targetConn = 'supplier_eval';
        $sourceConn = (string) config('database.default');

        $this->info("Preparing dedicated Supplier Evaluation database ({$targetDb})...");

        $schema = Schema::connection($targetConn);

        if (!$schema->hasTable('supplier_evaluation_criteria')) {
            $schema->create('supplier_evaluation_criteria', function (Blueprint $table) {
                $table->id();
                $table->string('criteria_name');
                $table->timestamps();
            });
        }

        if (!$schema->hasTable('supplier_evaluations')) {
            $schema->create('supplier_evaluations', function (Blueprint $table) {
                $table->id();
                $table->string('supplier_name')->index();
                $table->string('po_no')->index();
                $table->date('date_evaluation')->index();
                $table->unsignedBigInteger('office_id')->index();
                $table->string('covered_period');
                $table->year('period_year')->index();
                $table->string('status')->default('pending')->index();
                $table->integer('delete_status')->nullable()->index();
                $table->timestamps();

                $table->index(['office_id', 'status', 'delete_status'], 'idx_supplier_evals_office_status_del');
                $table->index(['status', 'delete_status', 'period_year'], 'idx_supplier_evals_status_del_year');
            });
        }

        if (!$schema->hasTable('supplier_criteria_scores')) {
            $schema->create('supplier_criteria_scores', function (Blueprint $table) {
                $table->id();
                $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
                $table->foreignId('criteria_id')->constrained('supplier_evaluation_criteria')->cascadeOnDelete();
                $table->integer('number_rating')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamps();

                $table->index(['evaluation_id', 'criteria_id'], 'idx_supplier_scores_eval_criteria');
            });
        }

        if (!$schema->hasTable('supplier_purchase_orders')) {
            $schema->create('supplier_purchase_orders', function (Blueprint $table) {
                $table->id();
                $table->string('po_no')->nullable()->index();
                $table->string('pr_no')->nullable()->index();
                $table->string('item')->nullable();
                $table->string('pdf_po')->nullable();
                $table->string('end_user')->index();
                $table->string('supplier')->index();
                $table->string('status')->nullable()->default('Pending')->index();
                $table->timestamps();

                $table->index(['end_user', 'status'], 'idx_supplier_po_enduser_status');
            });
        }

        if (!$schema->hasTable('supplier_pdfs')) {
            $schema->create('supplier_pdfs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('pdf_file')->nullable();
                $table->string('status')->default('pending')->index();
                $table->timestamps();

                $table->index(['user_id', 'status'], 'idx_supplier_pdfs_user_status');
            });
        }

        if (!$schema->hasTable('supplier_authorizes')) {
            $schema->create('supplier_authorizes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('evaluation_id')->nullable()->constrained('supplier_evaluations')->cascadeOnDelete();
                $table->foreignId('pdf_id')->constrained('supplier_pdfs')->cascadeOnDelete();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->unsignedBigInteger('office_id')->nullable()->index();
                $table->timestamps();
            });
        }

        if (!$schema->hasTable('supplier_digital_approvals')) {
            $schema->create('supplier_digital_approvals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
                $table->unsignedBigInteger('signed_by')->nullable()->index();
                $table->foreignId('authorize_id')->nullable()->constrained('supplier_authorizes')->cascadeOnDelete();
                $table->string('full_name')->nullable();
                $table->string('designation')->nullable();
                $table->string('role')->nullable()->index();
                $table->text('image')->nullable();
                $table->timestamps();

                $table->index(['evaluation_id', 'role'], 'idx_supplier_approvals_eval_role');
            });
        }

        if (!$schema->hasTable('supplier_evaluation_links')) {
            $schema->create('supplier_evaluation_links', function (Blueprint $table) {
                $table->id();
                $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
                $table->string('token')->unique();
                $table->string('code')->unique();
                $table->boolean('is_used')->default(false)->index();
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
            });
        }

        if (!$schema->hasTable('supplier_requests')) {
            $schema->create('supplier_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
                $table->unsignedBigInteger('user_id')->index();
                $table->unsignedBigInteger('requested_to')->nullable()->index();
                $table->string('request_type');
                $table->text('reason');
                $table->string('status')->index();
                $table->timestamp('request_date')->nullable();
                $table->timestamp('status_date')->nullable();
                $table->timestamps();

                $table->index(['evaluation_id', 'status'], 'idx_supplier_requests_eval_status');
                $table->index(['requested_to', 'status'], 'idx_supplier_requests_reqto_status');
            });
        }

        if (!$schema->hasTable('supplier_activity_logs')) {
            $schema->create('supplier_activity_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('activity');
                $table->text('description')->nullable();
                $table->string('role')->index();
                $table->enum('status', ['success', 'failed', 'warning'])->default('success')->index();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent')->nullable();
                $table->timestamps();

                $table->index('created_at', 'idx_supplier_logs_created_at');
            });
        }

        if (DB::connection($targetConn)->table('supplier_evaluation_criteria')->count() === 0) {
            DB::connection($targetConn)->table('supplier_evaluation_criteria')->insert([
                ['id' => 1, 'criteria_name' => 'PRICE', 'created_at' => null, 'updated_at' => null],
                ['id' => 2, 'criteria_name' => 'QUALITY/SERVICE LEVEL', 'created_at' => null, 'updated_at' => null],
                ['id' => 3, 'criteria_name' => 'CUSTOMER CARE/AFTER SALES SERVICE', 'created_at' => null, 'updated_at' => null],
                ['id' => 4, 'criteria_name' => 'DELIVERY FULFILLMENT', 'created_at' => null, 'updated_at' => null],
            ]);
        }

        $this->info('All 10 Supplier Evaluation tables are ready on supplier_eval.');

        if ($this->option('schema-only')) {
            return self::SUCCESS;
        }

        $sourceSchema = Schema::connection($sourceConn);
        foreach (self::TABLES_IN_ORDER as $table) {
            if (!$sourceSchema->hasTable($table)) {
                continue;
            }

            $rows = DB::connection($sourceConn)->table($table)->orderBy('id')->get();
            if ($rows->isEmpty()) {
                $this->line("  - {$table}: 0 rows in main DB");
                continue;
            }

            $inserted = 0;
            foreach ($rows->chunk(200) as $chunk) {
                $payload = $chunk->map(fn ($row) => (array) $row)->all();
                $inserted += DB::connection($targetConn)->table($table)->insertOrIgnore($payload);
            }

            $this->info("  - {$table}: copied {$inserted} / {$rows->count()} rows into supplier_eval");
        }

        $this->info('Supplier Evaluation database migration & data sync completed successfully!');
        return self::SUCCESS;
    }
}
