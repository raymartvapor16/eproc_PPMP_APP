<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\PpmpItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class InfrastructureAttachmentLinkTest extends TestCase
{
    use RefreshDatabase;

    private User $creator;
    private User $twgReviewer;
    private Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial Engineering Office',
            'code' => 'PEO',
            'is_active' => true,
        ]);

        $this->creator = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->twgReviewer = User::factory()->create([
            'role' => 'twg',
            'is_active' => true,
        ]);
    }

    private function createTestPpmp(string $projectType = 'Infrastructure Projects'): Ppmp
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-' . Str::upper(Str::random(8)),
            'ppmp_number' => '1',
            'office_id' => $this->office->id,
            'created_by' => $this->creator->id,
            'year' => 2026,
            'fiscal_year' => 2026,
            'title' => 'Project: ' . $projectType,
            'project_type' => $projectType,
            'total_budget' => 500000.00,
            'status' => 'DRAFT',
            'current_stage' => 'END_USER',
        ]);

        PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'is_header' => false,
            'project_type' => $projectType,
            'description' => 'Detailed Item for ' . $projectType,
            'general_description' => 'Detailed Item for ' . $projectType,
            'unit' => 'lot',
            'quantity' => 1,
            'unit_cost' => 500000.00,
            'estimated_budget' => 500000.00,
            'procurement_mode' => 'Competitive Bidding',
        ]);

        return $ppmp;
    }

    public function test_infrastructure_ppmp_can_attach_cloud_storage_link(): void
    {
        $ppmp = $this->createTestPpmp('Infrastructure Projects');

        $payload = [
            'title' => 'Program of Works (POW) & Structural Blueprints',
            'url' => 'https://drive.google.com/drive/folders/bat-cave-infra-2026',
            'description' => 'Complete CAD civil and structural engineering drawings (1.4 GB)',
        ];

        $response = $this->actingAs($this->creator)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachments/link", $payload);

        $response->assertStatus(201)
            ->assertJsonPath('attachment.original_filename', 'Program of Works (POW) & Structural Blueprints')
            ->assertJsonPath('attachment.attachment_type', 'INFRA_OTHER_DOC')
            ->assertJsonPath('attachment.mime_type', 'application/x-external-link');

        $this->assertDatabaseHas('ppmp_attachments', [
            'ppmp_id' => $ppmp->id,
            'original_filename' => 'Program of Works (POW) & Structural Blueprints',
            'external_url' => 'https://drive.google.com/drive/folders/bat-cave-infra-2026',
            'attachment_type' => 'INFRA_OTHER_DOC',
        ]);
    }

    public function test_non_infrastructure_ppmp_cannot_attach_cloud_storage_link(): void
    {
        $ppmp = $this->createTestPpmp('Goods');

        $payload = [
            'title' => 'Goods Specifications',
            'url' => 'https://drive.google.com/drive/folders/supplies',
        ];

        $response = $this->actingAs($this->creator)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachments/link", $payload);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'External cloud storage links are restricted to Infrastructure Projects only.');
    }

    public function test_insecure_protocols_and_private_ssrf_ips_are_rejected(): void
    {
        $ppmp = $this->createTestPpmp('Infrastructure Projects');

        $httpResponse = $this->actingAs($this->creator)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachments/link", [
                'title' => 'Insecure link',
                'url' => 'http://insecure-site.com/plans',
            ]);
        $httpResponse->assertStatus(422);

        $localResponse = $this->actingAs($this->creator)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachments/link", [
                'title' => 'Localhost exploit',
                'url' => 'https://localhost/admin/secret',
            ]);
        $localResponse->assertStatus(422);

        $privateIpResponse = $this->actingAs($this->creator)
            ->postJson("/api/ppmps/{$ppmp->uuid}/attachments/link", [
                'title' => 'Private IP exploit',
                'url' => 'https://192.168.1.50/router-config',
            ]);
        $privateIpResponse->assertStatus(422);
    }

    public function test_viewing_external_cloud_link_returns_safe_json_gateway(): void
    {
        $ppmp = $this->createTestPpmp('Infrastructure Projects');

        $att = PpmpAttachment::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $ppmp->id,
            'uploaded_by' => $this->creator->id,
            'original_filename' => 'Engineering Geotechnical Survey',
            'stored_filename' => 'external_link',
            'storage_path' => 'https://onedrive.live.com/view/geotech-survey',
            'external_url' => 'https://onedrive.live.com/view/geotech-survey',
            'mime_type' => 'application/x-external-link',
            'attachment_type' => 'INFRA_OTHER_DOC',
            'file_size' => 0,
        ]);

        $response = $this->actingAs($this->creator)
            ->getJson("/api/ppmps/{$ppmp->uuid}/attachments/{$att->uuid}/view");

        $response->assertStatus(200)
            ->assertJson([
                'is_external_link' => true,
                'external_url' => 'https://onedrive.live.com/view/geotech-survey',
                'title' => 'Engineering Geotechnical Survey',
            ]);
    }
}
