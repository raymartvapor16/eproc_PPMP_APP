<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SystemRequestController extends Controller
{
    protected function resolveSessionId(Request $request): ?string
    {
        return ($request->hasSession() && $request->cookies->has(config('session.cookie')))
            ? $request->session()->getId()
            : null;
    }

    protected function buildAttachmentUrl(Request $request, User $user, int $requestId, int $ttlSeconds = 120): string
    {
        $sessionId = $this->resolveSessionId($request);
        $token = SystemRequest::encryptAttachmentId($requestId, (int) $user->id, $sessionId, $ttlSeconds);

        return '/api/system-requests/' . $token . '/attachment';
    }

    protected function formatRecord(Request $request, User $viewer, SystemRequest $sr): array
    {
        return [
            'id' => $sr->id,
            'ticket_number' => $sr->ticket_number,
            'request_type' => $sr->request_type,
            'system_module' => $sr->system_module,
            'priority' => $sr->priority,
            'subject' => $sr->subject,
            'description' => $sr->description,
            'status' => $sr->status,
            'admin_remarks' => $sr->admin_remarks,
            'has_attachment' => !empty($sr->attachment_path),
            'attachment_original_name' => $sr->attachment_original_name,
            'attachment_size' => $sr->attachment_size,
            'attachment_url' => !empty($sr->attachment_path) ? $this->buildAttachmentUrl($request, $viewer, (int) $sr->id) : null,
            'user' => $sr->user ? [
                'id' => $sr->user->id,
                'name' => $sr->user->name,
                'email' => $sr->user->email,
                'role' => $sr->user->role,
            ] : null,
            'office' => $sr->office ? [
                'id' => $sr->office->id,
                'name' => $sr->office->name,
                'code' => $sr->office->code,
            ] : null,
            'handler' => $sr->handler ? [
                'id' => $sr->handler->id,
                'name' => $sr->handler->name,
            ] : null,
            'resolved_at' => $sr->resolved_at?->toDateTimeString(),
            'created_at' => $sr->created_at?->toDateTimeString(),
            'updated_at' => $sr->updated_at?->toDateTimeString(),
        ];
    }

    public function generateTicket(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $year = now()->format('Y');
        $ticketNumber = null;

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $randomPart = strtoupper(bin2hex(random_bytes(3)));
            $candidate = "SR-{$year}-{$randomPart}";
            if (!SystemRequest::where('ticket_number', $candidate)->exists()) {
                $ticketNumber = $candidate;
                break;
            }
        }

        if (!$ticketNumber) {
            $ticketNumber = 'SR-' . $year . '-' . strtoupper(Str::random(8));
        }

        $ticketToken = SystemRequest::encryptTicketToken($ticketNumber, (int) $user->id, 1800);

        return response()->json([
            'ticket_number' => $ticketNumber,
            'ticket_token' => $ticketToken,
            'expires_in_minutes' => 30,
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'ticket_number' => 'required|string|max:40',
            'ticket_token' => 'required|string',
            'request_type' => 'required|in:bug_fix,enhancement',
            'system_module' => 'required|in:eproc_ppmp_app,pims,monitoring,supplier_evaluation,general',
            'priority' => 'required|in:low,medium,high,urgent',
            'subject' => 'required|string|min:4|max:180',
            'description' => 'required|string|min:10|max:3000',
            'attachment' => 'nullable|file|mimes:jpeg,jpg,png,webp|mimetypes:image/jpeg,image/png,image/webp|max:5120',
        ], [
            'attachment.mimes' => 'Only image files (JPG, PNG, WEBP) are allowed.',
            'attachment.mimetypes' => 'Only valid image files (JPG, PNG, WEBP) are allowed.',
            'attachment.max' => 'Image attachment must not exceed 5 MB.',
        ]);

        $ticketNumber = trim($validated['ticket_number']);
        $tokenCheck = SystemRequest::verifyTicketToken($validated['ticket_token'], $ticketNumber, (int) $user->id);
        if (!$tokenCheck['valid']) {
            return response()->json(['message' => $tokenCheck['error']], 422);
        }

        if (SystemRequest::where('ticket_number', $ticketNumber)->exists()) {
            return response()->json([
                'message' => 'This ticket number has already been submitted. Please generate a new ticket.',
            ], 422);
        }

        $attachmentPath = null;
        $attachmentOrigName = null;
        $attachmentMime = null;
        $attachmentSize = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            if (!$file->isValid()) {
                return response()->json(['message' => 'Uploaded image is invalid or corrupted.'], 422);
            }

            $realPath = $file->getRealPath();
            $imageInfo = $realPath ? @getimagesize($realPath) : false;
            $allowedTypes = [
                IMAGETYPE_JPEG => ['ext' => 'jpg', 'mime' => 'image/jpeg'],
                IMAGETYPE_PNG => ['ext' => 'png', 'mime' => 'image/png'],
                IMAGETYPE_WEBP => ['ext' => 'webp', 'mime' => 'image/webp'],
            ];

            if ($imageInfo === false || !isset($allowedTypes[$imageInfo[2]])) {
                return response()->json([
                    'message' => 'Invalid image content detected. Only genuine JPG, PNG, or WEBP images up to 5 MB are accepted.',
                ], 422);
            }

            $detected = $allowedTypes[$imageInfo[2]];
            $safeFileName = Str::uuid()->toString() . '.' . $detected['ext'];
            $attachmentPath = Storage::disk('local')->putFileAs('private/system_requests', $file, $safeFileName);
            $attachmentOrigName = Str::limit(preg_replace('/[^A-Za-z0-9._\-\s]/', '', (string) $file->getClientOriginalName()), 160, '');
            $attachmentMime = $detected['mime'];
            $attachmentSize = (int) $file->getSize();
        }

        $cleanSubject = strip_tags(trim($validated['subject']));
        $cleanDescription = strip_tags(trim($validated['description']));

        $sr = SystemRequest::create([
            'ticket_number' => $ticketNumber,
            'user_id' => $user->id,
            'office_id' => $user->office_id,
            'request_type' => $validated['request_type'],
            'system_module' => $validated['system_module'],
            'priority' => $validated['priority'],
            'subject' => $cleanSubject,
            'description' => $cleanDescription,
            'attachment_path' => $attachmentPath,
            'attachment_original_name' => $attachmentOrigName ?: null,
            'attachment_mime' => $attachmentMime,
            'attachment_size' => $attachmentSize,
            'status' => 'pending',
            'ip_address' => $request->ip(),
        ]);

        $sr->load(['user', 'office', 'handler']);

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'SYSTEM_REQUEST_CREATED',
                'system_requests',
                $sr->id,
                null,
                [
                    'ticket_number' => $sr->ticket_number,
                    'request_type' => $sr->request_type,
                    'system_module' => $sr->system_module,
                    'priority' => $sr->priority,
                ],
                $user->id
            );
        }

        return response()->json([
            'message' => "System request {$sr->ticket_number} submitted successfully.",
            'data' => $this->formatRecord($request, $user, $sr),
        ], 201);
    }

    public function myRequests(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $items = SystemRequest::with(['user', 'office', 'handler'])
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (SystemRequest $sr) => $this->formatRecord($request, $user, $sr));

        return response()->json(['data' => $items]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $query = SystemRequest::with(['user', 'office', 'handler']);

        $status = strtolower(trim((string) $request->input('status', '')));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $type = strtolower(trim((string) $request->input('request_type', '')));
        if ($type !== '' && $type !== 'all') {
            $query->where('request_type', $type);
        }

        $priority = strtolower(trim((string) $request->input('priority', '')));
        if ($priority !== '' && $priority !== 'all') {
            $query->where('priority', $priority);
        }

        $module = strtolower(trim((string) $request->input('system_module', '')));
        if ($module !== '' && $module !== 'all') {
            $query->where('system_module', $module);
        }

        $search = trim((string) $request->input('search', ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('office', function ($oq) use ($search) {
                        $oq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = max(5, min(50, $request->integer('per_page', 15)));
        $paginated = $query->orderByDesc('created_at')->paginate($perPage);

        $items = collect($paginated->items())->map(fn (SystemRequest $sr) => $this->formatRecord($request, $user, $sr));

        $counts = [
            'total' => SystemRequest::count(),
            'pending' => SystemRequest::where('status', 'pending')->count(),
            'in_progress' => SystemRequest::where('status', 'in_progress')->count(),
            'resolved' => SystemRequest::where('status', 'resolved')->count(),
            'rejected' => SystemRequest::where('status', 'rejected')->count(),
            'bug_fix' => SystemRequest::where('request_type', 'bug_fix')->count(),
            'enhancement' => SystemRequest::where('request_type', 'enhancement')->count(),
        ];

        return response()->json([
            'data' => $items,
            'counts' => $counts,
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,in_progress,resolved,rejected',
            'admin_remarks' => 'nullable|string|max:2000',
        ]);

        $sr = SystemRequest::findOrFail($id);
        $oldStatus = $sr->status;

        $sr->status = $validated['status'];
        if (array_key_exists('admin_remarks', $validated)) {
            $sr->admin_remarks = $validated['admin_remarks'] !== null
                ? strip_tags(trim((string) $validated['admin_remarks']))
                : null;
        }
        $sr->handled_by = $user->id;
        $sr->resolved_at = in_array($validated['status'], ['resolved', 'rejected'], true) ? now() : null;
        $sr->save();

        $sr->load(['user', 'office', 'handler']);

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'SYSTEM_REQUEST_UPDATED',
                'system_requests',
                $sr->id,
                ['status' => $oldStatus],
                ['status' => $sr->status, 'ticket_number' => $sr->ticket_number],
                $user->id
            );
        }

        return response()->json([
            'message' => "Ticket {$sr->ticket_number} updated to " . str_replace('_', ' ', strtoupper($sr->status)) . '.',
            'data' => $this->formatRecord($request, $user, $sr),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $sr = SystemRequest::findOrFail($id);
        $ticketNumber = $sr->ticket_number;

        if ($sr->attachment_path && Storage::disk('local')->exists($sr->attachment_path)) {
            Storage::disk('local')->delete($sr->attachment_path);
        }

        $sr->delete();

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'SYSTEM_REQUEST_DELETED',
                'system_requests',
                $id,
                ['ticket_number' => $ticketNumber],
                null,
                $user->id
            );
        }

        return response()->json([
            'message' => "System request {$ticketNumber} deleted.",
        ]);
    }

    public function refreshAttachmentToken(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $sessionId = $this->resolveSessionId($request);
        $tokenCheck = SystemRequest::decryptAttachmentToken($id, (int) $user->id, $sessionId, false);
        if (!$tokenCheck['id']) {
            return response()->json(['message' => $tokenCheck['error'] ?? 'Invalid or unencrypted attachment reference.'], 403);
        }

        $sr = SystemRequest::findOrFail($tokenCheck['id']);
        if (!$user->isSuperAdmin() && (int) $sr->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Unauthorized. You do not have permission to access this attachment.'], 403);
        }

        $freshToken = SystemRequest::encryptAttachmentId((int) $sr->id, (int) $user->id, $sessionId, 120);

        return response()->json([
            'encrypted_id' => $freshToken,
            'attachment_url' => '/api/system-requests/' . $freshToken . '/attachment',
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    }

    public function viewAttachment(Request $request, string $id): BinaryFileResponse|JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $sessionId = $this->resolveSessionId($request);
        $tokenCheck = SystemRequest::decryptAttachmentToken($id, (int) $user->id, $sessionId, true);
        if (!$tokenCheck['id']) {
            return response()->json(['message' => $tokenCheck['error'] ?? 'Invalid or unencrypted attachment reference.'], 403);
        }

        $sr = SystemRequest::findOrFail($tokenCheck['id']);
        if (!$user->isSuperAdmin() && (int) $sr->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Unauthorized. You do not have permission to view this attachment.'], 403);
        }

        if (!$sr->attachment_path || !Storage::disk('local')->exists($sr->attachment_path)) {
            return response()->json(['message' => 'Attachment image not found.'], 404);
        }

        $fullPath = Storage::disk('local')->path($sr->attachment_path);

        return response()->file($fullPath, [
            'Content-Type' => $sr->attachment_mime ?: 'image/png',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
