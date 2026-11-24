<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\User;
use App\Support\ReviewHeadResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PpmpAttachmentController extends Controller
{

    public function store(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreator = $ppmp->created_by === $user->id;
        $isBeforeFormalReview = in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED',
        ]);

        $canUpload = ($isCreator && $isBeforeFormalReview) || $user->isAdmin();

        if (!$canUpload) {
            return response()->json([
                'message' => 'Only the end-user (creator) can attach documents or pictures to this PPMP.'
            ], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
        ]);

        $uploadedFile = $request->file('file');
        $origName = $uploadedFile->getClientOriginalName();
        $mime = $uploadedFile->getMimeType();
        $extension = strtolower($uploadedFile->getClientOriginalExtension());

        if (preg_match('/\.(php|phtml|phar|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.(pdf|jpg|jpeg|png|webp)$/i', $origName)) {
            return response()->json(['message' => 'Disguised executable file naming detected. Upload rejected for security reasons.'], 422);
        }

        $allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
        ];

        if (!in_array($mime, $allowedMimes)) {
            return response()->json(['message' => 'Only PDF documents or image files (JPG, PNG, WebP) are allowed.'], 422);
        }

        if ($mime === 'application/pdf') {
            $handle = fopen($uploadedFile->getRealPath(), 'rb');
            $header = fread($handle, 5);
            fclose($handle);
            if ($header !== '%PDF-') {
                return response()->json(['message' => 'Invalid file content. Must be a valid PDF document (%PDF- signature).'], 422);
            }
            $fileExt = 'pdf';
        } else {
            $handle = fopen($uploadedFile->getRealPath(), 'rb');
            $imgHeader = fread($handle, 12);
            fclose($handle);
            $isValidImg = false;
            if (str_starts_with($imgHeader, "\xFF\xD8\xFF")) {
                $isValidImg = true;
                $fileExt = 'jpg';
            } elseif (str_starts_with($imgHeader, "\x89PNG\x0D\x0A\x1A\x0A")) {
                $isValidImg = true;
                $fileExt = 'png';
            } elseif (str_starts_with($imgHeader, "RIFF") && substr($imgHeader, 8, 4) === "WEBP") {
                $isValidImg = true;
                $fileExt = 'webp';
            }
            if (!$isValidImg) {
                return response()->json(['message' => 'Security Error: File content does not match genuine image binary signature.'], 422);
            }
        }

        $internalFilename = (string) Str::uuid() . '.' . $fileExt;
        $directory = 'ppmp/' . $ppmp->id;

        $path = $uploadedFile->storeAs($directory, $internalFilename, 'local');

        $requestedType = $request->input('attachment_type');
        $origName = basename($uploadedFile->getClientOriginalName());
        $isMarketScoping = (
            $requestedType === 'MARKET_SCOPING' ||
            stripos($origName, 'market') !== false ||
            stripos($origName, 'scoping') !== false
        );

        $attachmentType = $requestedType ?: ($isMarketScoping ? 'MARKET_SCOPING' : 'SUPPORTING_DOC');

        $attachment = PpmpAttachment::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $ppmp->id,
            'uploaded_by' => $user->id,
            'original_filename' => $origName,
            'stored_filename' => $internalFilename,
            'storage_path' => $path,
            'mime_type' => $mime,
            'attachment_type' => $attachmentType,
            'file_size' => $uploadedFile->getSize(),
        ]);

        AuditLog::log('ATTACHMENT_UPLOADED', 'ppmp_attachments', $attachment->id, null, [
            'filename' => $attachment->original_filename,
            'type' => $attachment->attachment_type,
            'size' => $attachment->file_size
        ], $user->id);

        return response()->json([
            'message' => 'Attachment uploaded securely.',
            'attachment' => $attachment->load('uploader'),
        ], 201);
    }

    public function storeLink(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreator = $ppmp->created_by === $user->id;
        $isBeforeFormalReview = in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED',
        ]);

        $canUpload = ($isCreator && $isBeforeFormalReview) || $user->isAdmin();
        if (!$canUpload) {
            return response()->json([
                'message' => 'Only the end-user (creator) can attach documents or links to this PPMP.'
            ], 403);
        }

        $isInfra = Str::contains(strtolower($ppmp->project_type ?? ''), 'infra') ||
            $ppmp->items()->whereRaw('LOWER(project_type) LIKE ?', ['%infra%'])->exists();

        if (!$isInfra) {
            return response()->json([
                'message' => 'External cloud storage links are restricted to Infrastructure Projects only.'
            ], 422);
        }

        $validated = $request->validate([
            'url' => 'required|string|max:2048',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $rawUrl = trim($validated['url']);

        if (!preg_match('/^https:\/\//i', $rawUrl)) {
            return response()->json([
                'message' => 'Security Error: Only secure SSL/TLS encrypted web URLs (https://) are accepted.'
            ], 422);
        }

        $parsed = parse_url($rawUrl);
        if (!$parsed || empty($parsed['host'])) {
            return response()->json([
                'message' => 'Invalid URL structure.'
            ], 422);
        }

        $host = strtolower($parsed['host']);

        if (
            in_array($host, ['localhost', '127.0.0.1', '::1'], true) ||
            preg_match('/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/', $host)
        ) {
            return response()->json([
                'message' => 'Security Error: Links to local or private internal networks are strictly prohibited.'
            ], 422);
        }

        $attachment = PpmpAttachment::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $ppmp->id,
            'uploaded_by' => $user->id,
            'original_filename' => $validated['title'],
            'stored_filename' => 'external_link',
            'storage_path' => $rawUrl,
            'external_url' => $rawUrl,
            'link_description' => $validated['description'] ?? null,
            'mime_type' => 'application/x-external-link',
            'attachment_type' => 'INFRA_OTHER_DOC',
            'file_size' => 0,
        ]);

        AuditLog::log('ATTACHMENT_LINK_ADDED', 'ppmp_attachments', $attachment->id, null, [
            'title' => $attachment->original_filename,
            'url' => $attachment->external_url,
            'type' => $attachment->attachment_type,
        ], $user->id);

        return response()->json([
            'message' => 'Infrastructure cloud document link attached successfully.',
            'attachment' => $attachment->load('uploader'),
        ], 201);
    }

    public function updateType(Request $request, string $uuid, string $attachmentUuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $resolvedUuid = PpmpAttachment::decryptUuid($attachmentUuid);

        $attachment = PpmpAttachment::where('ppmp_id', $ppmp->id)
            ->where(function ($q) use ($attachmentUuid, $resolvedUuid) {
                $q->where('uuid', $attachmentUuid)->orWhere('uuid', $resolvedUuid);
            })
            ->firstOrFail();

        $isCreator = $ppmp->created_by === $user->id;
        if (!$isCreator && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized to update attachment type.'], 403);
        }

        $validated = $request->validate([
            'attachment_type' => 'required|string|in:MARKET_SCOPING,SUPPORTING_DOC,APP_DOCUMENT,ATTACHMENT_LIST_DOC,REQUEST_LETTER,INFRA_OTHER_DOC',
        ]);

        $attachment->update([
            'attachment_type' => $validated['attachment_type'],
        ]);

        return response()->json([
            'message' => 'Attachment type updated successfully.',
            'attachment' => $attachment->fresh(['uploader']),
        ]);
    }

    public function download(Request $request, string $uuid, string $attachmentUuid): BinaryFileResponse|JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $resolvedUuid = PpmpAttachment::decryptUuid($attachmentUuid);

        $ancestorIds = [];
        $curr = $ppmp;
        $maxDepth = 25;
        $depth = 0;
        while ($curr && $depth < $maxDepth) {
            if (in_array($curr->id, $ancestorIds, true)) {
                break;
            }
            $ancestorIds[] = $curr->id;
            $depth++;
            $curr = $curr->parent;
        }

        $attachment = PpmpAttachment::whereIn('ppmp_id', $ancestorIds)
            ->where(function ($q) use ($resolvedUuid, $attachmentUuid) {
                $q->where('uuid', $resolvedUuid)
                    ->orWhere('uuid', $attachmentUuid);
            })
            ->firstOrFail();

        $this->authorizeAttachmentAccess($user, $ppmp, $attachment);

        if ($attachment->external_url || $attachment->mime_type === 'application/x-external-link') {
            return response()->json([
                'is_external_link' => true,
                'external_url' => $attachment->external_url ?: $attachment->storage_path,
                'title' => $attachment->original_filename,
            ]);
        }

        if (!Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'Attachment file not found on disk.'], 404);
        }

        $fullPath = Storage::disk('local')->path($attachment->storage_path);

        AuditLog::log('ATTACHMENT_DOWNLOADED', 'ppmp_attachments', $attachment->id, null, [
            'filename' => $attachment->original_filename
        ], $user->id);

        $safeFilename = preg_replace('/[\r\n"\'\\\\]+/', '_', $attachment->original_filename);

        return response()->download($fullPath, $safeFilename, [
            'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function view(Request $request, string $uuid, string $attachmentUuid): BinaryFileResponse|JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $resolvedUuid = PpmpAttachment::decryptUuid($attachmentUuid);

        $ancestorIds = [];
        $curr = $ppmp;
        $maxDepth = 25;
        $depth = 0;
        while ($curr && $depth < $maxDepth) {
            if (in_array($curr->id, $ancestorIds, true)) {
                break;
            }
            $ancestorIds[] = $curr->id;
            $depth++;
            $curr = $curr->parent;
        }

        $attachment = PpmpAttachment::whereIn('ppmp_id', $ancestorIds)
            ->where(function ($q) use ($resolvedUuid, $attachmentUuid) {
                $q->where('uuid', $resolvedUuid)
                    ->orWhere('uuid', $attachmentUuid);
            })
            ->firstOrFail();

        $this->authorizeAttachmentAccess($user, $ppmp, $attachment);

        if ($attachment->external_url || $attachment->mime_type === 'application/x-external-link') {
            return response()->json([
                'is_external_link' => true,
                'external_url' => $attachment->external_url ?: $attachment->storage_path,
                'title' => $attachment->original_filename,
            ]);
        }

        if (!Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'Attachment file not found on disk.'], 404);
        }

        $fullPath = Storage::disk('local')->path($attachment->storage_path);
        $safeFilename = preg_replace('/[\r\n"\'\\\\]+/', '_', $attachment->original_filename);

        return response()->file($fullPath, [
            'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="' . $safeFilename . '"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(Request $request, string $uuid, string $attachmentUuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $resolvedUuid = PpmpAttachment::decryptUuid($attachmentUuid);

        $attachment = PpmpAttachment::where('ppmp_id', $ppmp->id)
            ->where(function ($q) use ($resolvedUuid, $attachmentUuid) {
                $q->where('uuid', $resolvedUuid)
                    ->orWhere('uuid', $attachmentUuid);
            })
            ->firstOrFail();

        $isCreator = $ppmp->created_by === $user->id;
        $isBeforeFormalReview = in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED',
        ]);

        $canDelete = ($isCreator && $isBeforeFormalReview) || $user->isAdmin();

        if (!$canDelete) {
            return response()->json(['message' => 'You cannot remove attachments from this PPMP in its current status.'], 403);
        }

        if (!$attachment->external_url && $attachment->mime_type !== 'application/x-external-link') {
            if (Storage::disk('local')->exists($attachment->storage_path)) {
                Storage::disk('local')->delete($attachment->storage_path);
            }
        }

        $filename = $attachment->original_filename;
        $attachmentId = $attachment->id;
        $attachment->delete();

        AuditLog::log('ATTACHMENT_DELETED', 'ppmp_attachments', $attachmentId, ['filename' => $filename], null, $user->id);

        return response()->json(['message' => 'Attachment removed successfully.']);
    }

    private function authorizeAttachmentAccess(User $user, Ppmp $ppmp, ?PpmpAttachment $attachment = null): void
    {
        if ($user->isAdmin()) {
            return;
        }

        if ($attachment && $attachment->attachment_type === 'REQUEST_LETTER') {
            if ($user->isAdmin() || $user->isBudgetOfficer() || $user->isOppmo() || $user->isTwg() || $user->isPacco() || $user->id === $ppmp->created_by) {
                return;
            }
        }

        if ($user->isBudgetOfficer() || $user->isOppmo() || $user->isTwg() || $user->isPacco()) {
            if ($ppmp->status !== 'DRAFT') {
                return;
            }
        }

        if ($user->isHead()) {
            if ($user->office_id === $ppmp->office_id) {
                return;
            }
            $headStages = ReviewHeadResolver::userStagesForHead($user);
            if (!empty($headStages) && $ppmp->status !== 'DRAFT') {
                return;
            }
        }

        if ($user->id === $ppmp->created_by) {
            return;
        }

        abort(403, 'Unauthorized. You do not have permission to access attachments for this PPMP.');
    }
}
