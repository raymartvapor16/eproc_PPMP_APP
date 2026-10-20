<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\SupportingDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupportingDocumentManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $superAdminUser;
    protected User $endUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial General Services Office',
            'code' => 'PGSO',
        ]);

        $this->adminUser = User::factory()->create([
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->superAdminUser = User::factory()->create([
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    public function test_seeded_supporting_documents_exist(): void
    {
        $this->assertDatabaseHas('supporting_documents', ['name' => '3 Pre Canvass']);
        $this->assertDatabaseHas('supporting_documents', ['name' => 'Market Scoping']);
        $this->assertDatabaseHas('supporting_documents', ['name' => 'Latest PO']);
        $this->assertDatabaseHas('supporting_documents', ['name' => 'List of Attachment']);
    }

    public function test_end_user_can_fetch_active_documents_only(): void
    {
        SupportingDocument::create([
            'name' => 'Inactive Test Document',
            'is_active' => false,
            'display_order' => 99,
        ]);

        $response = $this->actingAs($this->endUser)->getJson('/api/supporting-documents');
        $response->assertStatus(200);

        $names = collect($response->json())->pluck('name')->toArray();
        $this->assertContains('3 Pre Canvass', $names);
        $this->assertNotContains('Inactive Test Document', $names);
    }

    public function test_admin_can_create_new_supporting_document(): void
    {
        $payload = [
            'name' => 'Special Order Authorization',
            'description' => 'Signed special order from the governor',
            'is_active' => true,
            'display_order' => 10,
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/supporting-documents', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('document.name', 'Special Order Authorization');

        $this->assertDatabaseHas('supporting_documents', ['name' => 'Special Order Authorization']);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'SUPPORTING_DOCUMENT_CREATED',
            'entity_type' => 'supporting_documents',
            'user_id' => $this->adminUser->id,
        ]);
    }

    public function test_admin_can_update_supporting_document(): void
    {
        $doc = SupportingDocument::where('name', '3 Pre Canvass')->firstOrFail();

        $response = $this->actingAs($this->adminUser)->putJson("/api/supporting-documents/{$doc->id}", [
            'name' => '3 Pre-Canvass Quotations',
            'description' => 'Updated description for pre canvass',
            'is_active' => false,
            'display_order' => 5,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('document.name', '3 Pre-Canvass Quotations')
            ->assertJsonPath('document.is_active', false);

        $this->assertDatabaseHas('supporting_documents', [
            'id' => $doc->id,
            'name' => '3 Pre-Canvass Quotations',
            'is_active' => false,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'SUPPORTING_DOCUMENT_UPDATED',
            'entity_type' => 'supporting_documents',
            'entity_id' => $doc->id,
            'user_id' => $this->adminUser->id,
        ]);
    }

    public function test_admin_can_delete_supporting_document(): void
    {
        $doc = SupportingDocument::create([
            'name' => 'Temporary Document to Delete',
            'is_active' => true,
            'display_order' => 50,
        ]);

        $response = $this->actingAs($this->adminUser)->deleteJson("/api/supporting-documents/{$doc->id}");
        $response->assertStatus(200);

        $this->assertDatabaseMissing('supporting_documents', ['id' => $doc->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'SUPPORTING_DOCUMENT_DELETED',
            'entity_type' => 'supporting_documents',
            'entity_id' => $doc->id,
            'user_id' => $this->adminUser->id,
        ]);
    }

    public function test_end_user_cannot_mutate_supporting_documents(): void
    {
        $doc = SupportingDocument::where('name', '3 Pre Canvass')->firstOrFail();

        $this->actingAs($this->endUser)->postJson('/api/supporting-documents', [
            'name' => 'Hacker Document',
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->putJson("/api/supporting-documents/{$doc->id}", [
            'name' => 'Hacked Document',
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->deleteJson("/api/supporting-documents/{$doc->id}")
            ->assertStatus(403);
    }
}
