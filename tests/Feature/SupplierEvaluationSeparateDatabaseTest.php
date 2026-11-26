<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\SupplierActivityLog;
use App\Models\SupplierEvaluation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SupplierEvaluationSeparateDatabaseTest extends TestCase
{
    use RefreshDatabase;

    private string $tempSqlitePath = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->tempSqlitePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'supplier_eval_test_' . uniqid() . '.sqlite';
        touch($this->tempSqlitePath);

        Config::set('database.connections.supplier_eval', [
            'driver' => 'sqlite',
            'database' => $this->tempSqlitePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        DB::purge('supplier_eval');
    }

    protected function tearDown(): void
    {
        DB::disconnect('supplier_eval');
        Config::set('database.connections.supplier_eval.database', null);
        if ($this->tempSqlitePath && file_exists($this->tempSqlitePath)) {
            @unlink($this->tempSqlitePath);
        }
        parent::tearDown();
    }

    public function test_supplier_evaluation_runs_on_separate_database_and_cross_db_filters_work(): void
    {
        $office = Office::create([
            'name' => 'Provincial General Services Office',
            'code' => 'PGSO',
            'head_name' => 'Juan Dela Cruz',
            'designation' => 'PGDH',
            'responsibility_number' => '1061',
        ]);

        $admin = User::factory()->create([
            'name' => 'Super Admin',
            'email' => 'sa.suppliereval@example.test',
            'role' => 'super_admin',
            'roles' => ['super_admin'],
            'office_id' => $office->id,
            'accessible_systems' => ['/eprocrementppmpapp', '/supplierevaluation'],
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // Seed one legacy row on the main DB to verify data copy works
        DB::table('supplier_evaluations')->insert([
            'id' => 101,
            'supplier_name' => 'Legacy Copied Supplier',
            'po_no' => 'PO-2026-LEGACY',
            'date_evaluation' => '2026-11-26',
            'office_id' => $office->id,
            'covered_period' => 'CY 2026',
            'period_year' => 2026,
            'status' => 'pending',
            'delete_status' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Run our migration + copy command
        $exitCode = Artisan::call('supplier-eval:migrate-db');
        $this->assertSame(0, $exitCode);

        // Verify legacy row was copied to supplier_eval DB
        $this->assertSame(
            1,
            DB::connection('supplier_eval')->table('supplier_evaluations')->where('po_no', 'PO-2026-LEGACY')->count()
        );

        // Create a NEW evaluation via API -> must land ONLY in supplier_eval DB, NOT main DB
        $this->actingAs($admin)
            ->postJson('/api/supplier-evaluation/evaluations', [
                'supplier_name' => 'Acme Medical Supplies',
                'po_no' => 'PO-2026-NEWDB',
                'date_evaluation' => '2026-11-26',
                'office_id' => $office->id,
                'covered_period' => 'CY 2026',
            ])
            ->assertStatus(201);

        $this->assertSame(
            1,
            DB::connection('supplier_eval')->table('supplier_evaluations')->where('po_no', 'PO-2026-NEWDB')->count()
        );
        $this->assertSame(
            0,
            DB::table('supplier_evaluations')->where('po_no', 'PO-2026-NEWDB')->count()
        );

        // Cross-DB filter by department (offices table on main DB) + search works cleanly
        $listRes = $this->actingAs($admin)
            ->getJson('/api/supplier-evaluation/evaluations?status=pending&department=PGSO&search=PGSO')
            ->assertOk();

        $poNos = collect($listRes->json('data'))->pluck('po_no')->all();
        $this->assertContains('PO-2026-NEWDB', $poNos);
        $this->assertContains('PO-2026-LEGACY', $poNos);

        // Cross-DB activity log search by user name (users table on main DB) works cleanly
        SupplierActivityLog::create([
            'user_id' => $admin->id,
            'activity' => 'Created Evaluation',
            'description' => 'Created PO-2026-NEWDB',
            'role' => 'administrator',
            'status' => 'success',
        ]);

        $logRes = $this->actingAs($admin)
            ->getJson('/api/supplier-evaluation/activity-logs?search=Super+Admin')
            ->assertOk();

        $this->assertGreaterThanOrEqual(1, count($logRes->json('data') ?? []));
    }
}
