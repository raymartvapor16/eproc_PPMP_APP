<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $users = User::with(['office', 'accountCodes', 'pnpkiSignature'])->latest('id')->get();

        return response()->json($users);
    }

    protected function storePnpkiProofPdf(?\Illuminate\Http\UploadedFile $uploadedPdf): array
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

        $proofFilename = 'pnpki_' . \Illuminate\Support\Str::uuid() . '.pdf';
        $proofPath = $uploadedPdf->storeAs('pnpki_proofs', $proofFilename, 'local');

        return [
            'path' => $proofPath,
            'original_name' => \Illuminate\Support\Str::limit($clientName, 180, ''),
            'error' => null,
        ];
    }

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
        if (in_array('super_admin', $normalizedRoles, true) && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Admin can assign the Super Admin role.'], 403);
        }
        $request->merge([
            'roles' => $normalizedRoles,
            'role' => $normalizedRoles[0] ?? $request->input('role', ''),
        ]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'string', 'in:' . implode(',', $allowedRoles)],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', 'string', 'in:' . implode(',', $allowedRoles)],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'designation' => ['nullable', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'signature' => ['nullable', 'string'],
            'signature_file' => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'max:5120'],
            'signature_type' => ['nullable', 'string', 'in:pnpki,optional'],
            'pnpki_expiration_date' => ['nullable', 'date'],
            'pnpki_proof_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:5120'],
            'signature_capture_method' => ['nullable', 'string', 'in:drawn,uploaded'],
            'account_code_ids' => ['nullable', 'array'],
            'account_code_ids.*' => ['integer', 'exists:account_codes,id'],
        ]);

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
                substr($rawHeader, 0, 3) === "\xFF\xD8\xFF" ||
                substr($rawHeader, 0, 8) === "\x89PNG\r\n\x1a\n"
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
            'role' => $validated['roles'][0] ?? $validated['role'],
            'roles' => array_values(array_unique($validated['roles'] ?? [$validated['role']])),
            'office_id' => $validated['office_id'] ?? null,
            'designation' => $validated['designation'] ?? null,
            'signature_path' => $signaturePath,
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => $accessibleSystems,
        ]);

        if ($signaturePath || $request->filled('signature_type')) {
            $pnpkiSystemEnabled = \App\Models\SystemSetting::isPnpkiEnabled();
            $sigType = ($pnpkiSystemEnabled && in_array($request->input('signature_type'), ['pnpki', 'optional'], true))
                ? $request->input('signature_type')
                : 'optional';
            $captureMethod = in_array($request->input('signature_capture_method'), ['drawn', 'uploaded'], true)
                ? $request->input('signature_capture_method')
                : ($request->hasFile('signature_file') ? 'uploaded' : 'drawn');

            $user->pnpkiSignature()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'signature_type' => $sigType,
                    'expiration_date' => $sigType === 'pnpki' ? ($request->input('pnpki_expiration_date') ?: null) : null,
                    'proof_pdf_path' => $sigType === 'pnpki' ? $pnpkiProofPath : null,
                    'proof_original_name' => $sigType === 'pnpki' ? $pnpkiProofOriginalName : null,
                    'signature_image_path' => $signaturePath,
                    'capture_method' => $captureMethod,
                ]
            );
        }

        if ($user->hasAssignedRole('twg') && !empty($validated['account_code_ids'])) {
            $user->accountCodes()->sync($validated['account_code_ids']);
        }

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
            'user' => $user->load(['office', 'accountCodes', 'pnpkiSignature']),
        ], 201);
    }

    public function updateSignature(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::with('pnpkiSignature')->findOrFail($id);

        if ($targetUser->isSuperAdmin() && !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can manage Super Administrator accounts.'], 403);
        }

        $existingPnpki = $targetUser->pnpkiSignature;
        if ($existingPnpki && $existingPnpki->signature_type === 'pnpki' && !$existingPnpki->is_expired && !$admin->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized. Only the Super Administrator can edit an active PNPKI Digital E-Signature in User Management.',
            ], 403);
        }

        $request->validate([
            'signature' => ['nullable', 'string'],
            'signature_data' => ['nullable', 'string'],
            'signature_file' => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'max:5120'],
            'signature_type' => ['nullable', 'string', 'in:pnpki,optional'],
            'pnpki_expiration_date' => ['nullable', 'date'],
            'pnpki_proof_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:5120'],
            'signature_capture_method' => ['nullable', 'string', 'in:drawn,uploaded'],
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
                substr($rawHeader, 0, 3) === "\xFF\xD8\xFF" ||
                substr($rawHeader, 0, 8) === "\x89PNG\r\n\x1a\n"
            );
            if (!$isValidHeader) {
                return response()->json(['message' => 'Uploaded signature is not a valid PNG or JPEG image.'], 422);
            }
            $filename = 'sig_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
            $signaturePath = 'signatures/' . $filename;
            \Illuminate\Support\Facades\Storage::disk('local')->put($signaturePath, file_get_contents($uploaded->getRealPath()));
        }

        if (!$signaturePath && !$targetUser->signature_path) {
            return response()->json(['message' => 'Valid signature image is required.'], 422);
        }

        if ($signaturePath) {

            if ($targetUser->signature_path && \Illuminate\Support\Facades\Storage::disk('local')->exists($targetUser->signature_path)) {
                \Illuminate\Support\Facades\Storage::disk('local')->delete($targetUser->signature_path);
            }

            $targetUser->update(['signature_path' => $signaturePath]);
        }

        $existingPnpki = $targetUser->pnpkiSignature;
        $pnpkiSystemEnabled = \App\Models\SystemSetting::isPnpkiEnabled();
        $sigType = $pnpkiSystemEnabled
            ? (in_array($request->input('signature_type'), ['pnpki', 'optional'], true)
                ? $request->input('signature_type')
                : ($existingPnpki?->signature_type ?? 'optional'))
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

        $captureMethod = in_array($request->input('signature_capture_method'), ['drawn', 'uploaded'], true)
            ? $request->input('signature_capture_method')
            : ($request->hasFile('signature_file') ? 'uploaded' : ($existingPnpki?->capture_method ?? 'drawn'));

        $finalExpDate = $sigType === 'pnpki'
            ? ($newExpInput ?: $currentExpDate)
            : $currentExpDate;

        if ($sigType === 'pnpki') {
            if (empty($finalExpDate)) {
                return response()->json(['message' => 'Expiration date of using E-Sig is required for PNPKI Digital E-Signature.'], 422);
            }
            if (empty($proofPath)) {
                return response()->json(['message' => 'Proof of Registration PDF (Max 5MB) is required for PNPKI Digital E-Signature.'], 422);
            }
        }

        $targetUser->pnpkiSignature()->updateOrCreate(
            ['user_id' => $targetUser->id],
            [
                'signature_type' => $sigType,
                'expiration_date' => $finalExpDate,
                'previous_expiration_date' => $prevExpDate,
                'proof_pdf_path' => $proofPath,
                'proof_original_name' => $proofOriginalName,
                'previous_proof_pdf_path' => $prevProofPath,
                'previous_proof_original_name' => $prevProofName,
                'signature_image_path' => $signaturePath ?? $targetUser->signature_path,
                'capture_method' => $captureMethod,
                'renewal_history' => $renewalHistory,
                'renewed_at' => $renewedAt,
                'renewal_count' => $renewalCount,
            ]
        );

        AuditLog::log(
            'USER_SIGNATURE_UPDATED_BY_ADMIN',
            'users',
            $targetUser->id,
            null,
            ['user_id' => $targetUser->id, 'signature_type' => $sigType],
            $admin->id
        );

        return response()->json([
            'message' => "Official signature for {$targetUser->name} has been updated successfully.",
            'user' => $targetUser->fresh(['office', 'accountCodes', 'pnpkiSignature']),
        ]);
    }

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

        $rawRoles = $request->input('roles');
        if (is_string($rawRoles)) {
            $decodedRoles = json_decode($rawRoles, true);
            $rawRoles = is_array($decodedRoles) ? $decodedRoles : array_filter(array_map('trim', explode(',', $rawRoles)));
        }
        if (is_array($rawRoles) && !empty($rawRoles)) {
            $normalizedRoles = array_values(array_unique(array_filter(array_map(fn ($r) => trim((string) $r), $rawRoles))));
            $request->merge([
                'roles' => $normalizedRoles,
                'role' => $request->input('role') ?: ($normalizedRoles[0] ?? ''),
            ]);
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:' . implode(',', $allowedRoles)],
            'roles' => ['nullable', 'array', 'min:1'],
            'roles.*' => ['required', 'string', 'in:' . implode(',', $allowedRoles)],
        ]);

        $newRoles = !empty($validated['roles'])
            ? array_values(array_unique($validated['roles']))
            : [$validated['role']];
        $primaryRole = in_array($validated['role'], $newRoles, true) ? $validated['role'] : $newRoles[0];

        $oldRole = $targetUser->role;
        $oldRoles = $targetUser->available_roles;
        $targetUser->update([
            'role' => $primaryRole,
            'roles' => $newRoles,
        ]);

        AuditLog::log(
            'USER_ROLE_CHANGED',
            'users',
            $targetUser->id,
            ['role' => $oldRole, 'roles' => $oldRoles],
            ['role' => $primaryRole, 'roles' => $newRoles],
            $admin->id
        );

        return response()->json([
            'message' => "Role for {$targetUser->name} has been updated to {$validated['role']}.",
            'user' => $targetUser->load(['office', 'accountCodes']),
        ]);
    }

    public function updateAccountCodes(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::findOrFail($id);

        $validated = $request->validate([
            'account_code_ids' => ['nullable', 'array'],
            'account_code_ids.*' => ['integer', 'exists:account_codes,id'],
        ]);

        $accountCodeIds = $validated['account_code_ids'] ?? [];
        $targetUser->accountCodes()->sync($accountCodeIds);

        AuditLog::log(
            'USER_ACCOUNT_CODES_UPDATED',
            'users',
            $targetUser->id,
            null,
            ['user_id' => $targetUser->id, 'assigned_account_code_ids' => $accountCodeIds],
            $admin->id
        );

        return response()->json([
            'message' => "Assigned account codes for {$targetUser->name} have been updated successfully.",
            'user' => $targetUser->load(['office', 'accountCodes']),
        ]);
    }

    public function getAccountCodes(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser->isAdmin() && $currentUser->id !== $id) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $targetUser = User::with('accountCodes')->findOrFail($id);

        return response()->json([
            'user_id' => $targetUser->id,
            'account_codes' => $targetUser->accountCodes,
        ]);
    }

    public function refreshToken(Request $request, string $id): JsonResponse
    {
        $viewer = $request->user();
        $sessionId = ($request->hasSession() && $request->cookies->has(config('session.cookie')))
            ? $request->session()->getId()
            : null;
        $tokenCheck = User::decryptIdToken($id, $viewer?->id, $sessionId, false);
        if (!$tokenCheck['id']) {
            return response()->json(['message' => $tokenCheck['error'] ?? 'Invalid or unencrypted user reference.'], 403);
        }

        $targetUser = User::findOrFail($tokenCheck['id']);

        return response()->json([
            'encrypted_id' => User::encryptId((int) $targetUser->id, $viewer?->id, $sessionId, 120),
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    }

    public function getSignature(Request $request, string $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $resolvedId = User::decryptId($id);
        if (!$resolvedId) {
            return response()->json(['message' => 'Invalid or unencrypted user reference.'], 403);
        }

        $currentUser = $request->user();
        $targetUser = User::findOrFail($resolvedId);

        $isSelf = $currentUser->id === $targetUser->id;
        $isAdmin = $currentUser->isAdmin() || $currentUser->isPgso();
        $isOfficialSignatory = $targetUser->hasAnyAssignedRole(['head', 'budget_officer', 'oppmo', 'twg', 'admin', 'super_admin', 'authorized_staff', 'presentative_staff', 'pacco', 'pgso']);

        if (!$isSelf && !$isAdmin && !$isOfficialSignatory) {

            $sharesEvaluation = \App\Models\SupplierDigitalApproval::where('signed_by', $targetUser->id)->exists();
            $headStages = $currentUser->isHead() ? \App\Support\ReviewHeadResolver::userStagesForHead($currentUser) : [];
            $appStages = \App\Support\ReviewHeadResolver::userAppSignatoryStages($currentUser);
            $canViewCrossOfficeSignatures = !empty($headStages) || !empty($appStages);

            $sharesPpmp = $sharesEvaluation || \App\Models\PpmpSignature::where('user_id', $targetUser->id)
                ->whereHas('ppmp', function ($q) use ($currentUser, $canViewCrossOfficeSignatures) {
                    if ($canViewCrossOfficeSignatures) {
                        $q->where('status', '!=', 'DRAFT');
                    } elseif ($currentUser->isHead()) {
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

        $requestedSigVersion = $request->query('version');
        $targetSigPath = ($requestedSigVersion === 'pending' && $targetUser->pnpkiSignature?->pending_signature_image_path)
            ? $targetUser->pnpkiSignature->pending_signature_image_path
            : $targetUser->signature_path;

        if (!$targetSigPath) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        $fullPath = null;
        if (\Illuminate\Support\Facades\Storage::disk('local')->exists($targetSigPath)) {
            $fullPath = \Illuminate\Support\Facades\Storage::disk('local')->path($targetSigPath);
        } else {
            $legacyPath = 'C:/xampp/htdocs/finalize_system/Supplier_Evaluation/storage/app/private/' . ltrim($targetSigPath, '/');
            if (file_exists($legacyPath)) {
                $fullPath = $legacyPath;
            }
        }

        if (!$fullPath || !file_exists($fullPath)) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        return response()->file($fullPath, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function getAuthorizationLetter(Request $request, string $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $currentUser = $request->user();
        $sessionId = ($request->hasSession() && $request->cookies->has(config('session.cookie')))
            ? $request->session()->getId()
            : null;
        $tokenCheck = User::decryptIdToken($id, $currentUser?->id, $sessionId, true);
        if (!$tokenCheck['id']) {
            return response()->json(['message' => $tokenCheck['error'] ?? 'Invalid or unencrypted user reference.'], 403);
        }

        $targetUser = User::findOrFail($tokenCheck['id']);

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
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

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
            'can_view_all_monitoring_ppmp' => ['sometimes', 'boolean'],
        ]);

        $oldSystems = $targetUser->accessible_systems;
        $cleanSystems = array_values(array_unique($validated['accessible_systems']));
        $updateData = [
            'accessible_systems' => $cleanSystems,
        ];
        if (array_key_exists('can_view_all_monitoring_ppmp', $validated)) {
            $updateData['can_view_all_monitoring_ppmp'] = (bool) $validated['can_view_all_monitoring_ppmp'];
        }
        $targetUser->update($updateData);

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

    public function getAvatar(Request $request, string $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $resolvedId = User::decryptId($id);
        if (!$resolvedId) {
            return response()->json(['message' => 'Invalid or unencrypted user reference.'], 403);
        }

        $targetUser = User::findOrFail($resolvedId);

        if (!$targetUser->profile_photo_path || !Storage::disk('local')->exists($targetUser->profile_photo_path)) {
            return response()->json(['message' => 'No avatar found.'], 404);
        }

        $fullPath = Storage::disk('local')->path($targetUser->profile_photo_path);
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

    public function getPnpkiProof(Request $request, string $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $currentUser = $request->user();
        if (!$currentUser) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $sessionId = ($request->hasSession() && $request->cookies->has(config('session.cookie')))
            ? $request->session()->getId()
            : null;
        $tokenCheck = User::decryptIdToken($id, $currentUser->id, $sessionId, true);
        if (!$tokenCheck['id']) {
            return response()->json(['message' => $tokenCheck['error'] ?? 'Invalid or unencrypted user reference.'], 403);
        }

        $targetUser = User::with('pnpkiSignature')->findOrFail($tokenCheck['id']);

        $isSelf = $currentUser->id === $targetUser->id;
        $isAdmin = $currentUser->isAdmin();
        if (!$isSelf && !$isAdmin) {
            return response()->json(['message' => 'Unauthorized. You may only view your own confidential PNPKI Proof of Registration.'], 403);
        }

        $pnpki = $targetUser->pnpkiSignature;
        $requestedVersion = $request->query('version');
        if ($requestedVersion === 'pending') {
            $targetPath = $pnpki?->pending_proof_pdf_path ?: $pnpki?->proof_pdf_path;
        } elseif ($requestedVersion === 'history') {
            $historyIdx = (int) $request->query('index', 0);
            $history = is_array($pnpki?->renewal_history) ? $pnpki->renewal_history : [];
            $targetPath = $history[$historyIdx]['proof_pdf_path'] ?? null;
        } elseif ($requestedVersion === 'previous') {
            $targetPath = $pnpki?->previous_proof_pdf_path ?: $pnpki?->proof_pdf_path;
        } else {
            $targetPath = $pnpki?->proof_pdf_path;
        }

        if (!$pnpki || !$targetPath || !Storage::disk('local')->exists($targetPath)) {
            return response()->json(['message' => 'No PNPKI Proof of Registration PDF on file.'], 404);
        }

        $fullPath = Storage::disk('local')->path($targetPath);
        $safeFilename = 'PNPKI_Proof_' . preg_replace('/[^A-Za-z0-9_-]/', '_', $targetUser->name) . '.pdf';

        return response()->file($fullPath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $safeFilename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function approvePnpkiRenewal(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin || !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can approve PNPKI Digital E-Signature renewals.'], 403);
        }

        $targetUser = User::with('pnpkiSignature')->findOrFail($id);
        $pnpki = $targetUser->pnpkiSignature;

        if (!$pnpki || $pnpki->renewal_status !== 'pending' || !$pnpki->pending_expiration_date) {
            return response()->json(['message' => 'This user does not have a pending PNPKI renewal request awaiting approval.'], 422);
        }

        $oldExpDate = $pnpki->expiration_date?->format('Y-m-d');
        $oldProofPath = $pnpki->proof_pdf_path;
        $oldProofName = $pnpki->proof_original_name;
        $newExpDate = $pnpki->pending_expiration_date?->format('Y-m-d');
        $newProofPath = $pnpki->pending_proof_pdf_path ?: $oldProofPath;
        $newProofName = $pnpki->pending_proof_original_name ?: $oldProofName;

        $history = is_array($pnpki->renewal_history) ? $pnpki->renewal_history : [];
        if ($oldExpDate || $oldProofPath) {
            $history[] = [
                'expiration_date' => $oldExpDate,
                'proof_pdf_path' => $oldProofPath,
                'proof_original_name' => $oldProofName,
                'archived_at' => now()->toIso8601String(),
                'approved_by' => $admin->id,
            ];
        }

        $activeSigPath = $targetUser->signature_path;
        if (!empty($pnpki->pending_signature_image_path)) {
            $activeSigPath = $pnpki->pending_signature_image_path;
            $targetUser->update(['signature_path' => $activeSigPath]);
        }

        $pnpki->update([
            'signature_type' => 'pnpki',
            'expiration_date' => $newExpDate,
            'previous_expiration_date' => $oldExpDate ?? $pnpki->previous_expiration_date?->format('Y-m-d'),
            'proof_pdf_path' => $newProofPath,
            'proof_original_name' => $newProofName,
            'previous_proof_pdf_path' => $oldProofPath ?? $pnpki->previous_proof_pdf_path,
            'previous_proof_original_name' => $oldProofName ?? $pnpki->previous_proof_original_name,
            'signature_image_path' => $activeSigPath,
            'renewal_history' => $history,
            'renewed_at' => now(),
            'renewal_count' => ((int) ($pnpki->renewal_count ?? 0)) + 1,
            'renewal_status' => 'approved',
            'pending_expiration_date' => null,
            'pending_proof_pdf_path' => null,
            'pending_proof_original_name' => null,
            'pending_signature_image_path' => null,
            'renewal_reviewed_at' => now(),
            'renewal_reviewed_by' => $admin->id,
            'renewal_rejection_reason' => null,
        ]);

        SystemNotification::where('user_id', $targetUser->id)
            ->where('title', 'like', 'PNPKI Digital E-Signature Expir%')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        SystemNotification::notify(
            $targetUser->id,
            'PNPKI Digital E-Signature Renewal Approved',
            "Your PNPKI Digital E-Signature renewal has been approved by the Super Administrator! Your new expiration date ({$newExpDate}) is now active, and your previous registration data ({$oldExpDate}) remains preserved on file.",
            null,
            'success'
        );

        AuditLog::log(
            'USER_PNPKI_RENEWAL_APPROVED',
            'pnpki_signatures',
            $targetUser->id,
            ['previous_expiration_date' => $oldExpDate, 'previous_proof_original_name' => $oldProofName],
            ['new_expiration_date' => $newExpDate, 'new_proof_original_name' => $newProofName],
            $admin->id
        );

        return response()->json([
            'message' => "PNPKI Digital E-Signature renewal for {$targetUser->name} (New Expiration: {$newExpDate}) has been approved.",
            'user' => $targetUser->fresh(['office', 'accountCodes', 'pnpkiSignature']),
        ]);
    }

    public function rejectPnpkiRenewal(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (!$admin || !$admin->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Super Administrators can reject PNPKI Digital E-Signature renewals.'], 403);
        }

        $targetUser = User::with('pnpkiSignature')->findOrFail($id);
        $pnpki = $targetUser->pnpkiSignature;

        if (!$pnpki || $pnpki->renewal_status !== 'pending') {
            return response()->json(['message' => 'This user does not have a pending PNPKI renewal request.'], 422);
        }

        $reason = trim((string) $request->input('reason', ''));
        $rejectedExpDate = $pnpki->pending_expiration_date?->format('Y-m-d');

        $pnpki->update([
            'renewal_status' => 'rejected',
            'pending_expiration_date' => null,
            'pending_proof_pdf_path' => null,
            'pending_proof_original_name' => null,
            'pending_signature_image_path' => null,
            'renewal_reviewed_at' => now(),
            'renewal_reviewed_by' => $admin->id,
            'renewal_rejection_reason' => $reason ?: 'Renewal proof or expiration date could not be verified by the Super Administrator.',
        ]);

        $reasonSuffix = $reason ? " Reason: {$reason}." : '';
        SystemNotification::notify(
            $targetUser->id,
            'PNPKI Digital E-Signature Renewal Disapproved',
            "Your PNPKI Digital E-Signature renewal request (Requested Expiration: {$rejectedExpDate}) was disapproved by the Super Administrator.{$reasonSuffix} Please submit a valid renewal request.",
            null,
            'danger'
        );

        AuditLog::log(
            'USER_PNPKI_RENEWAL_REJECTED',
            'pnpki_signatures',
            $targetUser->id,
            ['pending_expiration_date' => $rejectedExpDate],
            ['reason' => $reason],
            $admin->id
        );

        return response()->json([
            'message' => "PNPKI Digital E-Signature renewal request for {$targetUser->name} has been disapproved.",
            'user' => $targetUser->fresh(['office', 'accountCodes', 'pnpkiSignature']),
        ]);
    }

    public function pnpkiRegistry(Request $request): JsonResponse
    {
        $currentUser = $request->user();

        $query = \App\Models\PnpkiSignature::with(['user.office:id,name,code'])
            ->where(function ($q) {
                $q->where('signature_type', 'pnpki')
                    ->orWhereNotNull('expiration_date')
                    ->orWhereNotNull('previous_expiration_date')
                    ->orWhere('renewal_status', 'pending')
                    ->orWhere('renewal_count', '>', 0);
            })
            ->whereHas('user');

        if (!$currentUser->isAdmin()) {
            $query->where('user_id', $currentUser->id);
        }

        $records = $query->latest('updated_at')
            ->get()
            ->map(function ($sig) {
                $user = $sig->user;
                $rawHistory = is_array($sig->renewal_history) ? $sig->renewal_history : [];
                $formattedHistory = [];
                foreach ($rawHistory as $idx => $entry) {
                    $hasFile = !empty($entry['proof_pdf_path']);
                    $formattedHistory[] = [
                        'index' => $idx,
                        'expiration_date' => $entry['expiration_date'] ?? null,
                        'proof_original_name' => $entry['proof_original_name'] ?? null,
                        'archived_at' => $entry['archived_at'] ?? null,
                        'proof_pdf_url' => $hasFile ? '/api/users/' . User::encryptId((int) $sig->user_id) . "/pnpki-proof?version=history&index={$idx}" : null,
                    ];
                }

                return [
                    'id' => $sig->id,
                    'user_id' => $sig->user_id,
                    'user' => [
                        'id' => $user->id,
                        'encrypted_id' => User::encryptId((int) $user->id),
                        'name' => $user->name,
                        'email' => $user->email,
                        'designation' => $user->designation,
                        'role' => $user->role,
                        'office' => $user->office,
                        'signature_path' => $user->signature_path,
                        'pnpki_signature' => $sig,
                    ],
                    'signature_type' => $sig->signature_type,
                    'effective_signature_type' => $sig->effective_signature_type,
                    'expiration_date' => $sig->expiration_date?->format('Y-m-d'),
                    'is_expired' => $sig->is_expired,
                    'is_expiring_soon' => $sig->is_expiring_soon,
                    'days_until_expiration' => $sig->days_until_expiration,
                    'is_forced_optional' => $sig->is_forced_optional,
                    'proof_original_name' => $sig->proof_original_name,
                    'proof_pdf_url' => $sig->proof_pdf_url,
                    'previous_expiration_date' => $sig->previous_expiration_date?->format('Y-m-d'),
                    'previous_proof_original_name' => $sig->previous_proof_original_name,
                    'previous_proof_pdf_url' => $sig->previous_proof_pdf_url,
                    'renewal_status' => $sig->renewal_status ?? 'none',
                    'is_renewal_pending' => $sig->is_renewal_pending,
                    'pending_expiration_date' => $sig->pending_expiration_date?->format('Y-m-d'),
                    'pending_proof_original_name' => $sig->pending_proof_original_name,
                    'pending_proof_pdf_url' => $sig->pending_proof_pdf_url,
                    'renewal_submitted_at' => $sig->renewal_submitted_at?->toIso8601String(),
                    'renewal_rejection_reason' => $sig->renewal_rejection_reason,
                    'renewed_at' => $sig->renewed_at?->toIso8601String(),
                    'renewal_count' => (int) ($sig->renewal_count ?? 0),
                    'renewal_history' => array_reverse($formattedHistory),
                    'updated_at' => $sig->updated_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'pnpki_signatures' => $records,
        ]);
    }
}
