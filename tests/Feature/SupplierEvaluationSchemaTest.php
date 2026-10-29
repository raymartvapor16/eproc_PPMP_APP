<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\SupplierActivityLog;
use App\Models\SupplierAuthorize;
use App\Models\SupplierCriteriaScore;
use App\Models\SupplierDigitalApproval;
use App\Models\SupplierEvaluation;
use App\Models\SupplierEvaluationCriteria;
use App\Models\SupplierEvaluationLink;
use App\Models\SupplierPdf;
use App\Models\SupplierPurchaseOrder;
use App\Models\SupplierRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SupplierEvaluationSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_ten_supplier_evaluation_tables_and_columns_exist_with_seeded_criteria(): void
    {
        $expectedTables = [
            'supplier_evaluation_criteria' => ['id', 'criteria_name', 'created_at', 'updated_at'],
            'supplier_evaluations'         => ['id', 'supplier_name', 'po_no', 'date_evaluation', 'office_id', 'covered_period', 'period_year', 'status', 'delete_status', 'created_at', 'updated_at'],
            'supplier_criteria_scores'     => ['id', 'evaluation_id', 'criteria_id', 'number_rating', 'remarks', 'created_at', 'updated_at'],
            'supplier_purchase_orders'     => ['id', 'po_no', 'pr_no', 'item', 'pdf_po', 'end_user', 'supplier', 'status', 'created_at', 'updated_at'],
            'supplier_pdfs'                => ['id', 'user_id', 'pdf_file', 'status', 'created_at', 'updated_at'],
            'supplier_authorizes'          => ['id', 'evaluation_id', 'pdf_id', 'user_id', 'office_id', 'created_at', 'updated_at'],
            'supplier_digital_approvals'   => ['id', 'evaluation_id', 'signed_by', 'authorize_id', 'full_name', 'designation', 'role', 'image', 'created_at', 'updated_at'],
            'supplier_evaluation_links'    => ['id', 'evaluation_id', 'token', 'code', 'is_used', 'expires_at', 'created_at', 'updated_at'],
            'supplier_requests'            => ['id', 'evaluation_id', 'user_id', 'requested_to', 'request_type', 'reason', 'status', 'request_date', 'status_date', 'created_at', 'updated_at'],
            'supplier_activity_logs'       => ['id', 'user_id', 'activity', 'description', 'role', 'status', 'ip_address', 'user_agent', 'created_at', 'updated_at'],
        ];

        foreach ($expectedTables as $table => $columns) {
            $this->assertTrue(Schema::hasTable($table), "Table {$table} should exist.");
            foreach ($columns as $col) {
                $this->assertTrue(
                    Schema::hasColumn($table, $col),
                    "Table {$table} should have column {$col}."
                );
            }
        }

        // Verify the 4 default criteria from the SQL dump are seeded
        $criteria = SupplierEvaluationCriteria::orderBy('id')->pluck('criteria_name', 'id')->toArray();
        $this->assertSame([
            1 => 'PRICE',
            2 => 'QUALITY/SERVICE LEVEL',
            3 => 'CUSTOMER CARE/AFTER SALES SERVICE',
            4 => 'DELIVERY FULFILLMENT',
        ], $criteria);
    }

    public function test_supplier_evaluation_models_and_relationships_work_end_to_end(): void
    {
        $office = Office::create([
            'name' => 'Provincial General Services Office',
            'code' => 'PGSO',
            'head_name' => 'Test Head',
            'designation' => 'PGDH - PGSO',
            'responsibility_number' => '1061',
        ]);

        $endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $office->id,
            'designation' => 'Administrative Aide IV',
        ]);

        $pgsoUser = User::factory()->create([
            'role' => 'pgso',
            'office_id' => $office->id,
            'designation' => 'PGSO Reviewer',
        ]);

        $po = SupplierPurchaseOrder::create([
            'po_no' => 'PO-2026-0001',
            'pr_no' => 'PR-2026-0001',
            'item' => 'CY 2026',
            'end_user' => 'PGSO',
            'supplier' => 'ABC Office Supplies Inc.',
            'status' => 'Added',
        ]);

        $evaluation = SupplierEvaluation::create([
            'supplier_name' => $po->supplier,
            'po_no' => $po->po_no,
            'date_evaluation' => '2026-10-28',
            'office_id' => $office->id,
            'covered_period' => 'CY 2026',
            'period_year' => 2026,
            'status' => 'head review',
            'delete_status' => 0,
        ]);

        foreach ([1 => 4, 2 => 4, 3 => 3, 4 => 4] as $criteriaId => $rating) {
            SupplierCriteriaScore::create([
                'evaluation_id' => $evaluation->id,
                'criteria_id' => $criteriaId,
                'number_rating' => $rating,
                'remarks' => 'Good performance',
            ]);
        }

        $pdf = SupplierPdf::create([
            'user_id' => $endUser->id,
            'pdf_file' => 'pdf_files/auth_letter.pdf',
            'status' => 'approved',
        ]);

        $authorize = SupplierAuthorize::create([
            'evaluation_id' => $evaluation->id,
            'pdf_id' => $pdf->id,
            'user_id' => $endUser->id,
            'office_id' => $office->id,
        ]);

        $approval = SupplierDigitalApproval::create([
            'evaluation_id' => $evaluation->id,
            'signed_by' => $endUser->id,
            'authorize_id' => $authorize->id,
            'full_name' => $endUser->name,
            'designation' => $endUser->designation,
            'role' => 'Prepared by',
        ]);

        $link = SupplierEvaluationLink::create([
            'evaluation_id' => $evaluation->id,
            'code' => 'ABC123',
            'is_used' => false,
        ]);

        $request = SupplierRequest::create([
            'evaluation_id' => $evaluation->id,
            'user_id' => $endUser->id,
            'requested_to' => $pgsoUser->id,
            'request_type' => 'update',
            'reason' => 'Need to update delivery remarks',
            'status' => 'request',
            'request_date' => now(),
        ]);

        $log = SupplierActivityLog::create([
            'user_id' => $endUser->id,
            'activity' => 'Create Evaluation',
            'description' => 'Created supplier evaluation for PO-2026-0001',
            'role' => $endUser->role,
            'status' => 'success',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
        ]);

        $this->assertCount(4, $evaluation->criteriaScores);
        $this->assertSame('PRICE', $evaluation->criteriaScores->first()->criteria->criteria_name);
        $this->assertSame($po->id, $evaluation->purchaseOrder->id);
        $this->assertSame($evaluation->id, $po->evaluation->id);
        $this->assertCount(1, $evaluation->digitalApprovals);
        $this->assertSame($authorize->id, $approval->authorize->id);
        $this->assertSame('approved', $authorize->status);
        $this->assertNotEmpty($link->token);
        $this->assertSame($link->id, $evaluation->evaluationLink->id);
        $this->assertSame($request->id, $evaluation->latestRequest->id);
        $this->assertSame($pgsoUser->id, $request->receiver->id);
        $this->assertSame($endUser->id, $log->user->id);
    }

    public function test_role_based_supplier_evaluation_dashboard_and_three_stage_workflow_api(): void
    {
        $office = Office::create([
            'name' => 'Provincial Treasurer Office',
            'code' => 'PTO',
            'head_name' => 'Provincial Treasurer',
            'designation' => 'PGDH - PTO',
            'responsibility_number' => '1091',
        ]);

        $admin = User::factory()->create([
            'role' => 'admin',
            'office_id' => $office->id,
            'designation' => 'System Administrator',
            'signature_path' => 'signatures/admin.png',
        ]);

        $endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $office->id,
            'designation' => 'Administrative Officer',
            'signature_path' => 'signatures/end_user.png',
            'accessible_systems' => ['/eprocrementppmpapp', '/supplierevaluation'],
        ]);

        $headUser = User::factory()->create([
            'role' => 'head',
            'office_id' => $office->id,
            'designation' => 'Department Head',
            'signature_path' => 'signatures/head.png',
            'accessible_systems' => ['/eprocrementppmpapp', '/supplierevaluation'],
        ]);

        $pgsoUser = User::factory()->create([
            'role' => 'pgso',
            'office_id' => $office->id,
            'designation' => 'PGSO Officer',
            'signature_path' => 'signatures/pgso.png',
            'accessible_systems' => ['/supplierevaluation'],
        ]);

        // 1. Admin creates a Purchase Order
        $poRes = $this->actingAs($admin)->postJson('/api/supplier-evaluation/purchase-orders', [
            'po_no' => '0555-AM-26',
            'pr_no' => 'PR-0555',
            'item' => 'CY 2026',
            'end_user' => 'PTO',
            'supplier' => 'DAVAO TECH SUPPLIERS',
        ]);
        $poRes->assertSuccessful();

        // 2. End user creates a Supplier Evaluation from that PO
        $storeEvalRes = $this->actingAs($endUser)->postJson('/api/supplier-evaluation/evaluations', [
            'supplier_name' => 'DAVAO TECH SUPPLIERS',
            'po_no' => '0555-AM-26',
            'date_evaluation' => '2026-10-28',
            'covered_period' => 'CY 2026',
            'office_id' => $office->id,
        ]);
        $storeEvalRes->assertSuccessful();
        $evalId = $storeEvalRes->json('evaluation.id');
        $this->assertNotNull($evalId);

        // 3. Stage 1: End user evaluates (4 criteria) -> status becomes 'head review'
        $stage1Res = $this->actingAs($endUser)->postJson("/api/supplier-evaluation/evaluations/{$evalId}/evaluate", [
            'rating' => [
                1 => 4,
                2 => 4,
                3 => 3,
                4 => 4,
            ],
            'remarks' => [
                1 => 'Competitive pricing',
                2 => 'High quality',
                3 => 'Responsive support',
                4 => 'Delivered on schedule',
            ],
            'approve' => true,
        ]);
        $stage1Res->assertStatus(200);
        $this->assertSame('head review', $stage1Res->json('evaluation.status'));

        // 4. Stage 2: Office Head reviews & approves -> status becomes 'submitted'
        $stage2Res = $this->actingAs($headUser)->postJson("/api/supplier-evaluation/evaluations/{$evalId}/evaluate", [
            'approve' => true,
        ]);
        $stage2Res->assertStatus(200);
        $this->assertSame('submitted', $stage2Res->json('evaluation.status'));

        // Verify both digital approvals ('Prepared by' and 'Head') are recorded
        $detailRes = $this->actingAs($pgsoUser)->getJson("/api/supplier-evaluation/evaluations/{$evalId}");
        $detailRes->assertStatus(200);
        $this->assertCount(2, $detailRes->json('evaluation.digital_approvals'));
        $this->assertSame(93.75, (float) $detailRes->json('evaluation.total_score'));
        $this->assertSame('Passed', $detailRes->json('evaluation.rating_status'));

        // 6. Check Dashboard Init & Analytics endpoints
        $initRes = $this->actingAs($pgsoUser)->getJson('/api/supplier-evaluation/dashboard-init');
        $initRes->assertStatus(200)
            ->assertJsonPath('effective_role', 'pgso');

        $analyticsRes = $this->actingAs($pgsoUser)->getJson('/api/supplier-evaluation/analytics');
        $analyticsRes->assertStatus(200)
            ->assertJsonStructure([
                'summary',
                'semester_data',
                'monthly_counts',
                'supplier_scores',
                'missing_pdf_pos',
            ]);
    }
}

