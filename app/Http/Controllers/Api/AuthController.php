<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public const SUPER_ADMIN_MFA_EMAIL = 'system.administrator16@gmail.com';
    public const MFA_TTL_SECONDS = 300;
    public const MFA_RESEND_COOLDOWN_SECONDS = 60;
    public const MFA_MAX_ATTEMPTS = 5;
    public const MFA_MAX_RESENDS = 3;

    protected function getSuperAdminMfaRecipient(): string
    {
        return self::SUPER_ADMIN_MFA_EMAIL;
    }

    protected function maskEmailAddress(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return '***';
        }
        [$local, $domain] = $parts;
        $len = strlen($local);
        if ($len <= 4) {
            return substr($local, 0, 1) . '***@' . $domain;
        }
        return substr($local, 0, 3) . str_repeat('*', max(3, $len - 5)) . substr($local, -2) . '@' . $domain;
    }

    protected function resolveSystemInfo(?string $rawSystem, ?User $user = null): array
    {
        $raw = strtolower(trim((string) $rawSystem));

        $mapToInfo = function (string $key): array {
            return match ($key) {
                '/supplierevaluation' => [
                    'system_key' => '/supplierevaluation',
                    'system_name' => 'Supplier Evaluation System',
                ],
                '/monitoringsystem' => [
                    'system_key' => '/monitoringsystem',
                    'system_name' => 'OPPMO Real-Time Monitoring System',
                ],
                '/pims' => [
                    'system_key' => '/pims',
                    'system_name' => 'Procurement Information Management System (PIMS)',
                ],
                default => [
                    'system_key' => '/eprocrementppmpapp',
                    'system_name' => 'E-Procurement PPMP & APP System',
                ],
            };
        };

        if (str_contains($raw, 'supplier')) {
            return $mapToInfo('/supplierevaluation');
        }
        if (str_contains($raw, 'monitor')) {
            return $mapToInfo('/monitoringsystem');
        }
        if ($raw === 'pims' || str_starts_with($raw, '/pims')) {
            return $mapToInfo('/pims');
        }

        if ($user && ($raw === '' || $raw === 'dashboard' || $raw === 'login' || $raw === 'landing')) {
            if (!$user->canAccessSystem('/eprocrementppmpapp')) {
                if ($user->canAccessSystem('/monitoringsystem')) {
                    return $mapToInfo('/monitoringsystem');
                }
                if ($user->canAccessSystem('/supplierevaluation')) {
                    return $mapToInfo('/supplierevaluation');
                }
                if ($user->canAccessSystem('/pims')) {
                    return $mapToInfo('/pims');
                }
            }
        }

        return $mapToInfo('/eprocrementppmpapp');
    }

    protected function initiateSuperAdminMfa(Request $request, User $user, bool $multiRoleSelected = false, ?array $systemInfo = null): JsonResponse
    {
        $sendThrottleKey = 'super_admin_mfa_send|' . $user->id . '|' . $request->ip();
        if (RateLimiter::tooManyAttempts($sendThrottleKey, 5)) {
            $seconds = RateLimiter::availableIn($sendThrottleKey);
            return response()->json([
                'message' => "Too many MFA verification code requests. Please wait {$seconds} seconds before trying again.",
                'retry_after' => $seconds,
            ], 429);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $mfaToken = Str::random(64);
        $recipient = $this->getSuperAdminMfaRecipient();
        $nowTs = time();

        try {
            \Illuminate\Support\Facades\Mail::to($recipient)->send(
                new \App\Mail\SuperAdminMfaCodeMail(
                    $code,
                    $user->email,
                    $user->name,
                    (string) $request->ip(),
                    (int) ceil(self::MFA_TTL_SECONDS / 60)
                )
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Super Admin MFA email delivery failed', [
                'user_id' => $user->id,
                'recipient' => $recipient,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Unable to send the Super Admin MFA verification code via email. Please verify your SMTP mail settings and try again.',
            ], 503);
        }

        RateLimiter::hit($sendThrottleKey, 600);

        $resolvedSystem = $systemInfo ?: $this->resolveSystemInfo($request->input('target_system'), $user);

        \Illuminate\Support\Facades\Cache::put(
            "super_admin_mfa:{$mfaToken}",
            [
                'user_id' => $user->id,
                'code_hash' => Hash::make($code),
                'ip' => (string) $request->ip(),
                'ua_hash' => hash('sha256', (string) $request->userAgent()),
                'attempts' => 0,
                'resend_count' => 0,
                'last_sent_at' => $nowTs,
                'expires_at' => $nowTs + self::MFA_TTL_SECONDS,
                'multi_role_selected' => $multiRoleSelected,
                'system_info' => $resolvedSystem,
            ],
            now()->addSeconds(self::MFA_TTL_SECONDS)
        );

        AuditLog::log('SUPER_ADMIN_MFA_SENT', 'users', $user->id, null, [
            'account_email' => $user->email,
            'mfa_recipient' => $recipient,
            'ip' => $request->ip(),
        ], $user->id);

        return response()->json([
            'requires_mfa' => true,
            'mfa_token' => $mfaToken,
            'masked_email' => $this->maskEmailAddress($recipient),
            'expires_in' => self::MFA_TTL_SECONDS,
            'resend_cooldown' => self::MFA_RESEND_COOLDOWN_SECONDS,
            'message' => 'A 6-digit security verification code has been sent to the designated Super Admin email.',
        ]);
    }

    public function verifySuperAdminMfa(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mfa_token' => ['required', 'string', 'min:32', 'max:128'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.regex' => 'Please enter a valid 6-digit numeric verification code.',
        ]);

        $token = $validated['mfa_token'];
        $cacheKey = "super_admin_mfa:{$token}";
        $cached = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if (!$cached || empty($cached['user_id']) || time() > (int) ($cached['expires_at'] ?? 0)) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Your MFA verification session has expired. Please sign in again to request a new code.',
            ], 422);
        }

        $currentUaHash = hash('sha256', (string) $request->userAgent());
        if (!hash_equals((string) ($cached['ua_hash'] ?? ''), $currentUaHash)) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            \App\Services\SecurityThreatService::recordThreat(
                $request,
                'SESSION_HIJACK',
                'critical',
                'Super Admin MFA token device/browser mismatch detected and invalidated.',
                ['is_red_alert' => true, 'status_code' => 403]
            );
            return response()->json([
                'message' => 'Security mismatch detected. Your MFA session has been invalidated. Please sign in again.',
            ], 403);
        }

        $attempts = (int) ($cached['attempts'] ?? 0);
        if ($attempts >= self::MFA_MAX_ATTEMPTS) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Maximum verification attempts exceeded. Please sign in again to receive a new code.',
            ], 429);
        }

        $user = User::find($cached['user_id']);
        if (!$user || !$user->is_active || !$user->isSuperAdmin()) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Super Administrator account is unavailable or inactive.',
            ], 403);
        }

        if (!Hash::check($validated['code'], (string) ($cached['code_hash'] ?? ''))) {
            $attempts++;
            $remaining = max(0, self::MFA_MAX_ATTEMPTS - $attempts);

            AuditLog::log('SUPER_ADMIN_MFA_FAILED', 'users', $user->id, null, [
                'email' => $user->email,
                'attempts' => $attempts,
                'ip' => $request->ip(),
            ], $user->id);

            if ($remaining <= 0) {
                \Illuminate\Support\Facades\Cache::forget($cacheKey);
                \App\Services\SecurityThreatService::recordThreat(
                    $request,
                    'BRUTE_FORCE',
                    'critical',
                    "Super Admin MFA verification locked after {$attempts} invalid code attempts.",
                    [
                        'is_red_alert' => true,
                        'user_email' => $user->email,
                        'status_code' => 429,
                    ]
                );
                return response()->json([
                    'message' => 'Too many incorrect verification codes. For security, this MFA session has been cancelled. Please sign in again.',
                    'attempts_left' => 0,
                    'expired' => true,
                ], 429);
            }

            $cached['attempts'] = $attempts;
            $ttlRemaining = max(1, (int) $cached['expires_at'] - time());
            \Illuminate\Support\Facades\Cache::put($cacheKey, $cached, now()->addSeconds($ttlRemaining));

            return response()->json([
                'message' => "Invalid verification code. ({$remaining} attempt" . ($remaining === 1 ? '' : 's') . " remaining)",
                'attempts_left' => $remaining,
            ], 422);
        }

        \Illuminate\Support\Facades\Cache::forget($cacheKey);

        $sysInfo = is_array($cached['system_info'] ?? null)
            ? $cached['system_info']
            : $this->resolveSystemInfo(null, $user);

        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->put('_client_fingerprint', $currentUaHash);
        $request->session()->put('_client_user_agent_preview', Str::limit((string) $request->userAgent(), 150));
        $request->session()->put('_active_system', $sysInfo['system_key']);

        AuditLog::log('SUPER_ADMIN_MFA_VERIFIED', 'users', $user->id, null, [
            'email' => $user->email,
            'mfa_recipient' => $this->getSuperAdminMfaRecipient(),
            'system_key' => $sysInfo['system_key'],
            'system_name' => $sysInfo['system_name'],
            'ip' => $request->ip(),
        ], $user->id);

        AuditLog::log('USER_LOGIN', 'users', $user->id, null, [
            'email' => $user->email,
            'role' => $user->role,
            'system_key' => $sysInfo['system_key'],
            'system_name' => $sysInfo['system_name'],
            'logged_in_at' => now()->timezone('Asia/Manila')->format('M d, Y, h:i:s A'),
            'mfa_verified' => true,
            'multi_role_selected' => !empty($cached['multi_role_selected']),
        ], $user->id);

        return response()->json([
            'message' => 'Super Admin MFA verified. Login successful.',
            'user' => $user->fresh()->load(['office', 'accountCodes', 'pnpkiSignature']),
            'csrf_token' => csrf_token(),
        ]);
    }

    public function resendSuperAdminMfa(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mfa_token' => ['required', 'string', 'min:32', 'max:128'],
        ]);

        $token = $validated['mfa_token'];
        $cacheKey = "super_admin_mfa:{$token}";
        $cached = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if (!$cached || empty($cached['user_id'])) {
            return response()->json([
                'message' => 'Your MFA session has expired. Please sign in again.',
            ], 422);
        }

        $currentUaHash = hash('sha256', (string) $request->userAgent());
        if (!hash_equals((string) ($cached['ua_hash'] ?? ''), $currentUaHash)) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Security mismatch detected. Please sign in again.',
            ], 403);
        }

        $resendCount = (int) ($cached['resend_count'] ?? 0);
        if ($resendCount >= self::MFA_MAX_RESENDS) {
            return response()->json([
                'message' => 'Maximum resend limit reached for this session. Please sign in again.',
            ], 429);
        }

        $elapsed = time() - (int) ($cached['last_sent_at'] ?? 0);
        if ($elapsed < self::MFA_RESEND_COOLDOWN_SECONDS) {
            $wait = self::MFA_RESEND_COOLDOWN_SECONDS - $elapsed;
            return response()->json([
                'message' => "Please wait {$wait} seconds before requesting another verification code.",
                'retry_after' => $wait,
            ], 429);
        }

        $user = User::find($cached['user_id']);
        if (!$user || !$user->is_active || !$user->isSuperAdmin()) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Super Administrator account is unavailable or inactive.',
            ], 403);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $recipient = $this->getSuperAdminMfaRecipient();
        $nowTs = time();

        try {
            \Illuminate\Support\Facades\Mail::to($recipient)->send(
                new \App\Mail\SuperAdminMfaCodeMail(
                    $code,
                    $user->email,
                    $user->name,
                    (string) $request->ip(),
                    (int) ceil(self::MFA_TTL_SECONDS / 60)
                )
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Super Admin MFA resend failed', [
                'user_id' => $user->id,
                'recipient' => $recipient,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Unable to resend the verification code via email. Please try again shortly.',
            ], 503);
        }

        $cached['code_hash'] = Hash::make($code);
        $cached['attempts'] = 0;
        $cached['resend_count'] = $resendCount + 1;
        $cached['last_sent_at'] = $nowTs;
        $cached['expires_at'] = $nowTs + self::MFA_TTL_SECONDS;

        \Illuminate\Support\Facades\Cache::put($cacheKey, $cached, now()->addSeconds(self::MFA_TTL_SECONDS));

        AuditLog::log('SUPER_ADMIN_MFA_RESENT', 'users', $user->id, null, [
            'account_email' => $user->email,
            'mfa_recipient' => $recipient,
            'resend_count' => $cached['resend_count'],
            'ip' => $request->ip(),
        ], $user->id);

        return response()->json([
            'message' => 'A new 6-digit verification code has been sent.',
            'masked_email' => $this->maskEmailAddress($recipient),
            'expires_in' => self::MFA_TTL_SECONDS,
            'resend_cooldown' => self::MFA_RESEND_COOLDOWN_SECONDS,
        ]);
    }

    protected function verifyTurnstile(Request $request): ?JsonResponse
    {

        if (!\App\Models\SystemSetting::isTurnstileEnabled()) {
            return null;
        }

        $secretKey = config('services.turnstile.secret_key');
        $token = trim((string) $request->input('cf_turnstile_response', ''));

        if ($request->has('cf_turnstile_response') && $token === '') {
            return response()->json([
                'message' => 'Please complete the Cloudflare security verification to confirm that you are human.',
                'errors' => ['cf_turnstile_response' => ['Security verification is required.']],
            ], 422);
        }

        if (app()->environment('testing') && !$request->has('cf_turnstile_response')) {
            return null;
        }

        if (!empty($secretKey)) {
            if ($token === '') {
                return response()->json([
                    'message' => 'Please complete the Cloudflare security verification to confirm that you are human.',
                    'errors' => ['cf_turnstile_response' => ['Security verification token is missing.']],
                ], 422);
            }

            if (app()->environment('testing') && str_starts_with($token, 'cf_turnstile_')) {
                return null;
            }

            try {
                $httpClient = app()->environment('local')
                    ? Http::withoutVerifying()->asForm()->timeout(8)
                    : Http::asForm()->timeout(8);

                $response = $httpClient->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                    'secret' => $secretKey,
                    'response' => $token,
                    'remoteip' => $request->ip(),
                ]);

                if (!$response->successful() || !$response->json('success')) {
                    return response()->json([
                        'message' => 'Cloudflare security verification failed or expired. Please verify again.',
                        'errors' => ['cf_turnstile_response' => ['Security verification failed.']],
                    ], 422);
                }
            } catch (\Throwable $e) {

                if (app()->environment('local', 'testing') && str_starts_with($token, 'cf_turnstile_')) {
                    return null;
                }

                return response()->json([
                    'message' => 'Unable to verify Cloudflare security challenge at this time. Please check your connection and try again.',
                ], 422);
            }
        }

        return null;
    }

    public function login(Request $request): JsonResponse
    {

        if ($request->filled('role_selection_token') && $request->filled('selected_role')) {
            $token = (string) $request->input('role_selection_token');
            $selectedRole = trim((string) $request->input('selected_role'));
            $cached = \Illuminate\Support\Facades\Cache::get("role_select:{$token}");

            if (!$cached || empty($cached['user_id'])) {
                return response()->json([
                    'message' => 'Your role selection session expired. Please sign in again.',
                ], 422);
            }

            $user = User::find($cached['user_id']);
            if (!$user || !$user->is_active) {
                return response()->json([
                    'message' => 'Account is no longer active. Please contact the Administrator.',
                ], 403);
            }

            if (!$user->hasAssignedRole($selectedRole)) {
                return response()->json([
                    'message' => 'Selected role is not assigned to this account.',
                ], 403);
            }

            \Illuminate\Support\Facades\Cache::forget("role_select:{$token}");

            if ($user->role !== $selectedRole) {
                $user->role = $selectedRole;
                $user->save();
            }

            $sysInfo = $this->resolveSystemInfo($request->input('target_system') ?? ($cached['target_system'] ?? null), $user);

            if ($user->isSuperAdmin()) {
                return $this->initiateSuperAdminMfa($request, $user, true, $sysInfo);
            }

            Auth::login($user);
            $request->session()->regenerate();
            $request->session()->put('_client_fingerprint', hash('sha256', (string) $request->userAgent()));
            $request->session()->put('_client_user_agent_preview', Str::limit((string) $request->userAgent(), 150));
            $request->session()->put('_active_system', $sysInfo['system_key']);

            AuditLog::log('USER_LOGIN', 'users', $user->id, null, [
                'email' => $user->email,
                'role' => $user->role,
                'system_key' => $sysInfo['system_key'],
                'system_name' => $sysInfo['system_name'],
                'logged_in_at' => now()->timezone('Asia/Manila')->format('M d, Y, h:i:s A'),
                'multi_role_selected' => true,
            ], $user->id);

            return response()->json([
                'message' => 'Login successful.',
                'user' => $user->fresh()->load(['office', 'accountCodes', 'pnpkiSignature']),
                'csrf_token' => csrf_token(),
            ]);
        }

        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'selected_role' => 'nullable|string',
        ]);

        if ($turnstileError = $this->verifyTurnstile($request)) {
            return $turnstileError;
        }

        $throttleKey = 'login_attempt|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            \App\Services\SecurityThreatService::recordThreat(
                $request,
                'BRUTE_FORCE',
                'critical',
                "Brute-force login lockout triggered after 5 failed attempts (retry in {$seconds}s).",
                [
                    'is_red_alert' => true,
                    'user_email' => $request->input('email'),
                    'status_code' => 429,
                    'payload_summary' => ['retry_after_seconds' => $seconds],
                ]
            );

            AuditLog::log(
                'LOGIN_THROTTLED',
                'users',
                null,
                null,
                ['email' => $request->input('email'), 'ip' => $request->ip(), 'retry_after_seconds' => $seconds]
            );

            return response()->json([
                'message' => "Too many login attempts from this device. You have exceeded the 5-attempt limit. Please wait {$seconds} seconds before trying again.",
                'retry_after' => $seconds,
            ], 429);
        }

        $cleanEmail = trim(strtolower($request->email));
        $user = User::whereRaw('LOWER(email) = ?', [$cleanEmail])->first();

        if (!$user || !Hash::check($request->password, $user->password)) {

            RateLimiter::hit($throttleKey, 60);

            $attemptsLeft = RateLimiter::remaining($throttleKey, 5);

            $warning = $attemptsLeft > 0
                ? " ({$attemptsLeft} attempt" . ($attemptsLeft === 1 ? '' : 's') . " remaining)"
                : " (You have reached the maximum 5 attempts.)";

            return response()->json([
                'message' => 'The provided credentials do not match our records.' . $warning,
                'attempts_left' => $attemptsLeft,
            ], 422);
        }

        if (!$user->is_active) {
            if ($user->approval_status === 'rejected') {
                $reasonText = $user->rejection_reason ? " Reason: {$user->rejection_reason}" : "";
                return response()->json([
                    'message' => "Your registration request has been rejected by the Administrator.{$reasonText} Please coordinate with the Office of the Provincial Procurement Management Officer for assistance."
                ], 403);
            }

            return response()->json([
                'message' => 'Your account is pending approval. Your account will remain pending until you submit a User Access Form to the Office of the Provincial Procurement Management Officer for approval.'
            ], 403);
        }

        RateLimiter::clear($throttleKey);

        $availableRoles = $user->available_roles;
        if (count($availableRoles) > 1) {
            $requestedRole = trim((string) $request->input('selected_role', ''));
            if ($requestedRole === '') {
                $selectionToken = Str::random(48);
                \Illuminate\Support\Facades\Cache::put(
                    "role_select:{$selectionToken}",
                    ['user_id' => $user->id, 'ip' => $request->ip(), 'target_system' => $request->input('target_system')],
                    now()->addMinutes(5)
                );

                return response()->json([
                    'requires_role_selection' => true,
                    'role_selection_token' => $selectionToken,
                    'available_roles' => $availableRoles,
                    'current_role' => $user->role,
                    'user_preview' => [
                        'name' => $user->name,
                        'email' => $user->email,
                        'designation' => $user->designation,
                    ],
                    'message' => 'This account has multiple assigned roles. Please select which role you want to log in as.',
                ]);
            }

            if (!$user->hasAssignedRole($requestedRole)) {
                return response()->json([
                    'message' => 'Selected role is not assigned to this account.',
                ], 403);
            }

            if ($user->role !== $requestedRole) {
                $user->role = $requestedRole;
                $user->save();
            }
        }

        $sysInfo = $this->resolveSystemInfo($request->input('target_system'), $user);

        if ($user->isSuperAdmin()) {
            return $this->initiateSuperAdminMfa($request, $user, false, $sysInfo);
        }

        Auth::login($user);
        $request->session()->regenerate();

        $request->session()->put('_client_fingerprint', hash('sha256', (string) $request->userAgent()));
        $request->session()->put('_client_user_agent_preview', Str::limit((string) $request->userAgent(), 150));
        $request->session()->put('_active_system', $sysInfo['system_key']);

        AuditLog::log('USER_LOGIN', 'users', $user->id, null, [
            'email' => $user->email,
            'role' => $user->role,
            'system_key' => $sysInfo['system_key'],
            'system_name' => $sysInfo['system_name'],
            'logged_in_at' => now()->timezone('Asia/Manila')->format('M d, Y, h:i:s A'),
        ], $user->id);

        return response()->json([
            'message' => 'Login successful.',
            'user' => $user->load(['office', 'accountCodes', 'pnpkiSignature']),
            'csrf_token' => csrf_token(),
        ]);
    }

    public function switchRole(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'role' => 'required|string',
        ]);

        $targetRole = trim($validated['role']);
        if (!$user->hasAssignedRole($targetRole)) {
            return response()->json([
                'message' => 'Unauthorized. That role is not assigned to your account.',
            ], 403);
        }

        $oldRole = $user->role;
        $user->role = $targetRole;
        $user->save();

        AuditLog::log('USER_ROLE_SWITCHED', 'users', $user->id, ['role' => $oldRole], ['role' => $targetRole], $user->id);

        return response()->json([
            'message' => 'Role perspective switched successfully.',
            'user' => $user->fresh()->load(['office', 'accountCodes', 'pnpkiSignature']),
        ]);
    }

    protected function storePnpkiProofPdf(?UploadedFile $uploadedPdf): array
    {
        if (!$uploadedPdf) {
            return ['path' => null, 'original_name' => null, 'error' => null];
        }

        $clientExt = strtolower($uploadedPdf->getClientOriginalExtension());
        if ($clientExt !== 'pdf') {
            return [
                'path' => null,
                'original_name' => null,
                'error' => response()->json([
                    'message' => 'Security Error: Only official PDF files (.pdf) are accepted for the PNPKI Proof of Registration.',
                    'errors' => ['pnpki_proof_pdf' => ['Only official PDF files (.pdf) are allowed.']],
                ], 422),
            ];
        }

        $clientName = $uploadedPdf->getClientOriginalName();
        if (preg_match('/\.(php|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.pdf$/i', $clientName)) {
            return [
                'path' => null,
                'original_name' => null,
                'error' => response()->json([
                    'message' => 'Security Error: Suspicious disguised multi-extension filename detected on PNPKI Proof PDF.',
                    'errors' => ['pnpki_proof_pdf' => ['Suspicious disguised multi-extension filename detected.']],
                ], 422),
            ];
        }

        $handle = fopen($uploadedPdf->getRealPath(), 'rb');
        $header = fread($handle, 5);
        fclose($handle);
        if ($header !== '%PDF-') {
            return [
                'path' => null,
                'original_name' => null,
                'error' => response()->json([
                    'message' => 'Security Error: Invalid file content. The uploaded PNPKI Proof document does not have a genuine PDF header.',
                    'errors' => ['pnpki_proof_pdf' => ['Invalid PDF file header.']],
                ], 422),
            ];
        }

        $sampleContent = file_get_contents($uploadedPdf->getRealPath(), false, null, 0, 50000);
        if (preg_match('/\/Launch|\/EmbeddedFiles|\/JavaScript|\/JS\s*\(/i', $sampleContent)) {
            return [
                'path' => null,
                'original_name' => null,
                'error' => response()->json([
                    'message' => 'Security Error: PNPKI Proof PDF contains active executable scripts or launch actions, which are restricted for security.',
                    'errors' => ['pnpki_proof_pdf' => ['Active scripts or launch actions are not permitted.']],
                ], 422),
            ];
        }

        $proofFilename = 'pnpki_' . Str::uuid() . '.pdf';
        $proofPath = $uploadedPdf->storeAs('pnpki_proofs', $proofFilename, 'local');

        return [
            'path' => $proofPath,
            'original_name' => Str::limit($clientName, 180, ''),
            'error' => null,
        ];
    }

    public function register(Request $request): JsonResponse
    {
        if ($turnstileError = $this->verifyTurnstile($request)) {
            return $turnstileError;
        }

        $signatureType = $request->input('signature_type', 'optional');
        if (!in_array($signatureType, ['pnpki', 'optional'], true) || !\App\Models\SystemSetting::isPnpkiEnabled()) {
            $signatureType = 'optional';
        }

        $allowedRegistrationRoles = ['end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'authorized_staff', 'pacco', 'admin', 'pgso', 'presentative_staff'];

        $rawRoles = $request->input('roles');
        if (is_string($rawRoles)) {
            $decodedRoles = json_decode($rawRoles, true);
            $rawRoles = is_array($decodedRoles) ? $decodedRoles : array_filter(array_map('trim', explode(',', $rawRoles)));
        }
        if (!is_array($rawRoles) || empty($rawRoles)) {
            $singleRole = trim((string) $request->input('role', ''));
            $rawRoles = $singleRole !== '' ? [$singleRole] : [];
        }
        $normalizedRoles = array_values(array_unique(array_filter(array_map(fn ($r) => trim((string) $r), $rawRoles))));
        $request->merge([
            'roles' => $normalizedRoles,
            'role' => $normalizedRoles[0] ?? $request->input('role', ''),
        ]);

        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'role' => 'required|string|in:' . implode(',', $allowedRegistrationRoles),
            'roles' => 'required|array|min:1',
            'roles.*' => 'required|string|in:' . implode(',', $allowedRegistrationRoles),
            'phone_number' => 'required|string|max:30',
            'address' => 'required|string|max:500',
            'password' => 'required|string|min:6|confirmed',
            'office_id' => 'required|exists:offices,id',
            'designation' => 'required|string|max:255',
            'signature' => 'required|string',
            'signature_type' => 'nullable|string|in:pnpki,optional',
            'signature_capture_method' => 'nullable|string|in:drawn,uploaded',
        ];

        if ($signatureType === 'pnpki') {
            $rules['pnpki_expiration_date'] = 'required|date';
            $rules['pnpki_proof_pdf'] = 'required|file|mimes:pdf|max:5120';
        } else {
            $rules['pnpki_expiration_date'] = 'nullable|date';
            $rules['pnpki_proof_pdf'] = 'nullable|file|mimes:pdf|max:5120';
        }

        $needsAuthLetter = count(array_intersect($normalizedRoles, ['authorized_staff', 'presentative_staff'])) > 0;
        if ($needsAuthLetter) {
            $rules['authorization_letter'] = 'required|file|mimes:pdf|max:5120';
        }

        $rawAccountCodeIds = $request->input('account_code_ids');
        if (is_string($rawAccountCodeIds)) {
            $decoded = json_decode($rawAccountCodeIds, true);
            $rawAccountCodeIds = is_array($decoded) ? $decoded : array_filter(array_map('intval', explode(',', $rawAccountCodeIds)));
            $request->merge(['account_code_ids' => $rawAccountCodeIds]);
        }
        if (!is_array($rawAccountCodeIds)) {
            $rawAccountCodeIds = [];
        }

        if (in_array('twg', $normalizedRoles, true)) {
            $rules['account_code_ids'] = 'nullable|array';
            $rules['account_code_ids.*'] = 'integer|exists:account_codes,id';
        }

        $validated = $request->validate($rules);

        $authorizationLetterPath = null;
        if ($needsAuthLetter && $request->hasFile('authorization_letter')) {
            $uploadedLetter = $request->file('authorization_letter');

            $clientExt = strtolower($uploadedLetter->getClientOriginalExtension());
            if ($clientExt !== 'pdf') {
                return response()->json([
                    'message' => 'Security Error: Only official PDF files (.pdf) are accepted for the Authorization Letter.',
                    'errors' => ['authorization_letter' => ['Only official PDF files (.pdf) are allowed.']]
                ], 422);
            }

            $clientName = $uploadedLetter->getClientOriginalName();
            if (preg_match('/\.(php|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.pdf$/i', $clientName)) {
                return response()->json([
                    'message' => 'Security Error: Suspicious disguised multi-extension filename detected.',
                    'errors' => ['authorization_letter' => ['Suspicious disguised multi-extension filename detected.']]
                ], 422);
            }

            $handle = fopen($uploadedLetter->getRealPath(), 'rb');
            $header = fread($handle, 5);
            fclose($handle);
            if ($header !== '%PDF-') {
                return response()->json([
                    'message' => 'Security Error: Invalid file content. The uploaded document does not have a genuine PDF header.',
                    'errors' => ['authorization_letter' => ['Invalid PDF file header.']]
                ], 422);
            }

            $sampleContent = file_get_contents($uploadedLetter->getRealPath(), false, null, 0, 50000);
            if (preg_match('/\/Launch|\/EmbeddedFiles|\/JavaScript|\/JS\s*\(/i', $sampleContent)) {
                return response()->json([
                    'message' => 'Security Error: PDF contains active executable scripts or launch actions, which are restricted for security.',
                    'errors' => ['authorization_letter' => ['Active scripts or launch actions are not permitted.']]
                ], 422);
            }

            $letterFilename = 'auth_' . Str::uuid() . '.pdf';

            $authorizationLetterPath = $uploadedLetter->storeAs('authorization_letter', $letterFilename, 'local');
        }

        $pnpkiProofPath = null;
        $pnpkiProofOriginalName = null;
        if ($request->hasFile('pnpki_proof_pdf')) {
            $proofResult = $this->storePnpkiProofPdf($request->file('pnpki_proof_pdf'));
            if ($proofResult['error']) {
                return $proofResult['error'];
            }
            $pnpkiProofPath = $proofResult['path'];
            $pnpkiProofOriginalName = $proofResult['original_name'];
        }

        $signaturePath = null;
        if (!empty($validated['signature'])) {
            $sigData = $validated['signature'];

            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]);
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {
                    $filename = 'sig_' . Str::uuid() . '.' . ($type === 'jpeg' ? 'jpg' : 'png');

                    $signaturePath = 'signatures/' . $filename;
                    Storage::disk('local')->put($signaturePath, $decoded);
                }
            }
        }

        $accessibleSystems = $request->input('accessible_systems');
        if (is_string($accessibleSystems)) {
            $decoded = json_decode($accessibleSystems, true);
            if (is_array($decoded)) {
                $accessibleSystems = $decoded;
            } else {
                $accessibleSystems = array_filter(array_map('trim', explode(',', $accessibleSystems)));
            }
        }
        if (!is_array($accessibleSystems) || empty($accessibleSystems)) {
            $accessibleSystems = ['/eprocrementppmpapp'];
        }
        $accessibleSystems = array_values(array_unique($accessibleSystems));

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'address' => $validated['address'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['roles'][0] ?? ($validated['role'] ?? 'end_user'),
            'roles' => array_values(array_unique($validated['roles'] ?? [$validated['role'] ?? 'end_user'])),
            'office_id' => $validated['office_id'],
            'designation' => $validated['designation'] ?? null,
            'signature_path' => $signaturePath,
            'authorization_letter_path' => $authorizationLetterPath,
            'is_active' => false,
            'approval_status' => 'pending',
            'accessible_systems' => $accessibleSystems,
        ]);

        $captureMethod = in_array($request->input('signature_capture_method'), ['drawn', 'uploaded'], true)
            ? $request->input('signature_capture_method')
            : 'drawn';

        $user->pnpkiSignature()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'signature_type' => $signatureType,
                'expiration_date' => $signatureType === 'pnpki' ? ($validated['pnpki_expiration_date'] ?? null) : null,
                'proof_pdf_path' => $signatureType === 'pnpki' ? $pnpkiProofPath : null,
                'proof_original_name' => $signatureType === 'pnpki' ? $pnpkiProofOriginalName : null,
                'signature_image_path' => $signaturePath,
                'capture_method' => $captureMethod,
            ]
        );

        if ($user->hasAssignedRole('twg') && !empty($rawAccountCodeIds)) {
            $user->accountCodes()->sync($rawAccountCodeIds);
        }

        AuditLog::log(
            'USER_REGISTERED_PENDING',
            'users',
            $user->id,
            null,
            [
                'email' => $user->email,
                'name' => $user->name,
                'office_id' => $user->office_id,
                'role' => $user->role,
                'signature_type' => $signatureType,
                'pnpki_expiration_date' => $signatureType === 'pnpki' ? ($validated['pnpki_expiration_date'] ?? null) : null,
                'is_active' => false,
            ],
            $user->id
        );

        $admins = User::withAnyRole(['admin', 'super_admin'])->where('is_active', true)->get();
        foreach ($admins as $admin) {
            SystemNotification::notify(
                $admin->id,
                'New User Registration',
                "{$user->name} ({$user->designation}) registered and is awaiting approval.",
                null,
                'info'
            );
        }

        return response()->json([
            'message' => 'Your account is pending approval. Your account will remain pending until you submit a User Access Form to the Office of the Provincial Procurement Management Officer for approval.',
            'status' => 'pending',
            'user' => $user->load(['office', 'accountCodes', 'pnpkiSignature']),
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = Auth::user();

        if ($user) {
            $logoutSystemRaw = $request->input('system') ?: $request->session()->get('_active_system');
            $sysInfo = $this->resolveSystemInfo($logoutSystemRaw, $user);
            AuditLog::log('USER_LOGOUT', 'users', $user->id, null, [
                'email' => $user->email,
                'role' => $user->role,
                'system_key' => $sysInfo['system_key'],
                'system_name' => $sysInfo['system_name'],
                'logged_out_at' => now()->timezone('Asia/Manila')->format('M d, Y, h:i:s A'),
            ], $user->id);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out successfully.',
            'csrf_token' => csrf_token(),
        ])->header('Clear-Site-Data', '"cache"');
    }

    public function csrfToken(Request $request): JsonResponse
    {
        return response()->json([
            'csrf_token' => csrf_token(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['office', 'pnpkiSignature']);

        return response()->json([
            'user' => $user,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone_number' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:500',
            'designation' => 'nullable|string|max:255',
            'signature' => 'nullable|string',
            'signature_type' => 'nullable|string|in:pnpki,optional',
            'pnpki_expiration_date' => 'nullable|date',
            'pnpki_proof_pdf' => 'nullable|file|mimes:pdf|max:5120',
            'signature_capture_method' => 'nullable|string|in:drawn,uploaded',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'phone_number' => $validated['phone_number'] ?? null,
            'address' => $validated['address'] ?? null,
            'designation' => $validated['designation'] ?? null,
        ];

        $pnpkiSystemEnabled = \App\Models\SystemSetting::isPnpkiEnabled();
        $existingPnpki = $user->pnpkiSignature;
        $isCurrentlyUsingActivePnpki = $pnpkiSystemEnabled
            && $existingPnpki
            && $existingPnpki->signature_type === 'pnpki'
            && !$existingPnpki->is_expired;

        if ($isCurrentlyUsingActivePnpki && (!empty($validated['signature']) || $request->hasFile('pnpki_proof_pdf'))) {
            return response()->json([
                'message' => 'Your active PNPKI Digital E-Signature cannot be edited from your profile. Only the Super Administrator can edit it in User Management.',
            ], 403);
        }

        if (!$isCurrentlyUsingActivePnpki && !empty($validated['signature'])) {
            $sigData = $validated['signature'];
            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]);
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {

                    if ($user->signature_path && Storage::disk('local')->exists($user->signature_path)) {
                        Storage::disk('local')->delete($user->signature_path);
                    }

                    $filename = 'sig_' . Str::uuid() . '.' . ($type === 'jpeg' ? 'jpg' : 'png');
                    $signaturePath = 'signatures/' . $filename;
                    Storage::disk('local')->put($signaturePath, $decoded);
                    $updateData['signature_path'] = $signaturePath;
                }
            }
        }

        if (!$isCurrentlyUsingActivePnpki && ($request->filled('signature_type') || !empty($updateData['signature_path']) || $request->hasFile('pnpki_proof_pdf'))) {
            $existingPnpki = $user->pnpkiSignature;
            $sigType = $pnpkiSystemEnabled
                ? $request->input('signature_type', $existingPnpki?->signature_type ?? 'optional')
                : 'optional';

            $prevExpDate = $existingPnpki?->previous_expiration_date?->format('Y-m-d');
            $prevProofPath = $existingPnpki?->previous_proof_pdf_path;
            $prevProofName = $existingPnpki?->previous_proof_original_name;
            $renewalHistory = is_array($existingPnpki?->renewal_history) ? $existingPnpki->renewal_history : [];
            $renewedAt = $existingPnpki?->renewed_at;
            $renewalCount = (int) ($existingPnpki?->renewal_count ?? 0);

            $currentExpDate = $existingPnpki?->expiration_date?->format('Y-m-d');
            $proofPath = $existingPnpki?->proof_pdf_path;
            $proofOriginalName = $existingPnpki?->proof_original_name;

            $newExpInput = $request->input('pnpki_expiration_date');
            $isRenewing = $sigType === 'pnpki' && (
                $request->boolean('is_renewal') ||
                ($existingPnpki && $currentExpDate && $newExpInput && $newExpInput !== $currentExpDate)
            );

            if ($isRenewing && $existingPnpki && $currentExpDate && !$user->isSuperAdmin()) {

                $pendingProofPath = $existingPnpki->pending_proof_pdf_path;
                $pendingProofName = $existingPnpki->pending_proof_original_name;
                if ($request->hasFile('pnpki_proof_pdf')) {
                    $proofResult = $this->storePnpkiProofPdf($request->file('pnpki_proof_pdf'));
                    if ($proofResult['error']) {
                        return $proofResult['error'];
                    }
                    $pendingProofPath = $proofResult['path'];
                    $pendingProofName = $proofResult['original_name'];
                }

                $pendingSigPath = $updateData['signature_path'] ?? $existingPnpki->pending_signature_image_path;

                unset($updateData['signature_path']);

                $user->pnpkiSignature()->updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'renewal_status' => 'pending',
                        'pending_expiration_date' => $newExpInput ?: $existingPnpki->pending_expiration_date?->format('Y-m-d'),
                        'pending_proof_pdf_path' => $pendingProofPath,
                        'pending_proof_original_name' => $pendingProofName,
                        'pending_signature_image_path' => $pendingSigPath,
                        'renewal_submitted_at' => now(),
                        'renewal_rejection_reason' => null,
                    ]
                );

                $superAdmins = User::withRole('super_admin')->where('is_active', true)->get();
                foreach ($superAdmins as $sa) {
                    SystemNotification::notify(
                        $sa->id,
                        'PNPKI E-Signature Renewal Pending Approval',
                        "{$user->name} submitted a PNPKI Digital E-Signature renewal request (New Expiration: {$newExpInput}) and is awaiting Super Admin approval.",
                        null,
                        'warning'
                    );
                }
            } else {
                if ($request->hasFile('pnpki_proof_pdf')) {
                    $proofResult = $this->storePnpkiProofPdf($request->file('pnpki_proof_pdf'));
                    if ($proofResult['error']) {
                        return $proofResult['error'];
                    }

                    if ($proofPath) {
                        $prevProofPath = $proofPath;
                        $prevProofName = $proofOriginalName;
                    }
                    $proofPath = $proofResult['path'];
                    $proofOriginalName = $proofResult['original_name'];
                }

                if ($isRenewing && $existingPnpki && $currentExpDate) {
                    $prevExpDate = $currentExpDate;
                    if ($existingPnpki->proof_pdf_path && !$prevProofPath) {
                        $prevProofPath = $existingPnpki->proof_pdf_path;
                        $prevProofName = $existingPnpki->proof_original_name;
                    }
                    $renewalHistory[] = [
                        'expiration_date' => $currentExpDate,
                        'proof_pdf_path' => $existingPnpki->proof_pdf_path,
                        'proof_original_name' => $existingPnpki->proof_original_name,
                        'archived_at' => now()->toIso8601String(),
                    ];
                    $renewedAt = now();
                    $renewalCount++;
                }

                $finalExpDate = $sigType === 'pnpki'
                    ? ($newExpInput ?: $currentExpDate)
                    : $currentExpDate;

                $user->pnpkiSignature()->updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'signature_type' => $sigType,
                        'expiration_date' => $finalExpDate,
                        'previous_expiration_date' => $prevExpDate,
                        'proof_pdf_path' => $proofPath,
                        'proof_original_name' => $proofOriginalName,
                        'previous_proof_pdf_path' => $prevProofPath,
                        'previous_proof_original_name' => $prevProofName,
                        'signature_image_path' => $updateData['signature_path'] ?? $user->signature_path,
                        'capture_method' => $request->input('signature_capture_method', $existingPnpki?->capture_method ?? 'drawn'),
                        'renewal_history' => $renewalHistory,
                        'renewed_at' => $renewedAt,
                        'renewal_count' => $renewalCount,
                    ]
                );
            }
        }

        if ($request->hasFile('profile_photo')) {
            $request->validate([
                'profile_photo' => 'image|mimes:jpeg,png,jpg|max:5120',
            ]);
            $photoPath = $this->handleProfilePhotoUpload($user, $request->file('profile_photo'));
            $updateData['profile_photo_path'] = $photoPath;
        } elseif ($request->input('remove_photo') === true || $request->input('remove_photo') === '1') {
            if ($user->profile_photo_path && Storage::disk('local')->exists($user->profile_photo_path)) {
                Storage::disk('local')->delete($user->profile_photo_path);
            }
            $updateData['profile_photo_path'] = null;
        }

        $user->update($updateData);

        AuditLog::log(
            'USER_PROFILE_UPDATED',
            'users',
            $user->id,
            null,
            ['updated_fields' => array_keys($updateData)],
            $user->id
        );

        return response()->json([
            'message' => 'Profile details updated successfully.',
            'user' => $user->fresh(['office', 'pnpkiSignature']),
        ]);
    }

    public function renewPnpkiSignature(Request $request): JsonResponse
    {
        if (!\App\Models\SystemSetting::isPnpkiEnabled()) {
            return response()->json([
                'message' => 'PNPKI Digital E-Signature is currently disabled by the Super Administrator. All users are using the Optional Digital E-Signature.',
            ], 403);
        }

        $user = $request->user();

        $validated = $request->validate([
            'pnpki_expiration_date' => 'required|date|after_or_equal:today',
            'pnpki_proof_pdf' => 'required|file|mimes:pdf|max:5120',
            'signature' => 'nullable|string',
            'signature_capture_method' => 'nullable|string|in:drawn,uploaded',
        ]);

        $proofResult = $this->storePnpkiProofPdf($request->file('pnpki_proof_pdf'));
        if ($proofResult['error']) {
            return $proofResult['error'];
        }

        $pendingSignaturePath = null;
        if (!empty($validated['signature'])) {
            $sigData = $validated['signature'];
            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]);
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {
                    $filename = 'sig_pending_' . Str::uuid() . '.' . ($type === 'jpeg' ? 'jpg' : 'png');
                    $pendingSignaturePath = 'signatures/' . $filename;
                    Storage::disk('local')->put($pendingSignaturePath, $decoded);
                }
            }
        }

        $existing = $user->pnpkiSignature;
        $oldExpDate = $existing?->expiration_date?->format('Y-m-d');
        $oldProofName = $existing?->proof_original_name;

        $user->pnpkiSignature()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'signature_type' => $existing?->signature_type ?? 'pnpki',
                'expiration_date' => $oldExpDate,
                'proof_pdf_path' => $existing?->proof_pdf_path,
                'proof_original_name' => $oldProofName,
                'signature_image_path' => $existing?->signature_image_path ?? $user->signature_path,
                'capture_method' => $validated['signature_capture_method'] ?? ($existing?->capture_method ?? 'drawn'),
                'renewal_status' => 'pending',
                'pending_expiration_date' => $validated['pnpki_expiration_date'],
                'pending_proof_pdf_path' => $proofResult['path'],
                'pending_proof_original_name' => $proofResult['original_name'],
                'pending_signature_image_path' => $pendingSignaturePath,
                'renewal_submitted_at' => now(),
                'renewal_rejection_reason' => null,
            ]
        );

        AuditLog::log(
            'USER_PNPKI_RENEWAL_SUBMITTED_PENDING',
            'pnpki_signatures',
            $user->id,
            ['current_expiration_date' => $oldExpDate, 'current_proof_original_name' => $oldProofName],
            ['pending_expiration_date' => $validated['pnpki_expiration_date'], 'pending_proof_original_name' => $proofResult['original_name']],
            $user->id
        );

        $superAdmins = User::withRole('super_admin')->where('is_active', true)->get();
        foreach ($superAdmins as $sa) {
            SystemNotification::notify(
                $sa->id,
                'PNPKI E-Signature Renewal Pending Approval',
                "{$user->name} submitted a PNPKI Digital E-Signature renewal request (New Expiration: {$validated['pnpki_expiration_date']}) and is awaiting Super Admin approval.",
                null,
                'warning'
            );
        }

        SystemNotification::notify(
            $user->id,
            'PNPKI Renewal Submitted for Approval',
            "Your PNPKI Digital E-Signature renewal request (New Expiration Date: {$validated['pnpki_expiration_date']}) has been submitted and is awaiting approval by the Super Administrator.",
            null,
            'info'
        );

        return response()->json([
            'message' => 'Your PNPKI Digital E-Signature renewal request has been submitted and is awaiting approval from the Super Administrator.',
            'user' => $user->fresh(['office', 'pnpkiSignature']),
        ]);
    }

    public function useOptionalSignature(Request $request): JsonResponse
    {
        $user = $request->user();
        $existing = $user->pnpkiSignature;

        $user->pnpkiSignature()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'signature_type' => 'optional',
                'expiration_date' => $existing?->expiration_date?->format('Y-m-d'),
                'previous_expiration_date' => $existing?->previous_expiration_date?->format('Y-m-d'),
                'proof_pdf_path' => $existing?->proof_pdf_path,
                'proof_original_name' => $existing?->proof_original_name,
                'previous_proof_pdf_path' => $existing?->previous_proof_pdf_path,
                'previous_proof_original_name' => $existing?->previous_proof_original_name,
                'signature_image_path' => $user->signature_path,
                'capture_method' => $existing?->capture_method ?? 'drawn',
                'renewal_history' => $existing?->renewal_history ?? [],
                'renewed_at' => $existing?->renewed_at,
                'renewal_count' => (int) ($existing?->renewal_count ?? 0),
            ]
        );

        return response()->json([
            'message' => 'Switched to Optional Digital Signature. Your previous PNPKI expiration date and proof of registration remain stored on file.',
            'user' => $user->fresh(['office', 'pnpkiSignature']),
        ]);
    }

    protected function handleProfilePhotoUpload(User $user, UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['jpg', 'jpeg', 'png'], true)) {
            throw new \InvalidArgumentException('Only JPEG and PNG images are allowed.');
        }

        $realPath = $file->getRealPath();
        $imageInfo = @getimagesize($realPath);
        if (!$imageInfo || !in_array($imageInfo[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
            throw new \InvalidArgumentException('Uploaded file is not a valid JPEG or PNG image.');
        }

        $baseName = preg_replace('/[^a-z0-9]/', '', strtolower($user->name));
        if (empty($baseName)) {
            $baseName = 'user' . $user->id;
        }

        $cleanExt = ($extension === 'jpeg' || $extension === 'jpg') ? 'jpg' : 'png';
        $filename = "{$baseName}.{$cleanExt}";

        $collision = User::where('id', '!=', $user->id)
            ->where('profile_photo_path', 'profile/' . $filename)
            ->exists();
        if ($collision) {
            $filename = "{$baseName}_{$user->id}.{$cleanExt}";
        }

        if ($user->profile_photo_path && Storage::disk('local')->exists($user->profile_photo_path)) {
            Storage::disk('local')->delete($user->profile_photo_path);
        }

        if (!Storage::disk('local')->exists('profile')) {
            Storage::disk('local')->makeDirectory('profile');
        }

        $photoPath = 'profile/' . $filename;
        Storage::disk('local')->putFileAs('profile', $file, $filename);

        return $photoPath;
    }

    public function updateProfilePhoto(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'profile_photo' => 'required|image|mimes:jpeg,png,jpg|max:5120',
        ]);

        try {
            $file = $request->file('profile_photo');
            $photoPath = $this->handleProfilePhotoUpload($user, $file);
            $user->update(['profile_photo_path' => $photoPath]);

            AuditLog::log(
                'USER_PROFILE_PHOTO_UPDATED',
                'users',
                $user->id,
                null,
                ['profile_photo_path' => $photoPath],
                $user->id
            );

            return response()->json([
                'message' => 'Profile photo uploaded successfully.',
                'user' => $user->fresh(['office']),
                'profile_photo_url' => '/api/users/' . User::encryptId((int) $user->id) . '/avatar',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function removeProfilePhoto(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->profile_photo_path && Storage::disk('local')->exists($user->profile_photo_path)) {
            Storage::disk('local')->delete($user->profile_photo_path);
        }

        $user->update(['profile_photo_path' => null]);

        AuditLog::log(
            'USER_PROFILE_PHOTO_REMOVED',
            'users',
            $user->id,
            null,
            [],
            $user->id
        );

        return response()->json([
            'message' => 'Profile photo removed.',
            'user' => $user->fresh(['office']),
        ]);
    }

    public function getProfilePhoto(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $user = $request->user();

        if (!$user->profile_photo_path || !Storage::disk('local')->exists($user->profile_photo_path)) {
            return response()->json(['message' => 'No profile photo found.'], 404);
        }

        $fullPath = Storage::disk('local')->path($user->profile_photo_path);
        $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
        $mime = $ext === 'png' ? 'image/png' : 'image/jpeg';

        return response()->file($fullPath, [
            'Content-Type' => $mime,
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function getSignature(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $user = $request->user();

        if (!$user->signature_path || !Storage::disk('local')->exists($user->signature_path)) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        $fullPath = Storage::disk('local')->path($user->signature_path);

        return response()->file($fullPath, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
