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

        $endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $office->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($endUser)->getJson('/api/users');

        $response->assertStatus(403)
            ->assertJsonStructure(['message']);
    }
}
