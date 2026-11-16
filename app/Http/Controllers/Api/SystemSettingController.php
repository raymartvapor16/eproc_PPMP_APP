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

    /**
     * Get AFK inactivity auto-logout settings.
     */
    public function getAfkLogoutSettings(): JsonResponse
    {
        $enabled = SystemSetting::get('afk_logout_enabled', true);
        $timeoutMinutes = (int) SystemSetting::get('afk_logout_timeout_minutes', 15);
        $warningSeconds = (int) SystemSetting::get('afk_logout_warning_seconds', 60);

        return response()->json([
            'enabled' => (bool) $enabled,
            'timeout_minutes' => $timeoutMinutes > 0 ? $timeoutMinutes : 15,
            'warning_seconds' => $warningSeconds > 0 ? $warningSeconds : 60,
        ]);
    }

    /**
     * Update AFK inactivity auto-logout settings (Super Admin only).
     */
    public function updateAfkLogoutSettings(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized. Super Administrator access is strictly required to modify AFK auto-logout security settings.',
            ], 403);
        }

        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'timeout_minutes' => 'required|integer|min:1|max:480',
            'warning_seconds' => 'nullable|integer|min:10|max:300',
        ]);

        $oldSettings = [
            'enabled' => (bool) SystemSetting::get('afk_logout_enabled', true),
            'timeout_minutes' => (int) SystemSetting::get('afk_logout_timeout_minutes', 15),
            'warning_seconds' => (int) SystemSetting::get('afk_logout_warning_seconds', 60),
        ];

        SystemSetting::set('afk_logout_enabled', (bool) $validated['enabled']);
        SystemSetting::set('afk_logout_timeout_minutes', (int) $validated['timeout_minutes']);
        if (isset($validated['warning_seconds'])) {
            SystemSetting::set('afk_logout_warning_seconds', (int) $validated['warning_seconds']);
        }

        $newSettings = [
            'enabled' => (bool) $validated['enabled'],
            'timeout_minutes' => (int) $validated['timeout_minutes'],
            'warning_seconds' => (int) ($validated['warning_seconds'] ?? 60),
        ];

        AuditLog::log(
            'AFK_LOGOUT_SETTINGS_UPDATED',
            'system_settings',
            null,
            $oldSettings,
            $newSettings,
            $user->id
        );

        return response()->json([
            'message' => 'AFK Inactivity Auto-Logout configuration updated successfully.',
            'settings' => $newSettings,
        ]);
    }

    /**
     * Get Cloudflare Turnstile security verification status (Public / Authenticated).
     */
    public function getTurnstileSettings(): JsonResponse
    {
        $enabled = SystemSetting::isTurnstileEnabled();
        $siteKey = (string) config('services.turnstile.site_key', '');
        $hasLiveKeys = $siteKey !== '' && !empty(config('services.turnstile.secret_key'));

        return response()->json([
            'enabled' => $enabled,
            'has_live_keys' => $hasLiveKeys,
            'site_key' => $enabled ? $siteKey : '',
        ]);
    }

    /**
     * Enable or disable Cloudflare Turnstile security verification (Super Admin only).
     */
    public function updateTurnstileSettings(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized. Super Administrator access is strictly required to modify Cloudflare security settings.',
            ], 403);
        }

        $validated = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        $oldEnabled = SystemSetting::isTurnstileEnabled();
        $newEnabled = (bool) $validated['enabled'];

        SystemSetting::set('turnstile_enabled', $newEnabled);

        AuditLog::log(
            'TURNSTILE_SECURITY_TOGGLED',
            'system_settings',
            null,
            ['turnstile_enabled' => $oldEnabled],
            ['turnstile_enabled' => $newEnabled],
            $user->id
        );

        return response()->json([
            'message' => $newEnabled
                ? 'Cloudflare Security Verification has been ENABLED for Sign In and Account Registration.'
                : 'Cloudflare Security Verification has been DISABLED. Users can now sign in and register without verification.',
            'enabled' => $newEnabled,
        ]);
    }
}

