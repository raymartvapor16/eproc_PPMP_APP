<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    /**
     * List users with office information (Admin only)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $users = User::with('office')->orderBy('name')->get();

        return response()->json($users);
    }

    /**
     * Create a new user (Admin & Super Admin)
     */
    public function store(Request $request): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        if ($request->input('role') === 'super_admin' && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Admin can assign the Super Admin role.'], 403);
        }

        $allowedRoles = ['end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'authorized_staff', 'pacco', 'monitor', 'pgso', 'presentative_staff', 'admin'];
        if ($admin->isSuperAdmin()) {
            $allowedRoles[] = 'super_admin';
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'string', 'in:' . implode(',', $allowedRoles)],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'designation' => ['nullable', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'signature' => ['nullable', 'string'],
            'signature_file' => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'max:5120'],
        ]);

        $signaturePath = null;
        if (!empty($validated['signature'])) {
            $sigData = $validated['signature'];
            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]);
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {
                    $filename = 'sig_' . \Illuminate\Support\Str::uuid() . '.' . ($type === 'jpeg' ? 'jpg' : 'png');
                    $signaturePath = 'signatures/' . $filename;
                    \Illuminate\Support\Facades\Storage::disk('local')->put($signaturePath, $decoded);
                }
            }
        } elseif ($request->hasFile('signature_file')) {
            $uploaded = $request->file('signature_file');
            $ext = in_array(strtolower($uploaded->getClientOriginalExtension()), ['jpg', 'jpeg', 'png'], true)
                ? strtolower($uploaded->getClientOriginalExtension())
                : 'png';
            $rawHeader = file_get_contents($uploaded->getRealPath(), false, null, 0, 8);
            $isValidHeader = (
                substr($rawHeader, 0, 3) === "\xFF\xD8\xFF" || // JPEG
                substr($rawHeader, 0, 8) === "\x89PNG\r\n\x1a\n" // PNG
            );
            if (!$isValidHeader) {
                return response()->json(['message' => 'Uploaded signature is not a valid PNG or JPEG image.'], 422);
            }
            $filename = 'sig_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
            $signaturePath = 'signatures/' . $filename;
            \Illuminate\Support\Facades\Storage::disk('local')->put($signaturePath, file_get_contents($uploaded->getRealPath()));
        }

        $accessibleSystems = $request->input('accessible_systems');
        if (is_string($accessibleSystems)) {
            $decoded = json_decode($accessibleSystems, true);
            $accessibleSystems = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $accessibleSystems)));
        }
        if (!is_array($accessibleSystems) || empty($accessibleSystems)) {
            if ($validated['role'] === 'monitor') {
                $accessibleSystems = ['/monitoringsystem'];
            } elseif (in_array($validated['role'], ['pgso', 'presentative_staff'], true)) {
                $accessibleSystems = ['/supplierevaluation'];
            } else {
                $accessibleSystems = ['/eprocrementppmpapp'];
            }
        }
        $accessibleSystems = array_values(array_unique($accessibleSystems));

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'address' => $validated['address'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'office_id' => $validated['office_id'] ?? null,
            'designation' => $validated['designation'] ?? null,
            'signature_path' => $signaturePath,
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => $accessibleSystems,
        ]);

        AuditLog::log(
            'USER_CREATED_BY_ADMIN',
            'users',
            $user->id,
            null,
            ['created_user_id' => $user->id, 'email' => $user->email, 'role' => $user->role],
            $admin->id
        );

        return response()->json([
            'message' => "User account for {$user->name} created and activated successfully.",
            'user' => $user->load('office'),
        ], 201);
    }

    /**
     * Upload or update a user's signature (Admin & Super Admin)
     */
    public function updateSignature(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        $request->validate([
            'signature' => ['nullable', 'string'],
            'signature_data' => ['nullable', 'string'],
            'signature_file' => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'max:5120'],
        ]);

        $signaturePath = null;
        $sigInput = $request->input('signature') ?? $request->input('signature_data');
        if (!empty($sigInput)) {
            $sigData = $sigInput;
            if (preg_match('/^data:image\/(\w+);base64,/', $sigData, $type)) {
                $sigData = substr($sigData, strpos($sigData, ',') + 1);
                $type = strtolower($type[1]);
                $decoded = base64_decode($sigData);

                if ($decoded !== false) {
                    $filename = 'sig_' . \Illuminate\Support\Str::uuid() . '.' . ($type === 'jpeg' ? 'jpg' : 'png');
                    $signaturePath = 'signatures/' . $filename;
                    \Illuminate\Support\Facades\Storage::disk('local')->put($signaturePath, $decoded);
                }
            }
        } elseif ($request->hasFile('signature_file')) {
            $uploaded = $request->file('signature_file');
            $ext = in_array(strtolower($uploaded->getClientOriginalExtension()), ['jpg', 'jpeg', 'png'], true)
                ? strtolower($uploaded->getClientOriginalExtension())
                : 'png';
            $rawHeader = file_get_contents($uploaded->getRealPath(), false, null, 0, 8);
            $isValidHeader = (
                substr($rawHeader, 0, 3) === "\xFF\xD8\xFF" || // JPEG
                substr($rawHeader, 0, 8) === "\x89PNG\r\n\x1a\n" // PNG
            );
            if (!$isValidHeader) {
                return response()->json(['message' => 'Uploaded signature is not a valid PNG or JPEG image.'], 422);
            }
            $filename = 'sig_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
            $signaturePath = 'signatures/' . $filename;
            \Illuminate\Support\Facades\Storage::disk('local')->put($signaturePath, file_get_contents($uploaded->getRealPath()));
        }

        if (!$signaturePath) {
            return response()->json(['message' => 'Valid signature image is required.'], 422);
        }

        // Delete previous signature if exists
        if ($targetUser->signature_path && \Illuminate\Support\Facades\Storage::disk('local')->exists($targetUser->signature_path)) {
            \Illuminate\Support\Facades\Storage::disk('local')->delete($targetUser->signature_path);
        }

        $targetUser->update(['signature_path' => $signaturePath]);

        AuditLog::log(
            'USER_SIGNATURE_UPDATED_BY_ADMIN',
            'users',
            $targetUser->id,
            null,
            ['user_id' => $targetUser->id],
            $admin->id
        );

        return response()->json([
            'message' => "Official signature for {$targetUser->name} has been updated successfully.",
            'user' => $targetUser->fresh(['office']),
        ]);
    }

    /**
     * Change a user's password (Admin only)
     */
    public function changePassword(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);

        $newPassword = $request->input('password');

        $targetUser->update([
            'password' => Hash::make($newPassword),
        ]);

        AuditLog::log(
            'USER_PASSWORD_RESET_BY_ADMIN',
            'users',
            $targetUser->id,
            null,
            ['user_id' => $targetUser->id, 'email' => $targetUser->email],
            $admin->id
        );

        return response()->json([
            'message' => "Password for {$targetUser->name} has been updated successfully.",
        ]);
    }

    /**
     * Approve a pending user account (Admin only)
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);
        $targetUser->update([
            'is_active' => true,
            'approval_status' => 'approved',
            'rejection_reason' => null,
        ]);

        AuditLog::log(
            'USER_APPROVED',
            'users',
            $targetUser->id,
            null,
            ['approved_user_id' => $targetUser->id, 'email' => $targetUser->email],
            $admin->id
        );

        SystemNotification::notify(
            $targetUser->id,
            'Account Registration Approved',
            'Congratulations! Your account registration has been reviewed and approved by the Administrator. You now have full access to the system.',
            null,
            'success'
        );

        return response()->json([
            'message' => "Account for {$targetUser->name} has been approved and activated.",
            'user' => $targetUser->load('office'),
        ]);
    }

    /**
     * Reject a pending user registration (Admin only)
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $reason = $request->input('reason', 'Registration request rejected by Administrator.');

        $targetUser->update([
            'is_active' => false,
            'approval_status' => 'rejected',
            'rejection_reason' => $reason,
        ]);

        AuditLog::log(
            'USER_REJECTED',
            'users',
            $targetUser->id,
            null,
            ['rejected_user_id' => $targetUser->id, 'email' => $targetUser->email, 'reason' => $reason],
            $admin->id
        );

        SystemNotification::notify(
            $targetUser->id,
            'Account Registration Disapproved',
            "Your registration was disapproved by the Administrator. Reason: {$reason}",
            null,
            'danger'
        );

        return response()->json([
            'message' => "Registration for {$targetUser->name} has been rejected.",
            'user' => $targetUser->load('office'),
        ]);
    }

    /**
     * Toggle active/inactive status (Admin only)
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        if ($targetUser->id === $admin->id) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        $newStatus = !$targetUser->is_active;
        $targetUser->update(['is_active' => $newStatus]);

        AuditLog::log(
            $newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
            'users',
            $targetUser->id,
            null,
            ['user_id' => $targetUser->id, 'is_active' => $newStatus],
            $admin->id
        );

        return response()->json([
            'message' => "User {$targetUser->name} is now " . ($newStatus ? 'active' : 'inactive') . ".",
            'user' => $targetUser->load('office'),
        ]);
    }

    /**
     * Delete user (Admin only)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        if ($targetUser->id === $admin->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        if ($targetUser->ppmps()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete user because they have submitted or created PPMP documents.'
            ], 422);
        }

        AuditLog::log(
            'USER_DELETED',
            'users',
            $targetUser->id,
            null,
            ['name' => $targetUser->name, 'email' => $targetUser->email],
            $admin->id
        );

        $targetUser->delete();

        return response()->json([
            'message' => "User {$targetUser->name} has been deleted successfully.",
        ]);
    }

    /**
     * Update a user's role (Admin & Super Admin)
     */
    public function updateRole(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        $allowedRoles = ['end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'authorized_staff', 'pacco', 'monitor', 'pgso', 'presentative_staff', 'admin'];
        if ($admin->isSuperAdmin()) {
            $allowedRoles[] = 'super_admin';
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:' . implode(',', $allowedRoles)],
        ]);

        $oldRole = $targetUser->role;
        $targetUser->update(['role' => $validated['role']]);

        AuditLog::log(
            'USER_ROLE_CHANGED',
            'users',
            $targetUser->id,
            ['role' => $oldRole],
            ['role' => $validated['role']],
            $admin->id
        );

        return response()->json([
            'message' => "Role for {$targetUser->name} has been updated to {$validated['role']}.",
            'user' => $targetUser->load('office'),
        ]);
    }

    /**
     * Serve a user's signature file securely for authorized users
     */
    public function getSignature(Request $request, int $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = User::findOrFail($id);

        // Access Control: Allow self, admin, or official procurement/evaluation signatories/reviewers
        $isSelf = $currentUser->id === $targetUser->id;
        $isAdmin = $currentUser->isAdmin() || $currentUser->isPgso();
        $isOfficialSignatory = in_array($targetUser->role, ['head', 'budget_officer', 'oppmo', 'twg', 'admin', 'super_admin', 'authorized_staff', 'presentative_staff', 'pacco', 'pgso'], true);

        if (!$isSelf && !$isAdmin && !$isOfficialSignatory) {
            // Check if they signed a Supplier Digital Approval or prepared a PPMP
            $sharesEvaluation = \App\Models\SupplierDigitalApproval::where('signed_by', $targetUser->id)->exists();
            $sharesPpmp = $sharesEvaluation || \App\Models\PpmpSignature::where('user_id', $targetUser->id)
                ->whereHas('ppmp', function ($q) use ($currentUser) {
                    if ($currentUser->isHead()) {
                        $q->where('office_id', $currentUser->office_id);
                    } elseif ($currentUser->isBudgetOfficer() || $currentUser->isOppmo() || $currentUser->isTwg() || $currentUser->isPacco()) {
                        $q->where('status', '!=', 'DRAFT');
                    } else {
                        $q->where('created_by', $currentUser->id);
                    }
                })->exists();

            if (!$sharesPpmp) {
                return response()->json(['message' => 'Unauthorized. You do not have permission to view this signature.'], 403);
            }
        }

        if (!$targetUser->signature_path) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        $fullPath = null;
        if (\Illuminate\Support\Facades\Storage::disk('local')->exists($targetUser->signature_path)) {
            $fullPath = \Illuminate\Support\Facades\Storage::disk('local')->path($targetUser->signature_path);
        } else {
            $legacyPath = 'C:/xampp/htdocs/finalize_system/Supplier_Evaluation/storage/app/private/' . ltrim($targetUser->signature_path, '/');
            if (file_exists($legacyPath)) {
                $fullPath = $legacyPath;
            }
        }

        if (!$fullPath || !file_exists($fullPath)) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        return response()->file($fullPath, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Serve an authorized staff's official Authorization Letter PDF securely
     */
    public function getAuthorizationLetter(Request $request, int $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = User::findOrFail($id);

        $isSelf = $currentUser->id === $targetUser->id;
        $isAdmin = $currentUser->isAdmin();
        $isOfficeHead = $currentUser->isHead() && $currentUser->office_id === $targetUser->office_id;
        $isOfficial = in_array($currentUser->role, ['budget_officer', 'oppmo', 'twg', 'pacco'], true);

        if (!$isSelf && !$isAdmin && !$isOfficeHead && !$isOfficial) {
            return response()->json(['message' => 'Unauthorized. You do not have permission to view this authorization letter.'], 403);
        }

        if (!$targetUser->authorization_letter_path || !\Illuminate\Support\Facades\Storage::disk('local')->exists($targetUser->authorization_letter_path)) {
            return response()->json(['message' => 'No authorization letter on file.'], 404);
        }

        $fullPath = \Illuminate\Support\Facades\Storage::disk('local')->path($targetUser->authorization_letter_path);

        return response()->file($fullPath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="Authorization_Letter_' . preg_replace('/[^A-Za-z0-9_-]/', '_', $targetUser->name) . '.pdf"',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Update user's permitted digital systems (Admin & Super Admin)
     */
    public function updateSystemAccess(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        $validated = $request->validate([
            'accessible_systems' => ['required', 'array'],
            'accessible_systems.*' => ['string'],
        ]);

        $oldSystems = $targetUser->accessible_systems;
        $cleanSystems = array_values(array_unique($validated['accessible_systems']));
        $targetUser->update([
            'accessible_systems' => $cleanSystems,
        ]);

        AuditLog::log(
            'USER_SYSTEM_ACCESS_UPDATED',
            'users',
            $targetUser->id,
            ['accessible_systems' => $oldSystems],
            ['accessible_systems' => $cleanSystems],
            $admin->id
        );

        return response()->json([
            'message' => "System access permissions for {$targetUser->name} have been updated successfully.",
            'user' => $targetUser->fresh(['office']),
        ]);
    }
}
