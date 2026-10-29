<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    /**
     * In-memory cache of settings to eliminate redundant DB queries per request
     * while staying 100% real-time accurate on updates.
     */
    protected static ?array $memoryCache = null;

    /**
     * Clear in-memory setting cache (useful between tests or after updates).
     */
    public static function flushCache(): void
    {
        static::$memoryCache = null;
    }

    /**
     * Load all system settings into memory in a single query.
     */
    protected static function loadAllIntoCache(): void
    {
        if (static::$memoryCache !== null) {
            return;
        }

        try {
            static::$memoryCache = static::pluck('value', 'key')->all();
        } catch (\Throwable $e) {
            static::$memoryCache = [];
        }
    }

    /**
     * Retrieve a setting value by key with optional default.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        try {
            static::loadAllIntoCache();

            if (!array_key_exists($key, static::$memoryCache)) {
                $setting = static::where('key', $key)->first();
                if (!$setting) {
                    return $default;
                }
                static::$memoryCache[$key] = $setting->value;
            }

            $val = static::$memoryCache[$key];

            if ($val === 'true') {
                return true;
            }
            if ($val === 'false') {
                return false;
            }

            $decoded = json_decode((string) $val, true);
            if (json_last_error() === JSON_ERROR_NONE && (is_array($decoded) || is_object($decoded))) {
                return $decoded;
            }

            return $val;
        } catch (\Throwable $e) {
            return $default;
        }
    }

    /**
     * Store or update a setting value.
     */
    public static function set(string $key, mixed $value): static
    {
        if (is_bool($value)) {
            $val = $value ? 'true' : 'false';
        } elseif (is_array($value) || is_object($value)) {
            $val = json_encode($value);
        } else {
            $val = (string) $value;
        }

        $record = static::updateOrCreate(
            ['key' => $key],
            ['value' => $val]
        );

        if (static::$memoryCache !== null) {
            static::$memoryCache[$key] = $val;
        }

        return $record;
    }

    /**
     * Check if developer mode is enabled.
     */
    public static function isDeveloperMode(): bool
    {
        return (bool) static::get('developer_mode', false);
    }

    /**
     * Get signature insertion settings for PPMP, APP, and Attachment List.
     */
    public static function getSignatureSettings(): array
    {
        return [
            'ppmp' => (bool) static::get('signature_insertion_ppmp', true),
            'app' => (bool) static::get('signature_insertion_app', true),
            'attachment_list' => (bool) static::get('signature_insertion_attachment_list', true),
        ];
    }

    /**
     * Check if signature insertion is enabled for a given document type ('ppmp', 'app', 'attachment_list').
     */
    public static function isSignatureInsertionEnabled(string $documentType): bool
    {
        $settings = static::getSignatureSettings();
        $normalized = strtolower(trim($documentType));
        if ($normalized === 'ppmp') {
            return $settings['ppmp'];
        }
        if ($normalized === 'app') {
            return $settings['app'];
        }
        if (in_array($normalized, ['attachment_list', 'attachment', 'attachments'], true)) {
            return $settings['attachment_list'];
        }
        return true;
    }
}

