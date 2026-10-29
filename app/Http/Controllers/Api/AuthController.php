<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
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
            'user' => $user->load('office'),
            'csrf_token' => csrf_token(),
        ]);
    }

    /**
     * User Self-Registration
     */
    public function register(Request $request): JsonResponse
    {
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
            $rules['authorization_letter'] = 'required|file|mimes:pdf|max:20480';
        }

        $validated = $request->validate($rules);

        $authorizationLetterPath = null;
        if (in_array($validated['role'], ['authorized_staff', 'presentative_staff'], true) && $request->hasFile('authorization_letter')) {
            $uploadedLetter = $request->file('authorization_letter');

            // Verify PDF Magic Bytes (%PDF-)
            $handle = fopen($uploadedLetter->getRealPath(), 'rb');
            $header = fread($handle, 5);
            fclose($handle);
            if ($header !== '%PDF-') {
                return response()->json([
                    'message' => 'The authorization letter must be a valid PDF document.',
                    'errors' => ['authorization_letter' => ['Invalid PDF file header.']]
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
            'user' => $user->load('office'),
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
