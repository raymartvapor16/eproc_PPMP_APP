<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OppmoTeamMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OppmoTeamController extends Controller
{
    /**
     * Public list of active team members for the landing page
     */
    public function publicIndex(): JsonResponse
    {
        $members = OppmoTeamMember::active()->get();
        return response()->json($members);
    }

    /**
     * Super Admin list of all team members
     */
    public function index(Request $request): JsonResponse
    {
        $members = OppmoTeamMember::orderBy('sort_order', 'asc')->orderBy('id', 'asc')->get();
        return response()->json($members);
    }

    /**
     * Super Admin create team member
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'position' => 'required|string|max:255',
            'division' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'photo_url' => 'nullable|string',
            'email' => 'nullable|string|email|max:255',
            'sort_order' => 'nullable|integer',
            'status' => 'required|in:active,inactive',
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:5120', // Strictly allowed image types only
        ]);

        $photoUrl = $validated['photo_url'] ?? null;

        if ($request->hasFile('photo')) {
            $photoFile = $request->file('photo');
            $ext = strtolower($photoFile->getClientOriginalExtension());
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
                return response()->json(['message' => 'Invalid image format. Allowed formats: JPG, PNG, WebP.'], 422);
            }
            $rawHeader = file_get_contents($photoFile->getRealPath(), false, null, 0, 12);
            $isValidImage = (
                substr($rawHeader, 0, 3) === "\xFF\xD8\xFF" || // JPEG
                substr($rawHeader, 0, 8) === "\x89PNG\r\n\x1a\n" || // PNG
                (substr($rawHeader, 0, 4) === "RIFF" && substr($rawHeader, 8, 4) === "WEBP") // WebP
            );
            if (!$isValidImage) {
                return response()->json(['message' => 'Uploaded file is not a valid image.'], 422);
            }
            $safeName = (string) \Illuminate\Support\Str::uuid() . '.' . $ext;
            $photoFile->storeAs('oppmo_team', $safeName, 'local');
            $photoUrl = '/api/oppmo-team-photo/' . $safeName;
        }

        $member = OppmoTeamMember::create([
            'name' => $validated['name'],
            'position' => $validated['position'],
            'division' => $validated['division'] ?? null,
            'bio' => $validated['bio'] ?? null,
            'photo_url' => $photoUrl,
            'email' => $validated['email'] ?? null,
            'sort_order' => $validated['sort_order'] ?? (OppmoTeamMember::max('sort_order') + 1),
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'OPPMO team member added successfully.',
            'member' => $member,
        ], 201);
    }

    /**
     * Super Admin update team member
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $member = OppmoTeamMember::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'position' => 'sometimes|required|string|max:255',
            'division' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'photo_url' => 'nullable|string',
            'email' => 'nullable|string|email|max:255',
            'sort_order' => 'nullable|integer',
            'status' => 'sometimes|required|in:active,inactive',
            'photo' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $photoUrl = $validated['photo_url'] ?? $member->photo_url;

        if ($request->hasFile('photo')) {
            $photoFile = $request->file('photo');
            $ext = strtolower($photoFile->getClientOriginalExtension());
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
                return response()->json(['message' => 'Invalid image format. Allowed formats: JPG, PNG, WebP.'], 422);
            }
            $rawHeader = file_get_contents($photoFile->getRealPath(), false, null, 0, 12);
            $isValidImage = (
                substr($rawHeader, 0, 3) === "\xFF\xD8\xFF" || // JPEG
                substr($rawHeader, 0, 8) === "\x89PNG\r\n\x1a\n" || // PNG
                (substr($rawHeader, 0, 4) === "RIFF" && substr($rawHeader, 8, 4) === "WEBP") // WebP
            );
            if (!$isValidImage) {
                return response()->json(['message' => 'Uploaded file is not a valid image.'], 422);
            }

            // Remove old photo from storage if exists
            if ($member->photo_url) {
                $oldFilename = basename($member->photo_url);
                if (Storage::disk('local')->exists('oppmo_team/' . $oldFilename)) {
                    Storage::disk('local')->delete('oppmo_team/' . $oldFilename);
                }
            }

            $safeName = (string) \Illuminate\Support\Str::uuid() . '.' . $ext;
            $photoFile->storeAs('oppmo_team', $safeName, 'local');
            $photoUrl = '/api/oppmo-team-photo/' . $safeName;
        }

        $member->update([
            'name' => $validated['name'],
            'position' => $validated['position'],
            'division' => $validated['division'] ?? null,
            'bio' => $validated['bio'] ?? null,
            'photo_url' => $photoUrl,
            'email' => $validated['email'] ?? null,
            'sort_order' => $validated['sort_order'] ?? $member->sort_order,
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'OPPMO team member updated successfully.',
            'member' => $member,
        ]);
    }

    /**
     * Super Admin delete team member
     */
    public function destroy(int $id): JsonResponse
    {
        $member = OppmoTeamMember::findOrFail($id);

        if ($member->photo_url) {
            $oldFilename = basename($member->photo_url);
            if (Storage::disk('local')->exists('oppmo_team/' . $oldFilename)) {
                Storage::disk('local')->delete('oppmo_team/' . $oldFilename);
            }
        }

        $member->delete();

        return response()->json([
            'message' => 'OPPMO team member removed successfully.',
        ]);
    }

    /**
     * Super Admin toggle active status
     */
    public function toggleStatus(int $id): JsonResponse
    {
        $member = OppmoTeamMember::findOrFail($id);
        $member->status = $member->status === 'active' ? 'inactive' : 'active';
        $member->save();

        return response()->json([
            'message' => "Team member status updated to {$member->status}.",
            'member' => $member,
        ]);
    }

    /**
     * Serve team member photo securely from storage/app/private/oppmo_team/
     */
    public function getPhoto(string $filename)
    {
        $safeName = basename($filename);
        $path = 'oppmo_team/' . $safeName;

        if (Storage::disk('local')->exists($path)) {
            $fullPath = Storage::disk('local')->path($path);
            $mime = mime_content_type($fullPath) ?: 'image/jpeg';

            return response()->file($fullPath, [
                'Content-Type' => $mime,
                'Cache-Control' => 'public, max-age=86400',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        if (Storage::disk('public')->exists($path)) {
            $fullPath = Storage::disk('public')->path($path);
            $mime = mime_content_type($fullPath) ?: 'image/jpeg';

            return response()->file($fullPath, [
                'Content-Type' => $mime,
                'Cache-Control' => 'public, max-age=86400',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        return response()->json(['message' => 'Team member photo not found.'], 404);
    }
}
