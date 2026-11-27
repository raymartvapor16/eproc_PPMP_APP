<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\SystemRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SystemRequestSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected Office $office;
    protected User $superAdmin;
    protected User $admin;
    protected User $endUserA;
    protected User $endUserB;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->office = Office::create([
            'name' => 'Procurement Office',
            'code' => 'PMO',
        ]);

        /** @var User $superAdmin */
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
        $this->superAdmin = $superAdmin;

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
        $this->admin = $admin;

        /** @var User $endUserA */
        $endUserA = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
        $this->endUserA = $endUserA;

        /** @var User $endUserB */
        $endUserB = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
        $this->endUserB = $endUserB;
    }

    public function test_unauthenticated_users_cannot_access_system_requests(): void
    {
        $this->postJson('/api/system-requests/generate-ticket')->assertStatus(401);
        $this->postJson('/api/system-requests', [])->assertStatus(401);
        $this->getJson('/api/system-requests/mine')->assertStatus(401);
        $this->getJson('/api/system-requests')->assertStatus(401);
    }

    public function test_user_can_generate_ticket_and_submit_request_with_valid_image(): void
    {
        $ticketRes = $this->actingAs($this->endUserA)
            ->postJson('/api/system-requests/generate-ticket')
            ->assertOk()
            ->assertJsonStructure(['ticket_number', 'ticket_token', 'expires_in_minutes']);

        $ticketNumber = $ticketRes->json('ticket_number');
        $ticketToken = $ticketRes->json('ticket_token');

        $image = UploadedFile::fake()->image('error_screenshot.png', 400, 300);

        $createRes = $this->actingAs($this->endUserA)->post('/api/system-requests', [
            'ticket_number' => $ticketNumber,
            'ticket_token' => $ticketToken,
            'request_type' => 'bug_fix',
            'system_module' => 'supplier_evaluation',
            'priority' => 'high',
            'subject' => '<script>alert(1)</script>PDF button issue',
            'description' => '<b>Clicking</b> the export button throws an error on mobile view.',
            'attachment' => $image,
        ], ['Accept' => 'application/json']);

        $createRes->assertStatus(201);
        $sr = SystemRequest::where('ticket_number', $ticketNumber)->firstOrFail();

        // Stored XSS stripped
        $this->assertSame('alert(1)PDF button issue', $sr->subject);
        $this->assertSame('Clicking the export button throws an error on mobile view.', $sr->description);
        $this->assertTrue(Storage::disk('local')->exists($sr->attachment_path));

        // Duplicate submission of same ticket is rejected
        $this->actingAs($this->endUserA)->post('/api/system-requests', [
            'ticket_number' => $ticketNumber,
            'ticket_token' => $ticketToken,
            'request_type' => 'bug_fix',
            'system_module' => 'supplier_evaluation',
            'priority' => 'high',
            'subject' => 'Duplicate submission',
            'description' => 'Trying to reuse the same ticket number.',
        ], ['Accept' => 'application/json'])->assertStatus(422);

        // Owner can view own attachment via encrypted URL
        $attachmentUrl = $createRes->json('data.attachment_url');
        $this->assertNotEmpty($attachmentUrl);
        $this->actingAs($this->endUserA)->get($attachmentUrl)
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // Another user using User A's copied encrypted attachment URL gets 403
        $this->actingAs($this->endUserB)->getJson($attachmentUrl)->assertStatus(403);

        // Raw numeric attachment ID gets 403
        $this->actingAs($this->superAdmin)->getJson("/api/system-requests/{$sr->id}/attachment")->assertStatus(403);
    }

    public function test_rejects_non_image_disguised_php_and_oversized_files(): void
    {
        $ticketRes = $this->actingAs($this->endUserA)->postJson('/api/system-requests/generate-ticket')->assertOk();
        $base = [
            'ticket_number' => $ticketRes->json('ticket_number'),
            'ticket_token' => $ticketRes->json('ticket_token'),
            'request_type' => 'enhancement',
            'system_module' => 'eproc_ppmp_app',
            'priority' => 'medium',
            'subject' => 'Add new summary report',
            'description' => 'Please add a quarterly summary report for all offices.',
        ];

        // Disguised PHP file renamed to .png (fails magic-byte getimagesize)
        $fakePng = UploadedFile::fake()->createWithContent('shell.png', '<?php system($_GET["c"]); ?>');
        $this->actingAs($this->endUserA)
            ->post('/api/system-requests', array_merge($base, ['attachment' => $fakePng]), ['Accept' => 'application/json'])
            ->assertStatus(422);

        // PDF file rejected (image only)
        $pdf = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');
        $this->actingAs($this->endUserA)
            ->post('/api/system-requests', array_merge($base, ['attachment' => $pdf]), ['Accept' => 'application/json'])
            ->assertStatus(422);

        // Oversized > 5MB rejected
        $bigImg = UploadedFile::fake()->image('huge.png')->size(5200);
        $this->actingAs($this->endUserA)
            ->post('/api/system-requests', array_merge($base, ['attachment' => $bigImg]), ['Accept' => 'application/json'])
            ->assertStatus(422);

        // Forged ticket token rejected
        $this->actingAs($this->endUserB)
            ->post('/api/system-requests', $base, ['Accept' => 'application/json'])
            ->assertStatus(422);
    }

    public function test_only_super_admin_can_manage_all_system_requests(): void
    {
        $ticketRes = $this->actingAs($this->endUserA)->postJson('/api/system-requests/generate-ticket')->assertOk();
        $image = UploadedFile::fake()->image('ui_bug.jpg', 200, 200);

        $createRes = $this->actingAs($this->endUserA)->post('/api/system-requests', [
            'ticket_number' => $ticketRes->json('ticket_number'),
            'ticket_token' => $ticketRes->json('ticket_token'),
            'request_type' => 'enhancement',
            'system_module' => 'pims',
            'priority' => 'medium',
            'subject' => 'Add dark mode toggle',
            'description' => 'Requesting an optional dark mode toggle on PIMS dashboard.',
            'attachment' => $image,
        ], ['Accept' => 'application/json'])->assertStatus(201);

        $srId = $createRes->json('data.id');
        $sr = SystemRequest::findOrFail($srId);

        // Non-super-admin (end_user & regular admin) cannot access Super Admin tab endpoints
        $this->actingAs($this->endUserA)->getJson('/api/system-requests')->assertStatus(403);
        $this->actingAs($this->admin)->getJson('/api/system-requests')->assertStatus(403);
        $this->actingAs($this->admin)->patchJson("/api/system-requests/{$srId}/status", ['status' => 'resolved'])->assertStatus(403);
        $this->actingAs($this->admin)->deleteJson("/api/system-requests/{$srId}")->assertStatus(403);

        // Super Admin can list, update status/remarks, view attachment, and delete
        $listRes = $this->actingAs($this->superAdmin)->getJson('/api/system-requests')->assertOk();
        $this->assertSame(1, $listRes->json('counts.total'));

        $superAdminAttachmentUrl = $listRes->json('data.0.attachment_url');
        $this->actingAs($this->superAdmin)->get($superAdminAttachmentUrl)->assertOk();

        $this->actingAs($this->superAdmin)
            ->patchJson("/api/system-requests/{$srId}/status", [
                'status' => 'resolved',
                'admin_remarks' => 'Implemented in next release.',
            ])
            ->assertOk();

        $this->assertSame('resolved', $sr->fresh()->status);
        $this->assertSame('Implemented in next release.', $sr->fresh()->admin_remarks);

        $attachmentPath = $sr->attachment_path;
        $this->actingAs($this->superAdmin)->deleteJson("/api/system-requests/{$srId}")->assertOk();
        $this->assertDatabaseMissing('system_requests', ['id' => $srId]);
        $this->assertFalse(Storage::disk('local')->exists($attachmentPath));
    }
}
