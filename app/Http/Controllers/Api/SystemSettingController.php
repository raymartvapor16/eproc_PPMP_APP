<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemSettingController extends Controller
{
    /**
     * Get the developer mode status (Public / Authenticated).
     */
    public function getDeveloperMode(): JsonResponse
    {
        return response()->json([
            'developer_mode' => SystemSetting::isDeveloperMode(),
        ]);
    }

    /**
     * Update developer mode (Super Admin only).
     */
    public function updateDeveloperMode(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized. Super Administrator access is strictly required to modify developer mode settings.',
            ], 403);
        }

        $validated = $request->validate([
            'developer_mode' => 'required|boolean',
        ]);

        $oldMode = SystemSetting::isDeveloperMode();
        $newMode = (bool) $validated['developer_mode'];

        SystemSetting::set('developer_mode', $newMode);

        AuditLog::log(
            'DEVELOPER_MODE_TOGGLED',
            'system_settings',
            null,
            ['developer_mode' => $oldMode],
            ['developer_mode' => $newMode],
            $user->id
        );

        return response()->json([
            'message' => $newMode 
                ? 'Developer Mode has been ENABLED. Inspection and DevTools access are now allowed.' 
                : 'Developer Mode has been DISABLED. Inspection and DevTools are strictly restricted.',
            'developer_mode' => $newMode,
        ]);
    }

    /**
     * Get signature insertion settings for PPMP, APP, and Attachment List.
     */
    public function getSignatureSettings(): JsonResponse
    {
        $settings = SystemSetting::getSignatureSettings();
        return response()->json([
            'signature_settings' => $settings,
            'settings' => $settings,
        ]);
    }

    /**
     * Update signature insertion settings (Super Admin only).
     */
    public function updateSignatureSettings(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized. Super Administrator access is strictly required to modify signature insertion controllers.',
            ], 403);
        }

        $validated = $request->validate([
            'ppmp' => 'nullable|boolean',
            'app' => 'nullable|boolean',
            'attachment_list' => 'nullable|boolean',
        ]);

        $oldSettings = SystemSetting::getSignatureSettings();

        if (array_key_exists('ppmp', $validated)) {
            SystemSetting::set('signature_insertion_ppmp', (bool) $validated['ppmp']);
        }
        if (array_key_exists('app', $validated)) {
            SystemSetting::set('signature_insertion_app', (bool) $validated['app']);
        }
        if (array_key_exists('attachment_list', $validated)) {
            SystemSetting::set('signature_insertion_attachment_list', (bool) $validated['attachment_list']);
        }

        $newSettings = SystemSetting::getSignatureSettings();

        AuditLog::log(
            'SIGNATURE_CONTROLLER_UPDATED',
            'system_settings',
            null,
            ['signature_settings' => $oldSettings],
            ['signature_settings' => $newSettings],
            $user->id
        );

        return response()->json([
            'message' => 'Signature insertion controllers updated successfully.',
            'signature_settings' => $newSettings,
            'settings' => $newSettings,
        ]);
    }
}

