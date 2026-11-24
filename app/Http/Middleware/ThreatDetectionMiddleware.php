<?php

namespace App\Http\Middleware;

use App\Services\SecurityThreatService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ThreatDetectionMiddleware
{
    protected array $cliUserAgents = [
        'curl/',
        'python-requests',
        'python-urllib',
        'wget/',
        'httpie',
        'powershell',
        'sqlmap',
        'nikto',
        'gobuster',
        'ffuf',
        'nuclei',
        'burpsuite',
        'dirbuster',
        'nmap',
        'masscan',
        'zgrab',
        'postmanruntime',
        'insomnia',
        'axios/0.',
        'go-http-client',
    ];

    protected array $suspiciousPatterns = [
        'SQL_INJECTION' => '/(\bunion\b.+\bselect\b|\bor\b\s+[\'"]?1[\'"]?\s*=\s*[\'"]?1|\bsleep\s*\(\s*\d+\s*\)|\bbenchmark\s*\(|\bdrop\s+table\b|--\s*$)/i',
        'XSS_ATTEMPT' => '/(<script\b|javascript:|onerror\s*=|onload\s*=|<iframe\b)/i',
        'PATH_TRAVERSAL_PROBE' => '/(\.\.\/|\.\.\\\\|\/etc\/passwd|wp-admin|wp-login|phpmyadmin|\.env\b|\.git\/)/i',
    ];

    protected array $dangerousFileExts = [
        'php', 'phtml', 'phar', 'exe', 'bat', 'cmd', 'sh', 'vbs', 'js', 'jsp', 'asp', 'aspx', 'dll', 'msi', 'ps1',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $path = '/' . ltrim($request->path(), '/');

        if (preg_match('/^\/(build|images|storage|favicon\.ico|robots\.txt)/i', $path)) {
            return $next($request);
        }

        if ($request->files->count() > 0) {
            foreach ($request->allFiles() as $field => $files) {
                $fileList = is_array($files) ? $files : [$files];
                foreach ($fileList as $file) {
                    if (!$file || !method_exists($file, 'getClientOriginalName')) continue;
                    $origName = (string) $file->getClientOriginalName();
                    $ext = strtolower((string) $file->getClientOriginalExtension());
                    $hasDoubleExt = (bool) preg_match('/\.(php|phtml|exe|bat|cmd|sh|vbs|js|jar|py|ps1)\.[a-z0-9]+$/i', $origName);

                    if (in_array($ext, $this->dangerousFileExts, true) || $hasDoubleExt) {
                        SecurityThreatService::recordThreat(
                            $request,
                            'FILE_UPLOAD_ATTACK',
                            'critical',
                            "Malicious file upload attempt detected on field '{$field}': filename '{$origName}' (ext: .{$ext}).",
                            [
                                'is_red_alert' => true,
                                'payload_summary' => [
                                    'field' => $field,
                                    'filename' => $origName,
                                    'extension' => $ext,
                                    'double_extension' => $hasDoubleExt,
                                ],
                            ]
                        );
                    }
                }
            }
        }

        $rawQuery = urldecode((string) $request->getQueryString());
        $inspectString = $path . ' ' . $rawQuery;
        foreach ($this->suspiciousPatterns as $patternName => $regex) {
            if (preg_match($regex, $inspectString, $m)) {
                SecurityThreatService::recordThreat(
                    $request,
                    'INJECTION_XSS_PROBE',
                    'high',
                    "Exploit / {$patternName} pattern detected in request URL/query ('{$m[0]}').",
                    [
                        'payload_summary' => [
                            'pattern' => $patternName,
                            'matched' => mb_substr($m[0], 0, 120),
                        ],
                    ]
                );
                break;
            }
        }

        $uaLower = strtolower((string) $request->userAgent());
        $isCliAgent = false;
        $matchedTool = null;
        foreach ($this->cliUserAgents as $sig) {
            if (str_contains($uaLower, $sig)) {
                $isCliAgent = true;
                $matchedTool = rtrim($sig, '/');
                break;
            }
        }

        $response = $next($request);
        $status = $response->getStatusCode();

        if (str_starts_with($path, '/api/super-admin/security-threats')) {
            return $response;
        }

        if ($isCliAgent && str_starts_with($path, '/api/')) {
            $tokenInfo = SecurityThreatService::extractTokenInfo($request);
            SecurityThreatService::recordThreat(
                $request,
                'CLI_API_PROBING',
                in_array($status, [401, 403, 419, 429], true) ? 'high' : 'medium',
                "Automated CLI / terminal tool ('{$matchedTool}') accessed API endpoint {$request->method()} {$path} (HTTP {$status}).",
                [
                    'status_code' => $status,
                    'payload_summary' => [
                        'tool' => $matchedTool,
                        'token_type' => $tokenInfo['token_type'],
                        'token_preview' => $tokenInfo['token_preview'],
                    ],
                ]
            );
            return $response;
        }

        if ($status === 419) {
            SecurityThreatService::recordThreat(
                $request,
                'SESSION_HIJACK',
                'high',
                "CSRF / Session Token mismatch (HTTP 419) on {$request->method()} {$path}. Possible session-riding or token forgery attempt.",
                ['status_code' => 419]
            );
        } elseif ($status === 429) {
            SecurityThreatService::recordThreat(
                $request,
                'BRUTE_FORCE',
                'high',
                "Rate limit exceeded (HTTP 429) on {$request->method()} {$path}. Possible brute-force or automated credential/API stuffing.",
                ['status_code' => 429]
            );
        } elseif ($status === 401 && str_starts_with($path, '/api/') && !in_array($path, ['/api/me', '/api/login', '/api/csrf-token'], true)) {
            $tokenInfo = SecurityThreatService::extractTokenInfo($request);
            SecurityThreatService::recordThreat(
                $request,
                'TOKEN_PROBING',
                'medium',
                "Unauthenticated API/token probe (HTTP 401) against {$request->method()} {$path}.",
                [
                    'status_code' => 401,
                    'payload_summary' => [
                        'token_type' => $tokenInfo['token_type'],
                        'token_preview' => $tokenInfo['token_preview'],
                    ],
                ]
            );
        } elseif ($status === 403 && str_starts_with($path, '/api/')) {
            SecurityThreatService::recordThreat(
                $request,
                'UNAUTHORIZED_ACCESS',
                'medium',
                "Unauthorized privilege / feature access blocked (HTTP 403) on {$request->method()} {$path}.",
                ['status_code' => 403]
            );
        }

        return $response;
    }
}
