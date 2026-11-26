<?php

namespace Tests\Feature;

use App\Http\Middleware\ThreatDetectionMiddleware;
use App\Models\SecurityThreatLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SmartCsrfFilterTest extends TestCase
{
    use RefreshDatabase;

    private function runMiddleware419(array $headers = [], string $uri = '/api/login', string $ip = '119.111.179.114'): void
    {
        $request = Request::create($uri, 'POST', [], [], [], [
            'REMOTE_ADDR' => $ip,
            'HTTP_HOST' => 'pmoeproc.cloud',
            'HTTP_USER_AGENT' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0',
        ]);

        foreach ($headers as $k => $v) {
            $request->headers->set($k, $v);
        }

        $middleware = new ThreatDetectionMiddleware();
        $response = $middleware->handle($request, fn () => new Response('CSRF token mismatch', 419));
        $this->assertSame(419, $response->getStatusCode());
    }

    public function test_single_same_origin_stale_token_419_on_login_is_not_logged_as_session_hijack(): void
    {
        Cache::flush();

        $this->runMiddleware419([
            'X-CSRF-TOKEN' => 'stale-token-from-idle-tab',
            'Origin' => 'https://pmoeproc.cloud',
        ], '/api/login', '119.111.179.114');

        $this->assertSame(0, SecurityThreatLog::where('threat_type', 'SESSION_HIJACK')->count());
    }

    public function test_cross_origin_419_is_immediately_logged_as_high_session_hijack(): void
    {
        Cache::flush();

        $this->runMiddleware419([
            'X-CSRF-TOKEN' => 'forged-token',
            'Origin' => 'https://evil-attacker.test',
        ], '/api/login', '203.0.113.10');

        $log = SecurityThreatLog::where('threat_type', 'SESSION_HIJACK')->first();
        $this->assertNotNull($log);
        $this->assertSame('high', $log->severity);
        $this->assertStringContainsString('Cross-origin CSRF forgery attempt', $log->attack_vector);
    }

    public function test_missing_csrf_token_419_is_immediately_logged_as_high_session_hijack(): void
    {
        Cache::flush();

        $this->runMiddleware419([
            'Origin' => 'https://pmoeproc.cloud',
        ], '/api/login', '203.0.113.11');

        $log = SecurityThreatLog::where('threat_type', 'SESSION_HIJACK')->first();
        $this->assertNotNull($log);
        $this->assertSame('high', $log->severity);
        $this->assertStringContainsString('Missing CSRF token', $log->attack_vector);
    }

    public function test_repeated_419_burst_from_same_ip_is_logged_as_high_session_hijack(): void
    {
        Cache::flush();

        $headers = [
            'X-CSRF-TOKEN' => 'replayed-token',
            'Origin' => 'https://pmoeproc.cloud',
        ];

        // 1st and 2nd benign stale-tab 419s are not logged
        $this->runMiddleware419($headers, '/api/login', '203.0.113.12');
        $this->runMiddleware419($headers, '/api/logout', '203.0.113.12');
        $this->assertSame(0, SecurityThreatLog::where('threat_type', 'SESSION_HIJACK')->count());

        // 3rd mismatch within 5 minutes triggers HIGH SESSION_HIJACK
        $this->runMiddleware419($headers, '/api/login', '203.0.113.12');
        $log = SecurityThreatLog::where('threat_type', 'SESSION_HIJACK')->first();
        $this->assertNotNull($log);
        $this->assertSame('high', $log->severity);
        $this->assertStringContainsString('Repeated CSRF / Session token mismatch burst', $log->attack_vector);
    }
}
