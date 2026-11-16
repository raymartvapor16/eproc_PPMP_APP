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
    /**
     * Verify Cloudflare Turnstile Security Token via Cloudflare's server-side siteverify API.
     * The Secret Key is kept strictly on the backend and never exposed to the client.
     */
    protected function verifyTurnstile(Request $request): ?JsonResponse
    {
        // If Super Admin disabled Cloudflare Turnstile verification in System Settings, bypass check
        if (!\App\Models\SystemSetting::isTurnstileEnabled()) {
            return null;
        }

        $secretKey = config('services.turnstile.secret_key');
        $token = trim((string) $request->input('cf_turnstile_response', ''));

        // If client explicitly sent an empty cf_turnstile_response field, reject it
        if ($request->has('cf_turnstile_response') && $token === '') {
            return response()->json([
                'message' => 'Please complete the Cloudflare security verification to confirm that you are human.',
                'errors' => ['cf_turnstile_response' => ['Security verification is required.']],
            ], 422);
        }

        // In automated PHPUnit test suites where no cf_turnstile_response is sent, allow existing feature tests
        if (app()->environment('testing') && !$request->has('cf_turnstile_response')) {
            return null;
        }

        // When TURNSTILE_SECRET_KEY is configured in .env, verify with Cloudflare API
        if (!empty($secretKey)) {
            if ($token === '') {
                return response()->json([
                    'message' => 'Please complete the Cloudflare security verification to confirm that you are human.',
                    'errors' => ['cf_turnstile_response' => ['Security verification token is missing.']],
                ], 422);
            }

            // Allow built-in fallback token in automated testing environment
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
                // If local machine is completely offline and used offline fallback token, allow local sign-in
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

    /**
     * User Login with Brute-Force & DDoS Protection
     * Max 5 attempts per minute. If exceeded, user must wait 1 minute (60 seconds).
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($turnstileError = $this->verifyTurnstile($request)) {
            return $turnstileError;
        }

        // Throttle key based on client IP (DDoS/Brute-force protection across any email entered)
        $throttleKey = 'login_attempt|' . $request->ip();

        // Check if rate limit exceeded (5 attempts)
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

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
            // Increment failed attempt counter (decay in 60 seconds / 1 minute)
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

        // Clear rate limiter on successful authentication
        RateLimiter::clear($throttleKey);

        Auth::login($user);
        $request->session()->regenerate();

        // Store client fingerprint to guard against session hijacking
        $request->session()->put('_client_fingerprint', hash('sha256', (string) $request->userAgent()));
        $request->session()->put('_client_user_agent_preview', Str::limit((string) $request->userAgent(), 150));

        AuditLog::log('USER_LOGIN', 'users', $user->id, null, ['email' => $user->email, 'role' => $user->role], $user->id);

        return response()->json([
            'message' => 'Login successful.',
            'user' => $user->load(['office', 'accountCodes']),
            'csrf_token' => csrf_token(),
        ]);
    }

    /**
     * User Self-Registration
     */
    public function register(Request $request): JsonResponse
    {
        if ($turnstileError = $this->verifyTurnstile($request)) {
            return $turnstileError;
        }

        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'role' => 'required|string|in:end_user,head,budget_officer,oppmo,twg,authorized_staff,pacco,pgso,presentative_staff',
            'phone_number' => 'required|string|max:30',
            'address' => 'required|string|max:500',
            'password' => 'required|string|min:6|confirmed',
            'office_id' => 'required|exists:offices,id',
            'designation' => 'required|string|max:255',
            'signature' => 'required|string',
        ];

        if (in_array($request->input('role'), ['authorized_staff', 'presentative_staff'], true)) {
            $rules['authorization_letter'] = 'required|file|mimes:pdf|max:5120'; // max 5MB only
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

        if ($request->input('role') === 'twg') {
            $rules['account_code_ids'] = 'nullable|array';
            $rules['account_code_ids.*'] = 'integer|exists:account_codes,id';
        }

        $validated = $request->validate($rules);

        $authorizationLetterPath = null;
        if (in_array($validated['role'], ['authorized_staff', 'presentative_staff'], true) && $request->hasFile('authorization_letter')) {
            $uploadedLetter = $request->file('authorization_letter');

            // Security Check 1: Strict extension check
            $clientExt = strtolower($uploadedLetter->getClientOriginalExtension());
            if ($clientExt !== 'pdf') {
                return response()->json([
                    'message' => 'Security Error: Only official PDF files (.pdf) are accepted for the Authorization Letter.',
                    'errors' => ['authorization_letter' => ['Only official PDF files (.pdf) are allowed.']]
                ], 422);
            }

            // Security Check 2: Reject suspicious disguised multi-extensions (.exe.pdf, .php.pdf, .url.pdf, etc.)
            $clientName = $uploadedLetter->getClientOriginalName();
            if (preg_match('/\.(php|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.pdf$/i', $clientName)) {
                return response()->json([
                    'message' => 'Security Error: Suspicious disguised multi-extension filename detected.',
                    'errors' => ['authorization_letter' => ['Suspicious disguised multi-extension filename detected.']]
                ], 422);
            }

            // Security Check 3: Verify PDF Magic Bytes (%PDF-)
            $handle = fopen($uploadedLetter->getRealPath(), 'rb');
            $header = fread($handle, 5);
            fclose($handle);
            if ($header !== '%PDF-') {
                return response()->json([
                    'message' => 'Security Error: Invalid file content. The uploaded document does not have a genuine PDF header.',
                    'errors' => ['authorization_letter' => ['Invalid PDF file header.']]
                ], 422);
            }

            // Security Check 4: Check for active executable scripts or launch actions inside the PDF
            $sampleContent = file_get_contents($uploadedLetter->getRealPath(), false, null, 0, 50000);
            if (preg_match('/\/Launch|\/EmbeddedFiles|\/JavaScript|\/JS\s*\(/i', $sampleContent)) {
                return response()->json([
                    'message' => 'Security Error: PDF contains active executable scripts or launch actions, which are restricted for security.',
                    'errors' => ['authorization_letter' => ['Active scripts or launch actions are not permitted.']]
                ], 422);
            }

            $letterFilename = 'auth_' . Str::uuid() . '.pdf';
            // Save in storage/app/private/authorization_letter/ (local disk root is storage/app/private)
            $authorizationLetterPath = $uploadedLetter->storeAs('authorization_letter', $letterFilename, 'local');
        }

        $signaturePath = null;
        if (!empty($validated['signature'])) {
            $sigData = $validated['signature'];
            // Expecting data:image/png;base64,...
            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]); // png, jpeg, etc.
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {
                    $filename = 'sig_' . Str::uuid() . '.' . ($type === 'jpeg' ? 'jpg' : 'png');
                    // Store in private storage disk (local disk root is storage/app/private)
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
            'role' => $validated['role'] ?? 'end_user',
            'office_id' => $validated['office_id'],
            'designation' => $validated['designation'] ?? null,
            'signature_path' => $signaturePath,
            'authorization_letter_path' => $authorizationLetterPath,
            'is_active' => false,
            'approval_status' => 'pending',
            'accessible_systems' => $accessibleSystems,
        ]);

        if ($user->role === 'twg' && !empty($rawAccountCodeIds)) {
            $user->accountCodes()->sync($rawAccountCodeIds);
        }

        AuditLog::log(
            'USER_REGISTERED_PENDING',
            'users',
            $user->id,
            null,
            ['email' => $user->email, 'name' => $user->name, 'office_id' => $user->office_id, 'role' => $user->role, 'is_active' => false],
            $user->id
        );

        // Notify Admins & Super Admins of pending user registration
        $admins = User::whereIn('role', ['admin', 'super_admin'])->where('is_active', true)->get();
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
            'user' => $user->load(['office', 'accountCodes']),
        ], 201);
    }

    /**
     * User Logout
     */
    public function logout(Request $request): JsonResponse
    {
        $user = Auth::user();

        if ($user) {
            AuditLog::log('USER_LOGOUT', 'users', $user->id, null, null, $user->id);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out successfully.',
            'csrf_token' => csrf_token(),
        ]);
    }

    /**
     * Fresh CSRF token for SPA requests
     */
    public function csrfToken(Request $request): JsonResponse
    {
        return response()->json([
            'csrf_token' => csrf_token(),
        ]);
    }

    /**
     * Current Authenticated User profile
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('office');

        return response()->json([
            'user' => $user,
        ]);
    }

    /**
     * Update Authenticated User Profile & Signature
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone_number' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:500',
            'designation' => 'nullable|string|max:255',
            'signature' => 'nullable|string', // base64 data url
        ]);

        $updateData = [
            'name' => $validated['name'],
            'phone_number' => $validated['phone_number'] ?? null,
            'address' => $validated['address'] ?? null,
            'designation' => $validated['designation'] ?? null,
        ];

        // If drawn signature data provided
        if (!empty($validated['signature'])) {
            $sigData = $validated['signature'];
            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]);
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {
                    // Remove old signature if exists
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

        // Profile Photo handling
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
            'user' => $user->fresh(['office']),
        ]);
    }

    /**
     * Store and set a profile photo for the given user.
     * Saved to storage/app/private/profile/{sanitized_name}.{png|jpg}
     */
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

        // Sanitize username into lowercase alphanumeric filename e.g. juandelacruz
        $baseName = preg_replace('/[^a-z0-9]/', '', strtolower($user->name));
        if (empty($baseName)) {
            $baseName = 'user' . $user->id;
        }

        $cleanExt = ($extension === 'jpeg' || $extension === 'jpg') ? 'jpg' : 'png';
        $filename = "{$baseName}.{$cleanExt}";

        // Prevent overwriting another user's avatar
        $collision = User::where('id', '!=', $user->id)
            ->where('profile_photo_path', 'profile/' . $filename)
            ->exists();
        if ($collision) {
            $filename = "{$baseName}_{$user->id}.{$cleanExt}";
        }

        // Remove old photo if exists
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

    /**
     * Upload or update user profile photo
     */
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
                'profile_photo_url' => "/api/users/{$user->id}/avatar",
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Remove authenticated user's profile photo
     */
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

    /**
     * Get authenticated user's profile photo
     */
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
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Serve authenticated user's official signature securely
     */
    public function getSignature(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $user = $request->user();

        if (!$user->signature_path || !Storage::disk('local')->exists($user->signature_path)) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        $fullPath = Storage::disk('local')->path($user->signature_path);

        return response()->file($fullPath, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }
}
