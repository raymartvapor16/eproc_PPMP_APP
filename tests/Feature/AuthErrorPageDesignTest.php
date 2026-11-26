<?php

namespace Tests\Feature;

use App\Models\Office;
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
}
