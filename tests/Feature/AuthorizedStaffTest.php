<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuthorizedStaffTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_staff_registration_requires_authorization_letter(): void
    {
        $office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
            'head_name' => 'Engr. Juan Dela Cruz',
        ]);

        $response = $this->postJson('/api/register', [
            'name' => 'Authorized Staff Member',
            'email' => 'authstaff@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'authorized_staff',
            'office_id' => $office->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['authorization_letter']);
    }

    public function test_authorized_staff_registration_stores_pdf_in_private_authorization_letter_folder(): void
    {
        Storage::fake('local');

        $office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
            'head_name' => 'Engr. Juan Dela Cruz',
        ]);

        $pdfContent = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
        $file = UploadedFile::fake()->createWithContent('official_letter.pdf', $pdfContent);

        $response = $this->postJson('/api/register', [
            'name' => 'Authorized Staff Member',
            'email' => 'authstaff@example.com',
            'phone_number' => '+639123456789',
            'address' => 'Capitol Complex, City',
            'designation' => 'Authorized Staff Officer',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'authorization_letter' => $file,
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'authstaff@example.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('authorized_staff', $user->role);
        $this->assertNotNull($user->authorization_letter_path);
        $this->assertStringStartsWith('authorization_letter/', $user->authorization_letter_path);

        Storage::assertExists($user->authorization_letter_path);
    }

    public function test_authorization_letter_rejects_oversized_files_above_5mb(): void
    {
        Storage::fake('local');

        $office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
            'head_name' => 'Engr. Juan Dela Cruz',
        ]);

        $oversizedFile = UploadedFile::fake()->create('large_auth.pdf', 6000, 'application/pdf');

        $response = $this->postJson('/api/register', [
            'name' => 'Authorized Staff Member',
            'email' => 'authstaff_large@example.com',
            'phone_number' => '+639123456789',
            'address' => 'Capitol Complex, City',
            'designation' => 'Authorized Staff Officer',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'authorization_letter' => $oversizedFile,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['authorization_letter']);
    }

    public function test_authorization_letter_rejects_non_pdf_and_disguised_files(): void
    {
        Storage::fake('local');

        $office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
            'head_name' => 'Engr. Juan Dela Cruz',
        ]);

        $urlFile = UploadedFile::fake()->create('Letter.url', 1, 'application/octet-stream');
        $res1 = $this->postJson('/api/register', [
            'name' => 'Staff 1',
            'email' => 'staff1@example.com',
            'phone_number' => '+639123456789',
            'address' => 'Capitol Complex',
            'designation' => 'Staff',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'authorization_letter' => $urlFile,
        ]);
        $res1->assertStatus(422);

        $disguised = UploadedFile::fake()->createWithContent('exploit.exe.pdf', "%PDF-1.4\nMalicious code");
        $res2 = $this->postJson('/api/register', [
            'name' => 'Staff 2',
            'email' => 'staff2@example.com',
            'phone_number' => '+639123456789',
            'address' => 'Capitol Complex',
            'designation' => 'Staff',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'authorization_letter' => $disguised,
        ]);
        $res2->assertStatus(422)
            ->assertJsonPath('message', 'Security Error: Suspicious disguised multi-extension filename detected.');

        $fakePdf = UploadedFile::fake()->createWithContent('letter.pdf', 'Not a valid pdf');
        $res3 = $this->postJson('/api/register', [
            'name' => 'Staff 3',
            'email' => 'staff3@example.com',
            'phone_number' => '+639123456789',
            'address' => 'Capitol Complex',
            'designation' => 'Staff',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'authorization_letter' => $fakePdf,
        ]);
        $res3->assertStatus(422)
            ->assertJsonPath('message', 'Security Error: Invalid file content. The uploaded document does not have a genuine PDF header.');
    }

    public function test_authorized_staff_can_receive_and_approve_ppmp_just_like_head(): void
    {
        $office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
            'head_name' => 'Engr. Juan Dela Cruz',
        ]);

        $endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        $authorizedStaff = User::factory()->create([
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'is_active' => true,
            'authorization_letter_path' => 'authorization_letter/dummy.pdf',
        ]);

        $this->assertTrue($authorizedStaff->isHead());
        $this->assertTrue($authorizedStaff->isAuthorizedStaff());

        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-000001',
            'tracking_number' => 'PPMP-2026-000001',
            'office_id' => $office->id,
            'fiscal_year' => '2026',
            'title' => 'Office Supplies 2026',
            'status' => 'HEAD_PENDING',
            'created_by' => $endUser->id,
        ]);

        $this->actingAs($authorizedStaff)
            ->getJson('/api/dashboard/stats')
            ->assertStatus(200);

        $receiveResponse = $this->actingAs($authorizedStaff)
            ->postJson("/api/ppmps/{$ppmp->uuid}/receive");
        $receiveResponse->assertStatus(200);

        $ppmp->refresh();
        $this->assertNotNull($ppmp->head_received_at);

        $approveResponse = $this->actingAs($authorizedStaff)
            ->postJson("/api/ppmps/{$ppmp->uuid}/head/approve");
        $approveResponse->assertStatus(200);

        $ppmp->refresh();
        $this->assertEquals('READY_TO_PRINT', $ppmp->status);
    }

    public function test_admin_can_view_authorized_staff_letter(): void
    {
        Storage::fake('local');

        $office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
        ]);

        $pdfPath = 'authorization_letter/test_letter.pdf';
        Storage::disk('local')->put($pdfPath, "%PDF-1.4 sample pdf content %%EOF");

        $staff = User::factory()->create([
            'role' => 'authorized_staff',
            'office_id' => $office->id,
            'authorization_letter_path' => $pdfPath,
        ]);

        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $response = $this->actingAs($admin)->get("/api/users/{$staff->id}/authorization-letter");
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_admin_can_reject_pending_user_registration(): void
    {

        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        $pendingUser = User::factory()->create([
            'role' => 'authorized_staff',
            'is_active' => false,
            'approval_status' => 'pending',
        ]);

        $response = $this->actingAs($admin)->postJson("/api/users/{$pendingUser->id}/reject", [
            'reason' => 'Incomplete documents provided.',
        ]);

        $response->assertStatus(200);
        $pendingUser->refresh();
        $this->assertFalse($pendingUser->is_active);
        $this->assertEquals('rejected', $pendingUser->approval_status);
        $this->assertEquals('Incomplete documents provided.', $pendingUser->rejection_reason);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $pendingUser->email,
            'password' => 'password',
        ]);
        $loginResponse->assertStatus(403);
        $loginResponse->assertJsonFragment([
            'message' => 'Your registration request has been rejected by the Administrator. Reason: Incomplete documents provided. Please coordinate with the Office of the Provincial Procurement Management Officer for assistance.',
        ]);
    }

    public function test_admin_can_view_authorized_staff_signature(): void
    {
        Storage::fake('local');

        $sigPath = 'signatures/test_signature.png';
        Storage::disk('local')->put($sigPath, 'fake-png-data');

        $staff = User::factory()->create([
            'role' => 'authorized_staff',
            'signature_path' => $sigPath,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)->get("/api/users/{$staff->id}/signature");
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'image/png');
    }

    public function test_registration_requires_system_role(): void
    {
        $office = Office::create([
            'code' => 'ENG_TEST',
            'name' => 'Provincial Engineering Office Test',
            'head_name' => 'Engr. Juan Dela Cruz',
        ]);

        $response = $this->postJson('/api/register', [
            'name' => 'Test User',
            'email' => 'testrole@example.com',
            'phone_number' => '+639123456789',
            'address' => 'Capitol Complex, City',
            'designation' => 'Staff Officer',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => '',
            'office_id' => $office->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['role']);
    }
}
