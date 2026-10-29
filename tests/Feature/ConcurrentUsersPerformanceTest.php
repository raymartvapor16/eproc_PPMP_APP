<?php

namespace Tests\Feature;

use App\Models\FundSource;
use App\Models\MonitoringProject;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\PpmpItem;
use App\Models\PpmpSignatory;
use App\Models\SystemNotification;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConcurrentUsersPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected array $offices = [];
    protected array $endUsers = [];
    protected array $headUsers = [];
    protected array $authorizedStaff = [];
    protected array $budgetOfficers = [];
    protected User $paccoOfficer;
    protected User $oppmoOfficer;
    protected User $twgOfficer;
    protected User $monitorOfficer;
    protected User $adminUser;
    protected User $superAdminUser;

    /**
     * Provision a realistic 50-user multi-office environment:
     * - 10 Offices
     * - 30 End Users (3 per office)
     * - 10 Office Heads (1 per office)
     * - 2 Authorized Staff
     * - 2 Budget Officers
     * - 1 PACCO Officer
     * - 1 OPPMO Officer
     * - 1 BAC-TWG Officer
     * - 1 Monitoring Officer
     * - 1 Admin
     * - 1 Super Admin
     * Total = 50 concurrent users
     */
    protected function seedMultiUserEnvironment(): void
    {
        Storage::fake('local');

        FundSource::firstOrCreate(
            ['name' => 'General Fund'],
            ['code' => 'GF', 'workflow_route' => 'budget', 'is_active' => true]
        );
        FundSource::firstOrCreate(
            ['name' => 'Trust Fund'],
            ['code' => 'TF', 'workflow_route' => 'pacco', 'is_active' => true]
        );

        PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'budget_requirement'],
            ['name' => 'DESSAMIE BUAT-SANCHEZ, CPA, JD', 'position' => 'PGDH - PBO / BAC - Chairman', 'is_active' => true]
        );
        PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'pacco_requirement'],
            ['name' => 'MAY FERNANDO-UY, CPA', 'position' => 'Provincial Accountant', 'is_active' => true]
        );
        PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'bac_secretariat'],
            ['name' => 'NORJANNA M. CAMAGUIN, MPA', 'position' => 'PGDH - OPPMO', 'is_active' => true]
        );
        PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'approved_by'],
            ['name' => 'HON. YVONNE R. CAGAS', 'position' => 'Provincial Governor', 'is_active' => true]
        );

        $officeDefs = [
            ['code' => 'PGO', 'name' => 'Provincial Governor Office'],
            ['code' => 'PBO', 'name' => 'Provincial Budget Office'],
            ['code' => 'PACCO', 'name' => 'Provincial Accounting Office'],
            ['code' => 'OPPMO', 'name' => 'Provincial Procurement Management Office'],
            ['code' => 'PEO', 'name' => 'Provincial Engineering Office'],
            ['code' => 'PHO', 'name' => 'Provincial Health Office'],
            ['code' => 'PADO', 'name' => 'Provincial Administrator Office'],
            ['code' => 'PVO', 'name' => 'Provincial Veterinary Office'],
            ['code' => 'PAGRO', 'name' => 'Provincial Agriculture Office'],
            ['code' => 'PSWDO', 'name' => 'Provincial Social Welfare Office'],
        ];

        foreach ($officeDefs as $idx => $def) {
            $office = Office::create([
                'code' => $def['code'],
                'name' => $def['name'],
            ]);

            $head = User::create([
                'name' => "Head {$def['code']}",
                'email' => strtolower("head.{$def['code']}@davsur.gov.ph"),
                'password' => 'password123',
                'role' => 'head',
                'office_id' => $office->id,
                'designation' => "Department Head - {$def['code']}",
                'is_active' => true,
                'approval_status' => 'approved',
                'accessible_systems' => ['/eprocrementppmpapp'],
            ]);

            $office->update(['head_user_id' => $head->id]);
            $this->offices[$idx] = $office;
            $this->headUsers[$office->id] = $head;

            // Create 3 End Users per office (30 End Users total)
            for ($u = 1; $u <= 3; $u++) {
                $this->endUsers[] = User::create([
                    'name' => "EndUser {$def['code']} #{$u}",
                    'email' => strtolower("enduser{$u}.{$def['code']}@davsur.gov.ph"),
                    'password' => 'password123',
                    'role' => 'end_user',
                    'office_id' => $office->id,
                    'designation' => "Administrative Officer {$u}",
                    'is_active' => true,
                    'approval_status' => 'approved',
                    'accessible_systems' => ['/eprocrementppmpapp'],
                ]);
            }
        }

        // 2 Authorized Staff for first 2 offices
        for ($i = 0; $i < 2; $i++) {
            $this->authorizedStaff[] = User::create([
                'name' => "Authorized Staff #{$i}",
                'email' => "authstaff{$i}@davsur.gov.ph",
                'password' => 'password123',
                'role' => 'authorized_staff',
                'office_id' => $this->offices[$i]->id,
                'designation' => 'Authorized Representative',
                'is_active' => true,
                'approval_status' => 'approved',
                'accessible_systems' => ['/eprocrementppmpapp'],
            ]);
        }

        // 2 Budget Officers
        for ($i = 1; $i <= 2; $i++) {
            $this->budgetOfficers[] = User::create([
                'name' => "Budget Officer #{$i}",
                'email' => "budget{$i}@davsur.gov.ph",
                'password' => 'password123',
                'role' => 'budget_officer',
                'office_id' => $this->offices[1]->id,
                'designation' => 'Provincial Budget Reviewer',
                'is_active' => true,
                'approval_status' => 'approved',
                'accessible_systems' => ['/eprocrementppmpapp'],
            ]);
        }

        $this->paccoOfficer = User::create([
            'name' => 'PACCO Reviewer',
            'email' => 'pacco@davsur.gov.ph',
            'password' => 'password123',
            'role' => 'pacco',
            'office_id' => $this->offices[2]->id,
            'designation' => 'Provincial Accountant',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp'],
        ]);

        $this->oppmoOfficer = User::create([
            'name' => 'OPPMO Reviewer',
            'email' => 'oppmo@davsur.gov.ph',
            'password' => 'password123',
            'role' => 'oppmo',
            'office_id' => $this->offices[3]->id,
            'designation' => 'OPPMO Officer',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);

        $this->twgOfficer = User::create([
            'name' => 'TWG Evaluator',
            'email' => 'twg@davsur.gov.ph',
            'password' => 'password123',
            'role' => 'twg',
            'office_id' => $this->offices[3]->id,
            'designation' => 'BAC-TWG Member',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp'],
        ]);

        $this->monitorOfficer = User::create([
            'name' => 'OPPMO Monitor',
            'email' => 'monitor@davsur.gov.ph',
            'password' => 'password123',
            'role' => 'monitor',
            'office_id' => $this->offices[3]->id,
            'designation' => 'Procurement Monitor',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/monitoringsystem'],
        ]);

        $this->adminUser = User::create([
            'name' => 'System Admin',
            'email' => 'admin@davsur.gov.ph',
            'password' => 'password123',
            'role' => 'admin',
            'office_id' => $this->offices[0]->id,
            'designation' => 'System Administrator',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);

        $this->superAdminUser = User::create([
            'name' => 'Executive Super Admin',
            'email' => 'superadmin@davsur.gov.ph',
            'password' => 'password123',
            'role' => 'super_admin',
            'office_id' => $this->offices[0]->id,
            'designation' => 'Executive Director',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);
    }

    /**
     * Attach pre-submission requirements (Attachment List + Market Scoping PDF) to a PPMP
     */
    protected function fulfillPreSubmissionRequirements(User $user, Ppmp $ppmp): void
    {
        $items = $ppmp->items()->orderBy('item_no')->get();
        $attachmentLists = [];
        foreach ($items as $idx => $item) {
            $attachmentLists[(string) $idx] = [
                'rows' => [
                    [
                        'specific_items' => "Detailed spec for {$item->description}",
                        'Qty' => '10',
                        'Unit' => 'units',
                        'unit_price' => (string) ($item->estimated_budget / 10),
                        'cost' => (string) $item->estimated_budget,
                    ],
                ],
            ];
        }

        $this->actingAs($user)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
                'attachment_lists' => $attachmentLists,
                'is_generated' => true,
            ])
            ->assertOk();

        $file = UploadedFile::fake()->createWithContent(
            'market_scoping_checklist.pdf',
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"
        );
        $this->actingAs($user)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachments", [
                'file' => $file,
                'attachment_type' => 'MARKET_SCOPING',
            ])
            ->assertStatus(201);
    }

    public function test_30_end_users_and_20_staff_50_total_users_create_and_submit_ppmps_with_unique_trackers(): void
    {
        $this->seedMultiUserEnvironment();

        // Confirm 50 total active users provisioned across all roles
        $this->assertSame(50, User::count());
        $this->assertCount(30, $this->endUsers);

        $createdPpmps = [];
        $trackingNumbers = [];

        $startTime = hrtime(true);

        foreach ($this->endUsers as $index => $endUser) {
            $isTrustFund = ($index % 5 === 0); // Every 5th user uses Trust Fund (routes to PACCO)
            $projectType = match ($index % 3) {
                0 => 'Goods',
                1 => 'Infrastructure',
                default => 'Consulting Services',
            };
            $mode = ($index % 2 === 0) ? 'Competitive Bidding' : 'Small Value Procurement';
            $item1Budget = 150000 + ($index * 10000);
            $item2Budget = 85000 + ($index * 5000);

            $res = $this->actingAs($endUser)->postJson('/api/ppmps', [
                'title' => "FY 2026 Multi-User Procurement Package #{$index}",
                'fiscal_year' => '2026',
                'plan_type' => ($index % 2 === 0) ? 'FINAL' : 'INDICATIVE',
                'source_of_fund' => $isTrustFund ? 'Trust Fund' : 'General Fund',
                'account_code' => '5-02-03-010',
                'implementing_unit' => $endUser->office->name,
                'program_name' => "Operations Program #{$index}",
                'delivery_period' => '30 Calendar Days',
                'place_of_delivery' => 'PGSO Warehouse',
                'payment_method' => 'Check / ADA',
                'items' => [
                    [
                        'description' => "Primary Line Item A for Package #{$index}",
                        'project_type' => $projectType,
                        'quantity_size' => '10 units',
                        'procurement_mode' => $mode,
                        'start_date' => '03/2026',
                        'end_date' => '06/2026',
                        'source_of_fund' => $isTrustFund ? 'Trust Fund' : 'General Fund',
                        'estimated_budget' => $item1Budget,
                    ],
                    [
                        'description' => "Secondary Line Item B for Package #{$index}",
                        'project_type' => $projectType,
                        'quantity_size' => '5 lots',
                        'procurement_mode' => $mode,
                        'start_date' => '07/2026',
                        'end_date' => '10/2026',
                        'source_of_fund' => $isTrustFund ? 'Trust Fund' : 'General Fund',
                        'estimated_budget' => $item2Budget,
                    ],
                ],
            ]);

            $res->assertStatus(201);
            $ppmpData = $res->json('ppmp');
            $this->assertNotEmpty($ppmpData['tracking_number']);
            $this->assertEquals($item1Budget + $item2Budget, (float) $ppmpData['total_budget']);

            $trackingNumbers[] = $ppmpData['tracking_number'];
            $ppmp = Ppmp::where('uuid', $ppmpData['uuid'])->firstOrFail();

            // Verify pre-submission guard blocks submission before attachments are ready
            $this->actingAs($endUser)
                ->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review")
                ->assertStatus(422);

            // Fulfill Attachment List & Market Scoping PDF
            $this->fulfillPreSubmissionRequirements($endUser, $ppmp);

            // Submit to Review
            $submitRes = $this->actingAs($endUser)
                ->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review")
                ->assertOk();

            $expectedStatus = $isTrustFund ? 'PACCO_REVIEW' : 'BUDGET_OFFICER_REVIEW';
            $this->assertSame($expectedStatus, $submitRes->json('ppmp.status'));

            $createdPpmps[] = $ppmp->fresh();
        }

        $elapsedMs = (hrtime(true) - $startTime) / 1e6;

        // Assert all 30 tracking numbers are 100% unique with zero collisions
        $this->assertCount(30, $trackingNumbers);
        $this->assertCount(30, array_unique($trackingNumbers));

        // Average time per full user flow (Create + Blocked Check + Attachment List + PDF Upload + Submit) should be fast
        $avgPerUserMs = $elapsedMs / 30;
        $this->assertLessThan(500, $avgPerUserMs, "Average full workflow initiation per user took {$avgPerUserMs}ms");
    }

    public function test_multi_user_end_to_end_workflow_returns_edits_approvals_app_and_amendments_under_load(): void
    {
        $this->seedMultiUserEnvironment();

        // Have 15 End Users create and submit PPMPs concurrently
        $activePpmps = [];
        for ($i = 0; $i < 15; $i++) {
            $endUser = $this->endUsers[$i];
            $isTrust = ($i % 4 === 0);

            $res = $this->actingAs($endUser)->postJson('/api/ppmps', [
                'title' => "Workflow Load Project #{$i}",
                'fiscal_year' => '2026',
                'plan_type' => 'FINAL',
                'source_of_fund' => $isTrust ? 'Trust Fund' : 'General Fund',
                'implementing_unit' => $endUser->office->name,
                'items' => [
                    [
                        'description' => "Equipment Lot #{$i}",
                        'project_type' => 'Goods',
                        'quantity_size' => '10 sets',
                        'procurement_mode' => 'Competitive Bidding',
                        'start_date' => '02/2026',
                        'end_date' => '05/2026',
                        'source_of_fund' => $isTrust ? 'Trust Fund' : 'General Fund',
                        'estimated_budget' => 250000,
                    ],
                ],
            ])->assertStatus(201);

            $ppmp = Ppmp::where('uuid', $res->json('ppmp.uuid'))->firstOrFail();
            $this->fulfillPreSubmissionRequirements($endUser, $ppmp);
            $this->actingAs($endUser)->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review")->assertOk();
            $activePpmps[$i] = ['user' => $endUser, 'ppmp' => $ppmp->fresh(), 'is_trust' => $isTrust];
        }

        // Process all 15 PPMPs through Budget/PACCO -> Return subset -> Re-submit -> OPPMO -> TWG -> OPPMO APP -> Head -> READY_TO_PRINT
        foreach ($activePpmps as $i => $entry) {
            /** @var User $endUser */
            $endUser = $entry['user'];
            /** @var Ppmp $ppmp */
            $ppmp = $entry['ppmp'];
            $isTrust = $entry['is_trust'];

            $stage1Reviewer = $isTrust ? $this->paccoOfficer : $this->budgetOfficers[$i % 2];
            $stage1Prefix = $isTrust ? 'pacco' : 'budget';

            // Reviewer receives PPMP
            $this->actingAs($stage1Reviewer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                ->assertOk();

            // Every 3rd PPMP is returned to End-User for revision, then edited and re-submitted
            if ($i % 3 === 0) {
                $this->actingAs($stage1Reviewer)
                    ->postJson("/api/ppmps/{$ppmp->uuid}/{$stage1Prefix}/return", [
                        'remarks' => "Please adjust quantity and budget for Lot #{$i}.",
                    ])
                    ->assertOk();

                $ppmp->refresh();
                $this->assertStringEndsWith('_RETURNED', $ppmp->status);
                $this->assertNotNull($ppmp->toArray()['latest_return_remarks']);

                // End-user receives returned PPMP, updates item, updates attachment list, and re-submits
                $this->actingAs($endUser)
                    ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                    ->assertOk();

                $this->actingAs($endUser)
                    ->putJson("/api/ppmps/{$ppmp->uuid}", [
                        'title' => "Workflow Load Project #{$i} (Revised)",
                        'fiscal_year' => '2026',
                        'plan_type' => 'FINAL',
                        'source_of_fund' => $isTrust ? 'Trust Fund' : 'General Fund',
                        'items' => [
                            [
                                'description' => "Equipment Lot #{$i} (Revised Spec)",
                                'project_type' => 'Goods',
                                'quantity_size' => '10 sets',
                                'procurement_mode' => 'Competitive Bidding',
                                'start_date' => '02/2026',
                                'end_date' => '05/2026',
                                'source_of_fund' => $isTrust ? 'Trust Fund' : 'General Fund',
                                'estimated_budget' => 300000,
                            ],
                        ],
                    ])
                    ->assertOk();

                $this->fulfillPreSubmissionRequirements($endUser, $ppmp->fresh());

                $this->actingAs($endUser)
                    ->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review")
                    ->assertOk();

                $this->actingAs($stage1Reviewer)
                    ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                    ->assertOk();
            }

            // Stage 1 Reviewer Approves -> OPPMO_REVIEW
            $this->actingAs($stage1Reviewer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/{$stage1Prefix}/approve", [
                    'remarks' => 'Funds verified and available.',
                ])
                ->assertOk()
                ->assertJsonPath('ppmp.status', 'OPPMO_REVIEW');

            // Stage 2: OPPMO Receives & Approves -> TWG_REVIEW
            $this->actingAs($this->oppmoOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                ->assertOk();

            $this->actingAs($this->oppmoOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve", [
                    'remarks' => 'Procurement mode and schedule validated by OPPMO.',
                ])
                ->assertOk()
                ->assertJsonPath('ppmp.status', 'TWG_REVIEW');

            // Stage 3: TWG Receives & Approves -> OPPMO_REVIEW (for APP generation)
            $this->actingAs($this->twgOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                ->assertOk();

            $this->actingAs($this->twgOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/twg/approve", [
                    'remarks' => 'Technical specifications cleared by BAC-TWG.',
                ])
                ->assertOk()
                ->assertJsonPath('ppmp.status', 'OPPMO_REVIEW');

            // Stage 4: OPPMO Receives post-TWG, generates the official APP, and Approves -> HEAD_PENDING
            $this->actingAs($this->oppmoOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                ->assertOk();

            $this->actingAs($this->oppmoOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/app-data", [
                    'is_generated' => true,
                    'rows' => [
                        [
                            'code' => '5-02-03-010',
                            'projectTitle' => $ppmp->title,
                            'endUser' => $endUser->office->name,
                            'mode' => 'Competitive Bidding',
                            'estimatedBudget' => (float) $ppmp->fresh()->total_budget,
                        ],
                    ],
                ])
                ->assertOk();

            $this->actingAs($this->oppmoOfficer)
                ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve", [
                    'remarks' => 'APP generated and verified by OPPMO.',
                ])
                ->assertOk()
                ->assertJsonPath('ppmp.status', 'HEAD_PENDING');

            // Stage 5: Office Head (or Authorized Staff for first 2 offices) Receives & Approves -> READY_TO_PRINT
            $headApprover = ($endUser->office_id === $this->offices[0]->id)
                ? $this->authorizedStaff[0]
                : $this->headUsers[$endUser->office_id];

            $this->actingAs($headApprover)
                ->postJson("/api/ppmps/{$ppmp->uuid}/receive")
                ->assertOk();

            $this->actingAs($headApprover)
                ->postJson("/api/ppmps/{$ppmp->uuid}/head/approve", [
                    'remarks' => 'Approved by Department Head for final printing.',
                ])
                ->assertOk()
                ->assertJsonPath('ppmp.status', 'READY_TO_PRINT');
        }

        // Verify all 15 PPMPs reached READY_TO_PRINT
        $this->assertSame(15, Ppmp::where('status', 'READY_TO_PRINT')->count());

        // Test Amendment & Supplemental requests on an approved PPMP
        $firstEntry = $activePpmps[0];
        $originalTracker = $firstEntry['ppmp']->fresh()->tracking_number;

        $letterFile = UploadedFile::fake()->createWithContent(
            'amendment_request_letter.pdf',
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"
        );

        $this->actingAs($firstEntry['user'])
            ->postJson("/api/ppmps/{$firstEntry['ppmp']->uuid}/request-amendment-or-supplemental", [
                'request_type' => 'AMENDMENT',
                'request_scope' => 'PPMP_APP',
                'reason' => 'Price adjustment on Q2 items.',
                'letter_file' => $letterFile,
            ])
            ->assertOk();

        $approveAmendRes = $this->actingAs($this->adminUser)
            ->postJson("/api/ppmps/{$firstEntry['ppmp']->uuid}/amendment/approve")
            ->assertOk();

        $newAmendedUuid = $approveAmendRes->json('ppmp.uuid');
        $this->assertNotEquals($firstEntry['ppmp']->uuid, $newAmendedUuid);
        $this->assertSame($originalTracker, $approveAmendRes->json('ppmp.tracking_number'));
        $this->assertSame('APPROVED', $firstEntry['ppmp']->fresh()->amendment_status);
    }

    public function test_monitoring_system_concurrent_pims_publishing_and_zero_write_on_clean_get(): void
    {
        $this->seedMultiUserEnvironment();

        // Create 15 READY_TO_PRINT PPMPs and publish them to PIMS
        $publishedProjects = [];
        for ($i = 0; $i < 15; $i++) {
            $endUser = $this->endUsers[$i];
            $ppmp = Ppmp::create([
                'uuid' => (string) Str::uuid(),
                'tracking_number' => sprintf('PGOGOODS-2026-%06d', $i + 1),
                'ppmp_number' => (string) ($i + 1),
                'office_id' => $endUser->office_id,
                'implementing_unit' => $endUser->office->name,
                'created_by' => $endUser->id,
                'title' => "Monitored PIMS Project #{$i}",
                'source_of_fund' => 'General Fund',
                'fiscal_year' => '2026',
                'plan_type' => 'FINAL',
                'total_budget' => 550000 + ($i * 25000),
                'status' => 'READY_TO_PRINT',
                'prepared_at' => now(),
                'ready_to_print_at' => now(),
            ]);

            $publisher = ($i % 2 === 0) ? $endUser : $this->monitorOfficer;
            $res = $this->actingAs($publisher)
                ->postJson('/api/monitoring/pims-publish', [
                    'ppmp_uuid' => $ppmp->uuid,
                    'project_title' => $ppmp->title,
                    'category' => ($i % 3 === 0) ? 'INFRA' : 'GOODS_CONSULTING',
                    'procurement_mode' => 'CB',
                    'abc_amount' => $ppmp->total_budget,
                    'pr_number' => $ppmp->tracking_number,
                    'pims_pr_id' => sprintf('PIMS-2026-%04d', $i + 1),
                    'office_id' => $endUser->office_id,
                    'implementing_unit' => $endUser->office->name,
                    'end_user_name' => $endUser->name,
                ])
                ->assertStatus(201);

            $publishedProjects[] = $res->json('project');
        }

        $this->assertSame(15, MonitoringProject::count());

        // First call syncs any initial state
        $this->actingAs($this->monitorOfficer)
            ->getJson('/api/monitoring/projects')
            ->assertOk()
            ->assertJsonCount(15, 'projects');

        // Second call to /api/monitoring/projects and /api/monitoring/stats MUST NOT execute any UPDATE queries
        // when no PPMPs have changed (preventing database row lock contention when 15-50 users refresh the dashboard)
        DB::enableQueryLog();
        DB::flushQueryLog();

        $this->actingAs($this->monitorOfficer)
            ->getJson('/api/monitoring/projects')
            ->assertOk();

        $this->actingAs($this->monitorOfficer)
            ->getJson('/api/monitoring/stats')
            ->assertOk()
            ->assertJsonPath('total_projects', 15);

        $queries = collect(DB::getQueryLog())->pluck('query');
        $updateQueries = $queries->filter(fn ($sql) => str_starts_with(strtolower(trim($sql)), 'update '));

        $this->assertCount(
            0,
            $updateQueries,
            'Expected 0 UPDATE queries during clean GET /api/monitoring/projects and /api/monitoring/stats, but found: ' . $updateQueries->implode('; ')
        );
    }

    public function test_query_count_and_latency_benchmarks_under_50_users_and_50_ppmps_load(): void
    {
        $this->seedMultiUserEnvironment();

        $statuses = [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_REVIEW',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_REVIEW',
            'OPPMO_REVIEW',
            'TWG_REVIEW',
            'READY_TO_PRINT',
        ];

        // Seed 50 PPMPs across the 30 End Users and 10 Offices with items, attachments, routes, reviews, and notifications
        for ($i = 0; $i < 50; $i++) {
            $endUser = $this->endUsers[$i % count($this->endUsers)];
            $status = $statuses[$i % count($statuses)];

            $ppmp = Ppmp::create([
                'uuid' => (string) Str::uuid(),
                'tracking_number' => sprintf('%sGOODS-2026-%06d', $endUser->office->code, $i + 1),
                'ppmp_number' => (string) ($i + 1),
                'office_id' => $endUser->office_id,
                'implementing_unit' => $endUser->office->name,
                'created_by' => $endUser->id,
                'title' => "Benchmark Procurement Project #{$i}",
                'source_of_fund' => ($i % 4 === 0) ? 'Trust Fund' : 'General Fund',
                'fiscal_year' => ($i % 2 === 0) ? '2026' : '2027',
                'plan_type' => 'FINAL',
                'total_budget' => 120000 + ($i * 10000),
                'status' => $status,
                'attachment_list_data' => ['is_generated' => true, 'rows' => [['specific_items' => 'Item', 'cost' => 120000]]],
                'app_data' => ['is_generated' => true, 'rows' => [['projectTitle' => "Benchmark #{$i}", 'endUser' => $endUser->office->name]]],
                'prepared_at' => now(),
            ]);

            PpmpItem::create([
                'ppmp_id' => $ppmp->id,
                'item_no' => 1,
                'description' => "Benchmark Item #{$i}",
                'project_type' => 'Goods',
                'quantity_size' => '10 pcs',
                'procurement_mode' => 'Competitive Bidding',
                'start_date' => '01/2026',
                'end_date' => '06/2026',
                'source_of_fund' => $ppmp->source_of_fund,
                'estimated_budget' => $ppmp->total_budget,
            ]);

            PpmpAttachment::create([
                'uuid' => (string) Str::uuid(),
                'ppmp_id' => $ppmp->id,
                'uploaded_by' => $endUser->id,
                'attachment_type' => 'MARKET_SCOPING',
                'original_filename' => 'market_scoping.pdf',
                'stored_filename' => 'market_scoping.pdf',
                'storage_path' => 'ppmp/market_scoping.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
            ]);

            // Notify the office head and end user
            $head = $this->headUsers[$endUser->office_id];
            SystemNotification::notify(
                $head->id,
                'PPMP Awaiting Office Head Approval',
                "PPMP {$ppmp->tracking_number} is awaiting your review.",
                $ppmp->id,
                'warning'
            );
            SystemNotification::notify(
                $endUser->id,
                'PPMP Status Updated',
                "PPMP {$ppmp->tracking_number} status is {$status}.",
                $ppmp->id,
                'info'
            );
        }

        // Warm static caches once (signatories & system settings)
        SystemSetting::getSignatureSettings();
        PpmpSignatory::getActiveSignatories();

        // 1. Benchmark GET /api/ppmps (per_page=50) as Admin viewing all 50 PPMPs
        DB::enableQueryLog();
        DB::flushQueryLog();
        $t0 = hrtime(true);

        $listRes = $this->actingAs($this->adminUser)
            ->getJson('/api/ppmps?per_page=50')
            ->assertOk();

        $listMs = (hrtime(true) - $t0) / 1e6;
        $listQueries = count(DB::getQueryLog());

        $this->assertCount(50, $listRes->json('data'));
        // Even with 50 PPMPs serialized on the page, query count must be strictly bounded (<= 16 queries, zero N+1!)
        $this->assertLessThanOrEqual(
            16,
            $listQueries,
            "GET /api/ppmps?per_page=50 executed {$listQueries} queries (N+1 regression detected)"
        );
        $this->assertLessThan(350, $listMs, "GET /api/ppmps took {$listMs}ms");

        // 2. Benchmark GET /api/notifications for Office Head (polled every 20s by all 50 users)
        $sampleHead = $this->headUsers[$this->offices[0]->id];
        // Initial sync pass populates any missing stage notifications once
        $this->actingAs($sampleHead)->getJson('/api/notifications')->assertOk();

        // Subsequent 20-second polling requests must be pure read-only with bounded queries and 0 N+1
        DB::flushQueryLog();
        $t1 = hrtime(true);

        $notifRes = $this->actingAs($sampleHead)
            ->getJson('/api/notifications')
            ->assertOk();

        $notifMs = (hrtime(true) - $t1) / 1e6;
        $notifQueries = count(DB::getQueryLog());

        $this->assertNotEmpty($notifRes->json('notifications'));
        // Must execute in <= 14 queries regardless of how many office PPMPs or notifications exist
        $this->assertLessThanOrEqual(
            14,
            $notifQueries,
            "GET /api/notifications for Office Head executed {$notifQueries} queries"
        );
        $this->assertLessThan(150, $notifMs, "GET /api/notifications took {$notifMs}ms");

        // 3. Benchmark GET /api/dashboard across EndUser, Head, BudgetOfficer, and SuperAdmin
        $rolesToBenchmark = [
            'end_user' => ['user' => $this->endUsers[0], 'max_queries' => 16],
            'head' => ['user' => $sampleHead, 'max_queries' => 16],
            'budget_officer' => ['user' => $this->budgetOfficers[0], 'max_queries' => 16],
            'super_admin' => ['user' => $this->superAdminUser, 'max_queries' => 45],
        ];

        foreach ($rolesToBenchmark as $roleName => $cfg) {
            DB::flushQueryLog();
            $tRole = hrtime(true);

            $this->actingAs($cfg['user'])
                ->getJson('/api/dashboard')
                ->assertOk()
                ->assertJsonPath('role', $roleName);

            $roleMs = (hrtime(true) - $tRole) / 1e6;
            $roleQueries = count(DB::getQueryLog());

            $this->assertLessThanOrEqual(
                $cfg['max_queries'],
                $roleQueries,
                "GET /api/dashboard for {$roleName} executed {$roleQueries} queries (limit {$cfg['max_queries']})"
            );
            $this->assertLessThan(350, $roleMs, "GET /api/dashboard for {$roleName} took {$roleMs}ms");
        }
    }
}
