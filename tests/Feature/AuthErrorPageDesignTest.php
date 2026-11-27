<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\SupplierPdf;
use App\Models\SupplierPurchaseOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthErrorPageDesignTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_browser_navigation_renders_designed_401_html_page(): void
    {
        $response = $this->withHeaders([
            'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ])->get('/api/supplier-evaluation/purchase-orders/7567/pdf');

        $response->assertStatus(401);
        $this->assertStringContainsString('text/html', (string) $response->headers->get('Content-Type'));
        $response->assertSee('Authentication Required');
        $response->assertSee('HTTP 401');
        $response->assertSee('/login');
        $response->assertSee('/api/supplier-evaluation/purchase-orders/7567/pdf');
    }

    public function test_unauthenticated_api_json_request_still_returns_401_json(): void
    {
        $response = $this->getJson('/api/supplier-evaluation/purchase-orders/7567/pdf');

        $response->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
    }

    public function test_unauthenticated_wildcard_accept_request_still_returns_401_json(): void
    {
        $response = $this->withHeaders([
            'Accept' => '*/*',
        ])->get('/api/supplier-evaluation/purchase-orders/7567/pdf');

        $response->assertStatus(401)
            ->assertExactJson(['message' => 'Unauthenticated.']);
    }

    public function test_unauthorized_browser_navigation_renders_designed_403_html_page(): void
    {
        $office = Office::create([
            'name' => 'Test Office',
            'code' => 'TST',
        ]);

        /** @var User $endUser */
        $endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($endUser)
            ->withHeaders([
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ])
            ->get('/api/users');

        $response->assertStatus(403);
        $this->assertStringContainsString('text/html', (string) $response->headers->get('Content-Type'));
        $response->assertSee('Access Denied');
        $response->assertSee('HTTP 403');
        $response->assertSee('Forbidden. You do not have the required role');
        $response->assertSee('Return to Dashboard');
    }

    public function test_unauthorized_api_json_request_still_returns_403_json(): void
    {
        $office = Office::create([
            'name' => 'Test Office 2',
            'code' => 'TS2',
        ]);

        /** @var User $endUser */
        $endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($endUser)->getJson('/api/users');

        $response->assertStatus(403)
            ->assertJsonStructure(['message']);
    }

    public function test_public_homepage_renders_200_with_valid_seo_and_json_ld(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('PMO eProc — E-Procurement System | Province of Davao del Sur (OPPMO)', false);
        $response->assertSee('<meta name="robots" content="index, follow">', false);
        $response->assertSee('"@context":"https://schema.org"', false);
        $response->assertSee('"alternateName":["pmoeproc","pmoeproc.cloud"', false);
        $response->assertSee('/favicon-48x48.png', false);
        $response->assertSee('/favicon-192x192.png', false);
    }

    public function test_sitemap_xml_returns_xml_with_noindex_robots_header(): void
    {
        $response = $this->get('/sitemap.xml');

        $response->assertStatus(200);
        $this->assertStringContainsString('application/xml', (string) $response->headers->get('Content-Type'));
        $this->assertSame('noindex, follow', $response->headers->get('X-Robots-Tag'));
        $response->assertSee('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', false);
    }

    public function test_unencrypted_or_tampered_po_pdf_and_auth_pdf_ids_return_403_access_denied(): void
    {
        $office = Office::create([
            'name' => 'Procurement Office',
            'code' => 'PMO',
        ]);

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => 'admin',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        // Raw numeric PO ID in browser -> designed 403 Access Denied HTML page
        $browserRes = $this->actingAs($admin)
            ->withHeaders([
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ])
            ->get('/api/supplier-evaluation/purchase-orders/8416/pdf');

        $browserRes->assertStatus(403);
        $this->assertStringContainsString('text/html', (string) $browserRes->headers->get('Content-Type'));
        $browserRes->assertSee('Access Denied');
        $browserRes->assertSee('Invalid or unencrypted purchase order reference.');
        $browserRes->assertSee('/api/supplier-evaluation/purchase-orders/8416/pdf');

        // Raw numeric PO ID via JSON API -> 403 JSON
        $this->actingAs($admin)
            ->getJson('/api/supplier-evaluation/purchase-orders/8416/pdf')
            ->assertStatus(403)
            ->assertExactJson(['message' => 'Invalid or unencrypted purchase order reference.']);

        // Cross-type token swap (User encrypted ID passed to PO PDF route) -> 403
        $wrongTypeToken = User::encryptId(8416);
        $this->actingAs($admin)
            ->getJson("/api/supplier-evaluation/purchase-orders/{$wrongTypeToken}/pdf")
            ->assertStatus(403)
            ->assertExactJson(['message' => 'Invalid or unencrypted purchase order reference.']);

        // Raw numeric Authorization PDF ID -> 403
        $this->actingAs($admin)
            ->getJson('/api/supplier-evaluation/pdfs/12/file')
            ->assertStatus(403)
            ->assertExactJson(['message' => 'Invalid or unencrypted authorization PDF reference.']);

        // Valid encrypt/decrypt round-trip
        $poToken = SupplierPurchaseOrder::encryptPdfId(8416);
        $this->assertNotSame('8416', $poToken);
        $this->assertSame(8416, SupplierPurchaseOrder::decryptPdfId($poToken));
        $this->assertNull(SupplierPdf::decryptFileId($poToken));

        $authPdfToken = SupplierPdf::encryptFileId(12);
        $this->assertNotSame('12', $authPdfToken);
        $this->assertSame(12, SupplierPdf::decryptFileId($authPdfToken));
        $this->assertNull(SupplierPurchaseOrder::decryptPdfId($authPdfToken));
    }

    public function test_encrypted_pdf_and_user_tokens_cannot_be_shared_across_users_or_sessions_and_auto_rotate(): void
    {
        $office = Office::create([
            'name' => 'Procurement Office',
            'code' => 'PMO',
        ]);

        /** @var User $adminA */
        $adminA = User::factory()->create([
            'role' => 'admin',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        /** @var User $adminB */
        $adminB = User::factory()->create([
            'role' => 'admin',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        $po = SupplierPurchaseOrder::create([
            'po_no' => 'PO-2026-9999',
            'pr_no' => 'PR-2026-9999',
            'item' => 'Test Item',
            'end_user' => 'PMO',
            'supplier' => 'Test Supplier',
            'status' => 'Pending',
        ]);

        // Token bound to adminA + sessionA
        $tokenForA = SupplierPurchaseOrder::encryptPdfId((int) $po->id, (int) $adminA->id, 'session-A', 120);

        // Copying & pasting adminA's encrypted URL as adminB -> 403 Access Denied!
        $this->actingAs($adminB)
            ->getJson("/api/supplier-evaluation/purchase-orders/{$tokenForA}/pdf")
            ->assertStatus(403)
            ->assertExactJson(['message' => 'This secure document link is bound to another user and cannot be shared.']);

        // Same user, different browser session -> 403 Access Denied!
        $sessionCheck = SupplierPurchaseOrder::decryptPdfToken($tokenForA, (int) $adminA->id, 'session-B', true);
        $this->assertNull($sessionCheck['id']);
        $this->assertSame('This secure document link is bound to another session and cannot be shared.', $sessionCheck['error']);

        // Refresh-token endpoint rotates and issues a brand-new encrypted token each time
        $initialToken = SupplierPurchaseOrder::encryptPdfId((int) $po->id, (int) $adminA->id, null, 120);
        $refresh1 = $this->actingAs($adminA)
            ->getJson("/api/supplier-evaluation/purchase-orders/{$initialToken}/refresh-token")
            ->assertOk()
            ->json('encrypted_id');

        $refresh2 = $this->actingAs($adminA)
            ->getJson("/api/supplier-evaluation/purchase-orders/{$refresh1}/refresh-token")
            ->assertOk()
            ->json('encrypted_id');

        $this->assertNotEmpty($refresh1);
        $this->assertNotEmpty($refresh2);
        $this->assertNotSame($initialToken, $refresh1);
        $this->assertNotSame($refresh1, $refresh2);

        // Copying adminA's refreshed user token and using it as adminB -> 403!
        $userTokenForA = User::encryptId((int) $adminA->id, (int) $adminA->id, 'session-A', 120);
        $this->actingAs($adminB)
            ->getJson("/api/users/{$userTokenForA}/authorization-letter")
            ->assertStatus(403)
            ->assertExactJson(['message' => 'This secure document link is bound to another user and cannot be shared.']);
    }
}
